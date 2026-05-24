/**
 * Servicio NFC para pagos Android-a-Android.
 *
 * NFC NO mueve dinero ni transporta datos sensibles. Solo intercambia un token
 * temporal de solicitud de pago emitido y firmado por backend. El backend
 * valida y procesa el movimiento después de la confirmación explícita del
 * pagador.
 *
 * 1) Cobrador (recibe dinero):
 *    - Crea una solicitud en backend.
 *    - Emite por HCE un token temporal (`PaymentRequestNfcToken`).
 *    - Solo necesita mantener la pantalla encendida y la app activa.
 *
 * 2) Pagador (envía dinero):
 *    - Lee el token por IsoDep/APDU.
 *    - Consulta backend para ver receptor/monto.
 *    - Confirma manualmente; backend valida nonce/expiración/saldo y procesa.
 *
 * Requiere dev build (no funciona en Expo Go).
 */
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { NdefRecord, TagEvent } from 'react-native-nfc-manager';

import type { PaymentRequestNfcToken } from './api';

type NfcManagerLib = typeof import('react-native-nfc-manager');
type HceLib = {
  isNfcEnabled: () => Promise<boolean>;
  emulateCard: (options: { enabled: boolean }, uid?: string | null, data?: string | null) => Promise<void>;
  isCardEmulationActive?: () => Promise<boolean>;
};
type NfcTagPayload = Partial<Pick<TagEvent, 'ndefMessage'>>;

const FINGROW_AID = [0xf0, 0x46, 0x49, 0x4e, 0x47, 0x52, 0x4f, 0x57]; // F0 + "FINGROW"
const APDU_STATUS_OK = [0x90, 0x00];
const ISO_DEP_READ_CHUNK = 0xf0;

let nfcManagerLib: NfcManagerLib | null = null;
let hceLib: HceLib | null = null;
let listening = false;
let emulating = false;
let activeListenSession: symbol | null = null;

// Suscriptores que reaccionan cuando este celular empieza/deja de emular HCE.
// El detector global (NfcChargeDetector) usa esto para pausar su reader mode
// mientras el propio celular esté emulando, evitando que el reader interfiera
// con su propio HCE (un mismo NFC controller no puede hacer reader y card
// emulation al mismo tiempo de forma confiable).
type EmulationListener = (emulating: boolean) => void;
const emulationListeners = new Set<EmulationListener>();

export function onEmulationStateChange(listener: EmulationListener): () => void {
  emulationListeners.add(listener);
  // Notificar el estado actual al suscribirse
  listener(emulating);
  return () => {
    emulationListeners.delete(listener);
  };
}

function notifyEmulationState() {
  for (const listener of emulationListeners) {
    try {
      listener(emulating);
    } catch {
      // ignore listener errors
    }
  }
}

async function loadLib(): Promise<NfcManagerLib | null> {
  if (nfcManagerLib) return nfcManagerLib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nfcManagerLib = require('react-native-nfc-manager');
    return nfcManagerLib;
  } catch {
    return null;
  }
}

function loadHceLib(): HceLib | null {
  if (hceLib) return hceLib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hceLib = require('@utapza/expo-mifare-scanner') as HceLib;
    return hceLib;
  } catch {
    return null;
  }
}

let started = false;
async function ensureStarted(): Promise<NfcManagerLib | null> {
  const lib = await loadLib();
  if (!lib) return null;
  if (!started) {
    try {
      await lib.default.start();
      started = true;
    } catch {
      return null;
    }
  }
  return lib;
}

export async function isNfcAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const lib = await ensureStarted();
  if (!lib) return false;
  try {
    const supported = await lib.default.isSupported();
    if (!supported) return false;
    const enabled = await lib.default.isEnabled();
    return Boolean(enabled);
  } catch {
    return false;
  }
}

/**
 * Diagnóstico HCE. Devuelve un objeto con info detallada de por qué no se puede
 * emular (o vacío si todo está bien). Esto reemplaza la consulta a
 * `hce.isNfcEnabled()` que tiene un bug interno en `@utapza/expo-mifare-scanner`
 * cuando el módulo se inicializa antes de que la Activity esté lista: deja su
 * scanner en null y siempre devuelve `false` aunque NFC esté encendido.
 *
 * Nosotros decidimos disponibilidad real con `react-native-nfc-manager`, que sí
 * consulta el NfcAdapter directamente en cada llamada.
 */
export type HceStatus = {
  available: boolean;
  reason?: 'not-android' | 'no-nfc-hardware' | 'nfc-off' | 'module-missing';
  message?: string;
};

