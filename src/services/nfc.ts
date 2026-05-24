/**
 * Servicio NFC para transferencias peer-to-peer entre celulares.
 *
 * Requiere dev build (no Expo Go). El receptor usa Reader Mode para escuchar
 * continuamente; el emisor escribe un mensaje NDEF cuando los celulares se acercan.
 */
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { NdefRecord, TagEvent } from 'react-native-nfc-manager';

import type { NfcTransferPayload } from './api';

type NfcManagerLib = typeof import('react-native-nfc-manager');
type NfcTagPayload = Partial<Pick<TagEvent, 'ndefMessage'>>;

let nfcManagerLib: NfcManagerLib | null = null;
let listening = false;

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

function encodePayload(payload: NfcTransferPayload): string {
  return JSON.stringify(payload);
}

function decodePayload(raw: string): NfcTransferPayload | null {
  try {
    const obj = JSON.parse(raw) as NfcTransferPayload;
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.amount !== 'number' || obj.amount <= 0) return null;
    if (typeof obj.fromUserId !== 'string' || !obj.fromUserId) return null;
    if (typeof obj.reference !== 'string' || !obj.reference) return null;
    return obj;
  } catch {
    return null;
  }
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
): NfcTransferPayload | null {
  if (!tag?.ndefMessage?.length) return null;
  for (const record of tag.ndefMessage) {
    const text = decodeNdefRecord(lib, record);
    if (!text) continue;
    const payload = decodePayload(text);
    if (payload) return payload;
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// Modo escucha continua (receptor) — Reader Mode Android
// ──────────────────────────────────────────────────────────

export async function startListeningForTransfer(
  onPayload: (payload: NfcTransferPayload) => void,
  onError?: (err: Error) => void
): Promise<() => Promise<void>> {
  const lib = await ensureStarted();
  if (!lib) throw new Error('NFC no disponible en este dispositivo');

  const NfcManager = lib.default;
  const { NfcEvents, NfcAdapter } = lib;

  if (listening) {
    await stopListeningForTransfer();
  }

  listening = true;

  NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
    try {
      const payload = decodeTag(lib, tag);
      if (payload) {
        onPayload(payload);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Error leyendo NFC'));
    }
  });

  await NfcManager.registerTagEvent({
    alertMessage: 'Acerca el celular emisor para recibir el pago',
    invalidateAfterFirstRead: false,
    isReaderModeEnabled: Platform.OS === 'android',
    readerModeFlags:
      Platform.OS === 'android'
        ? NfcAdapter.FLAG_READER_NFC_A |
          NfcAdapter.FLAG_READER_NFC_B |
          NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK |
          NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS
        : undefined,
  });

  return stopListeningForTransfer;
}

export async function stopListeningForTransfer(): Promise<void> {
  const lib = nfcManagerLib ?? (await loadLib());
  if (!lib) return;
  try {
    lib.default.setEventListener(lib.NfcEvents.DiscoverTag, null);
    await lib.default.unregisterTagEvent();
  } catch {
    // ignore
  }
  listening = false;
}

// ──────────────────────────────────────────────────────────
// Lectura única (fallback)
// ──────────────────────────────────────────────────────────

export async function readTransferPayload(): Promise<NfcTransferPayload | null> {
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
// Emisor — escribe NDEF al acercar celulares / tag NFC
// ──────────────────────────────────────────────────────────

export async function writeTransferPayload(payload: NfcTransferPayload): Promise<void> {
  const lib = await ensureStarted();
  if (!lib) throw new Error('NFC no disponible en este dispositivo');

  const NfcManager = lib.default;
  const { NfcTech, Ndef } = lib;

  const json = encodePayload(payload);
  const bytes = Ndef.encodeMessage([Ndef.textRecord(json)]);
  if (!bytes) throw new Error('No se pudo codificar el mensaje NFC');

  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: 'Acerca tu celular al receptor para enviar',
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
  const lib = nfcManagerLib ?? (await loadLib());
  if (!lib) return;
  try {
    await lib.default.cancelTechnologyRequest();
  } catch {
    // ignore
  }
}