export async function getHceStatus(): Promise<HceStatus> {
  if (Platform.OS !== 'android') {
    return {
      available: false,
      reason: 'not-android',
      message: 'La emulación NFC solo funciona en Android.',
    };
  }

  const lib = await ensureStarted();
  if (!lib) {
    return {
      available: false,
      reason: 'no-nfc-hardware',
      message: 'Este dispositivo no tiene chip NFC o no se pudo inicializar.',
    };
  }

  try {
    const supported = await lib.default.isSupported();
    if (!supported) {
      return {
        available: false,
        reason: 'no-nfc-hardware',
        message: 'Tu celular no tiene hardware NFC.',
      };
    }
    const enabled = await lib.default.isEnabled();
    if (!enabled) {
      return {
        available: false,
        reason: 'nfc-off',
        message: 'El NFC está apagado. Actívalo en los ajustes del celular.',
      };
    }
  } catch {
    return {
      available: false,
      reason: 'no-nfc-hardware',
      message: 'No fue posible consultar el estado del NFC.',
    };
  }

  const hce = loadHceLib();
  if (!hce) {
    return {
      available: false,
      reason: 'module-missing',
      message:
        'El módulo nativo HCE no está disponible. Asegúrate de tener la última versión del APK (no Expo Go).',
    };
  }

  return { available: true };
}

/**
 * Compatibilidad con código anterior. Internamente usa `getHceStatus`.
 */
export async function isHceAvailable(): Promise<boolean> {
  const { available } = await getHceStatus();
  return available;
}

export async function openNfcSettings(): Promise<void> {
  const lib = await ensureStarted();
  if (!lib) return;
  try {
    await lib.default.goToNfcSetting();
  } catch {
    // ignore
  }
}

export async function createTransferReference(): Promise<string> {
  return Crypto.randomUUID();
}

function encodePayload(payload: PaymentRequestNfcToken): string {
  return JSON.stringify(payload);
}

function decodePayload(raw: string): PaymentRequestNfcToken | null {
  try {
    const obj = JSON.parse(raw) as PaymentRequestNfcToken;
    if (!obj || typeof obj !== 'object') return null;
    if (obj.kind !== 'fingrow.payment-request-token') return null;
    if (obj.version !== 1) return null;
    if (typeof obj.paymentRequestId !== 'string' || !obj.paymentRequestId) return null;
    if (typeof obj.token !== 'string' || !obj.token) return null;
    if (typeof obj.expiresAt !== 'string' || !obj.expiresAt) return null;
    return obj;
  } catch {
    return null;
  }
}

function bytesToUtf8(bytes: number[]): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  let output = '';
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++] ?? 0;
    if (byte1 < 0x80) {
      output += String.fromCharCode(byte1);
      continue;
    }
    if (byte1 >= 0xc0 && byte1 < 0xe0) {
      const byte2 = bytes[i++] ?? 0;
      output += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
      continue;
    }
    if (byte1 >= 0xe0 && byte1 < 0xf0) {
      const byte2 = bytes[i++] ?? 0;
      const byte3 = bytes[i++] ?? 0;
      output += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      );
      continue;
    }

    const byte2 = bytes[i++] ?? 0;
    const byte3 = bytes[i++] ?? 0;
    const byte4 = bytes[i++] ?? 0;
    const codePoint =
      ((byte1 & 0x07) << 18) |
      ((byte2 & 0x3f) << 12) |
      ((byte3 & 0x3f) << 6) |
      (byte4 & 0x3f);
    const adjusted = codePoint - 0x10000;
    output += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
  }
  return output;
}

function decodeNdefRecord(
  lib: NfcManagerLib,
  record: Pick<NdefRecord, 'payload'>
): string | null {
  const { Ndef } = lib;
  try {
    const payload =
      record.payload instanceof Uint8Array
        ? record.payload
        : new Uint8Array(record.payload);
    return Ndef.text.decodePayload(payload);
  } catch {
    return null;
  }
}

function decodeTag(
  lib: NfcManagerLib,
  tag: NfcTagPayload | null | undefined
): PaymentRequestNfcToken | null {
  if (!tag?.ndefMessage?.length) return null;
  for (const record of tag.ndefMessage) {
    const text = decodeNdefRecord(lib, record);
    if (!text) continue;
    const payload = decodePayload(text);
    if (payload) return payload;
  }
  return null;
}

function isApduOk(response: number[]): boolean {
  return (
    response.length >= 2 &&
    response[response.length - 2] === APDU_STATUS_OK[0] &&
    response[response.length - 1] === APDU_STATUS_OK[1]
  );
}

function stripApduStatus(response: number[]): number[] {
  if (!isApduOk(response)) {
    throw new Error(`APDU rechazado por el receptor NFC (${response.slice(-2).join(' ')})`);
  }
  return response.slice(0, -2);
}

async function readTransferPayloadIsoDep(lib: NfcManagerLib): Promise<PaymentRequestNfcToken | null> {
  const NfcManager = lib.default;

  // SELECT AID: enruta Android HCE hacia el servicio de FinGrow.
  // No enviamos Le final (0x00): en algunos stacks RN/Android se interpreta
  // como parte del AID y produce 6A82 (application/file not found).
  const selectAid = [0x00, 0xa4, 0x04, 0x00, FINGROW_AID.length, ...FINGROW_AID];
  stripApduStatus(await NfcManager.isoDepHandler.transceive(selectAid));

  // GET LENGTH: comando privado FinGrow. Devuelve 2 bytes big-endian + 9000.
  const lengthBytes = stripApduStatus(
    await NfcManager.isoDepHandler.transceive([0x80, 0xcb, 0x00, 0x00, 0x02])
  );
  if (lengthBytes.length < 2) return null;

  const totalLength = ((lengthBytes[0] ?? 0) << 8) | (lengthBytes[1] ?? 0);
  if (totalLength <= 0 || totalLength > 4096) {
    throw new Error('Payload NFC inválido o demasiado grande.');
  }

  const bytes: number[] = [];
  for (let offset = 0; offset < totalLength; offset += ISO_DEP_READ_CHUNK) {
    const chunkLength = Math.min(ISO_DEP_READ_CHUNK, totalLength - offset);
    const chunk = stripApduStatus(
      await NfcManager.isoDepHandler.transceive([
        0x80,
        0xca,
        (offset >> 8) & 0xff,
        offset & 0xff,
        chunkLength,
      ])
    );
    bytes.push(...chunk);
  }

  return decodePayload(bytesToUtf8(bytes));
}

// ──────────────────────────────────────────────────────────
// Modo escucha continua (pagador) — Reader Mode Android
// Android 15 expone el celular receptor como IsoDep/HCE. En vez de depender de
// que el sistema convierta eso a `ndefMessage`, seleccionamos el AID FinGrow y
// leemos el JSON del cobro con APDUs propios. Esto es más estable para
// phone-to-phone que simular un tag NDEF físico.
// ──────────────────────────────────────────────────────────

export async function startListeningForTransfer(
  onPayload: (payload: PaymentRequestNfcToken) => void,
  onError?: (err: Error) => void
): Promise<() => Promise<void>> {
  const lib = await ensureStarted();
  if (!lib) throw new Error('NFC no disponible en este dispositivo');

  const NfcManager = lib.default;
  const { NfcAdapter, NfcTech } = lib;

  if (listening) {
    await stopListeningForTransfer();
  }

  listening = true;
  const session = Symbol('nfc-listen-session');
  activeListenSession = session;

  const readerModeFlags =
    Platform.OS === 'android'
      ? NfcAdapter.FLAG_READER_NFC_A |
        NfcAdapter.FLAG_READER_NFC_B |
        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK |
        NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS
      : undefined;

  const loop = async () => {
    while (listening && activeListenSession === session) {
      try {
        await NfcManager.requestTechnology(NfcTech.IsoDep, {
          alertMessage: 'Acerca tu celular al del cobrador para leer el cobro',
          isReaderModeEnabled: Platform.OS === 'android',
          readerModeFlags,
        });

        const payload = await readTransferPayloadIsoDep(lib);
        if (payload && listening && activeListenSession === session) {
          onPayload(payload);
        }
      } catch (err) {
        if (listening && activeListenSession === session) {
          const message = err instanceof Error ? err.message : String(err);
          const isExpectedCancel =
            message.toLowerCase().includes('cancel') ||
            message.toLowerCase().includes('session') ||
            message.toLowerCase().includes('timeout');
          if (!isExpectedCancel) {
            onError?.(err instanceof Error ? err : new Error('Error leyendo NFC'));
          }
        }
      } finally {
        try {
          await NfcManager.cancelTechnologyRequest({ throwOnError: false, delayMsAndroid: 100 });
        } catch {
          // ignore
        }
      }
    }
  };

  loop().catch((err) => {
    if (listening && activeListenSession === session) {
      onError?.(err instanceof Error ? err : new Error('Error leyendo NFC'));
    }
  });

  return stopListeningForTransfer;
}

export async function stopListeningForTransfer(): Promise<void> {
  const lib = nfcManagerLib ?? (await loadLib());
  listening = false;
  activeListenSession = null;
  if (!lib) return;
  try {
    lib.default.setEventListener(lib.NfcEvents.DiscoverTag, null);
    await lib.default.cancelTechnologyRequest({ throwOnError: false, delayMsAndroid: 100 });
    await lib.default.unregisterTagEvent();
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────
// Lectura única (fallback con tag físico)
// ──────────────────────────────────────────────────────────

export async function readTransferPayload(): Promise<PaymentRequestNfcToken | null> {
  const lib = await ensureStarted();
  if (!lib) throw new Error('NFC no disponible en este dispositivo');

  const NfcManager = lib.default;
  const { NfcTech } = lib;

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: 'Acerca el celular emisor',
    });
    const tag = await NfcManager.getTag();
    return tag ? decodeTag(lib, tag) : null;
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // ignore
    }
  }
}

// ──────────────────────────────────────────────────────────
// Cobrador — Host Card Emulation (HCE)
// El celular del cobrador se vuelve un Type 4 NFC tag. Solo necesita tener la
// app abierta y la pantalla encendida. Cuando el pagador acerca su celular,
// el reader mode del pagador lee el NDEF emulado.
// ──────────────────────────────────────────────────────────

export async function emulateChargePayload(payload: PaymentRequestNfcToken): Promise<void> {
  // Verificación previa con react-native-nfc-manager (NO con el módulo HCE,
  // que tiene un bug interno que retorna false negativo). Esto da mensajes
  // específicos al usuario y evita llamar al módulo si NFC está apagado.
  const status = await getHceStatus();
  if (!status.available) {
    throw new Error(status.message || 'No se puede emitir el cobro NFC en este dispositivo.');
  }

  const hce = loadHceLib();
  if (!hce) {
    throw new Error(
      'Módulo HCE no disponible. Necesitas la última versión del APK de FinGrow (no Expo Go).'
    );
  }

  if (emulating) {
    try {
      await hce.emulateCard({ enabled: false });
    } catch {
      // ignore: stop best-effort
    }
    emulating = false;
    notifyEmulationState();
  }

  // Detener cualquier reader mode activo del propio celular: no se puede
  // hacer reader y emulation al mismo tiempo de forma confiable en Android.
  try {
    await stopListeningForTransfer();
  } catch {
    // ignore
  }

  const json = encodePayload(payload);
  const uid = payload.paymentRequestId.replace(/-/g, '').slice(0, 8).toUpperCase() || '00000000';

  try {
    await hce.emulateCard({ enabled: true }, uid, json);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // Mensaje específico si el módulo nativo no logró arrancar el HostApduService
    if (raw.toLowerCase().includes('not initialized') || raw.toLowerCase().includes('not available')) {
      throw new Error(
        'No se pudo activar la emulación HCE. Cierra y vuelve a abrir la app, asegúrate de tener NFC encendido y la pantalla activa.'
      );
    }
    throw new Error(`No se pudo emitir el cobro NFC: ${raw}`);
  }
  emulating = true;
  notifyEmulationState();
}

export async function stopChargeEmulation(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const hce = loadHceLib();
  if (!hce) return;
  const wasEmulating = emulating;
  try {
    await hce.emulateCard({ enabled: false });
  } catch {
    // ignore
  } finally {
    emulating = false;
    if (wasEmulating) notifyEmulationState();
  }
}

export function isCurrentlyEmulating(): boolean {
  return emulating;
}

// ──────────────────────────────────────────────────────────
// Fallback antiguo: escritura de tag NFC físico (usado raramente)
// ──────────────────────────────────────────────────────────

export async function writeTransferPayload(payload: PaymentRequestNfcToken): Promise<void> {
  const lib = await ensureStarted();
  if (!lib) throw new Error('NFC no disponible en este dispositivo');

  const NfcManager = lib.default;
  const { NfcTech, Ndef } = lib;

  const json = encodePayload(payload);
  const bytes = Ndef.encodeMessage([Ndef.textRecord(json)]);
  if (!bytes) throw new Error('No se pudo codificar el mensaje NFC');

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: 'Acerca el tag NFC físico para grabar la factura',
    });
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } finally {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // ignore
    }
  }
}

export async function cancelNfc(): Promise<void> {
  await stopListeningForTransfer();
  await stopChargeEmulation();
  const lib = nfcManagerLib ?? (await loadLib());
  if (!lib) return;
  try {
    await lib.default.cancelTechnologyRequest();
  } catch {
    // ignore
  }
}
