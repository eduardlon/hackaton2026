/**
 * Cliente Insforge — REST puro + auth tipo billetera (phone + PIN + huella).
 *
 * Reemplaza el SDK por `fetch` directo (Hermes-safe) y soporta:
 *   - Lookup por celular: ¿este número ya tiene cuenta?
 *   - Registro con celular + nombre + PIN (4 dígitos)
 *   - Login con celular + PIN
 *   - Sesión en memoria (token NO se persiste → al cerrar la app se borra)
 *   - PIN guardado en SecureStore con candado biométrico para login con huella
 *
 * Backend Insforge esperado para la demo hackathon:
 *   - `demo-login` { phone, pin }                      → { user, session }
 *
 * Importante: las functions productivas auth-lookup-phone/auth-register/auth-login-pin
 * no existen en este backend demo. No las llames o Expo recibirá HTTP 404.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const baseUrl = (process.env.EXPO_PUBLIC_INSFORGE_URL ?? '').replace(/\/$/, '');
const functionsUrl = (process.env.EXPO_PUBLIC_INSFORGE_FUNCTIONS_URL ?? '').replace(/\/$/, '');
const anonKey = process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY ?? '';
const DEMO_PHONE = '+573001112233';
const DEMO_USER_NAME = 'Laura Martínez';

export function isInsforgeConfigured() {
  return Boolean(baseUrl || functionsUrl);
}

// ──────────────────────────────────────────────────────────
// Sesión EN MEMORIA (no se persiste — política de app financiera)
// ──────────────────────────────────────────────────────────

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearMemorySession() {
  accessToken = null;
}

// ──────────────────────────────────────────────────────────
// Almacenamiento local — solo el celular (identifica al usuario)
// El PIN solo va en SecureStore con candado biométrico.
// ──────────────────────────────────────────────────────────

const PHONE_KEY = '@fingrow/last-phone';
const SECURE_PIN_KEY = 'fingrow.secure.pin';
const SECURE_PHONE_KEY = 'fingrow.secure.phone';

export async function getStoredPhone(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PHONE_KEY);
  } catch {
    return null;
  }
}

export async function storePhone(phone: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PHONE_KEY, phone);
  } catch {
    // ignore
  }
}

export async function clearStoredPhone(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PHONE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Guarda el PIN en SecureStore protegido por biometría. La próxima vez
 * que el usuario abra la app, podemos ofrecer huella → al desbloquear,
 * leemos el PIN y autenticamos con el backend.
 */
export async function enableBiometricUnlock(phone: string, pin: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_PHONE_KEY, phone, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
    await SecureStore.setItemAsync(SECURE_PIN_KEY, pin, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
      requireAuthentication: true,
      authenticationPrompt: 'Confirma con tu huella para activar el ingreso rápido',
    });
  } catch (err) {
    if (__DEV__) {
      console.warn('[secure-store] no se pudo guardar PIN protegido:', err);
    }
  }
}

export async function readBiometricCredentials(): Promise<{
  phone: string;
  pin: string;
} | null> {
  try {
    const phone = await SecureStore.getItemAsync(SECURE_PHONE_KEY);
    const pin = await SecureStore.getItemAsync(SECURE_PIN_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Confirma con tu huella para ingresar a FinGrow',
    });
    if (!phone || !pin) return null;
    return { phone, pin };
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_PIN_KEY);
    await SecureStore.deleteItemAsync(SECURE_PHONE_KEY);
  } catch {
    // ignore
  }
}

export async function hasBiometricCredentials(): Promise<boolean> {
  try {
    const phone = await SecureStore.getItemAsync(SECURE_PHONE_KEY);
    return Boolean(phone);
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────
// Helpers HTTP
// ──────────────────────────────────────────────────────────

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
  if (anonKey) {
    headers.apikey = anonKey;
    if (!accessToken) headers.Authorization = `Bearer ${anonKey}`;
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  try {
    const payload = (await res.json()) as {
      error?: { message?: string; code?: string };
      message?: string;
    };
    return new Error(
      payload.error?.message ?? payload.message ?? `${fallback} (HTTP ${res.status})`
    );
  } catch {
    return new Error(`${fallback} (HTTP ${res.status})`);
  }
}

function functionUrl(slug: string) {
  if (functionsUrl) return `${functionsUrl}/${slug}`;
  return `${baseUrl}/functions/v1/${slug}`;
}

export function normalizePhone(input: string): string {
  // Quita espacios y guiones, asegura prefijo +
  const clean = input.replace(/\D/g, '');
  return clean.startsWith('57') ? `+${clean}` : `+57${clean}`;
}

async function postFunction(slug: string, body: Record<string, unknown>) {
  return fetch(functionUrl(slug), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
}

// ──────────────────────────────────────────────────────────
// Tipos comunes
// ──────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  phone: string;
  name: string;
  type?: string;
  email?: string;
};

type AuthSessionResponse = {
  user?: AuthUser;
  session?: { access_token?: string; refresh_token?: string; token?: string };
  access_token?: string;
};

function extractAuth(payload: AuthSessionResponse, phoneFallback: string): AuthUser {
  const user = payload.user;
  const token = payload.session?.access_token ?? payload.session?.token ?? payload.access_token;
  if (!user || !token) {
    throw new Error('Respuesta de Insforge incompleta');
  }
  accessToken = token;
  return {
    id: user.id,
    phone: user.phone ?? phoneFallback,
    name: user.name ?? 'Usuario',
    type: user.type,
    email: user.email,
  };
}

// ──────────────────────────────────────────────────────────
// Auth API — Phone lookup, Register, Login
// ──────────────────────────────────────────────────────────

export async function lookupPhone(phone: string): Promise<{ exists: boolean; name?: string }> {
  const normalized = normalizePhone(phone);
  return normalized === DEMO_PHONE
    ? { exists: true, name: DEMO_USER_NAME }
    : { exists: false };
}

export async function registerWithPhone(
  phone: string,
  name: string,
  pin: string
): Promise<AuthUser> {
  if (!isInsforgeConfigured()) {
    throw new Error('Insforge no está configurado. Revisa tu .env');
  }
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('El PIN debe tener exactamente 4 dígitos');
  }
  const normalized = normalizePhone(phone);
  const res = await postFunction('demo-login', {
    phone: normalized,
    pin,
  });
  void name;
  if (!res.ok) throw await parseError(res, 'No fue posible crear tu sesión demo');

  const payload = (await res.json()) as AuthSessionResponse;
  await storePhone(normalized);
  return extractAuth(payload, normalized);
}

export async function loginWithPin(phone: string, pin: string): Promise<AuthUser> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('El PIN debe tener 4 dígitos');
  }
  const normalized = normalizePhone(phone);
  if (!isInsforgeConfigured()) {
    throw new Error('Insforge no está configurado. Revisa tu .env');
  }
  const res = await postFunction('demo-login', {
    phone: normalized,
    pin,
  });
  if (!res.ok) throw await parseError(res, 'No fue posible iniciar sesión');

  const payload = (await res.json()) as AuthSessionResponse;
  await storePhone(normalized);
  return extractAuth(payload, normalized);
}

// ──────────────────────────────────────────────────────────
// Logout — limpia sesión en memoria. (NO limpiamos el celular,
// para que la próxima vez se muestre el PIN. `forgetDevice` sí lo borra)
// ──────────────────────────────────────────────────────────

export async function signOutInsforge(): Promise<void> {
  if (accessToken) {
    try {
      await fetch(functionUrl('auth-logout'), {
        method: 'POST',
        headers: buildHeaders(),
      });
    } catch {
      // best-effort
    }
  }
  clearMemorySession();
}

export async function forgetDevice(): Promise<void> {
  clearMemorySession();
  await clearStoredPhone();
  await clearBiometricCredentials();
}

// ──────────────────────────────────────────────────────────
// Functions (edge): invocar slug con body (con token actual)
// ──────────────────────────────────────────────────────────

export async function invokeFunction<T = unknown>(
  slug: string,
  body?: Record<string, unknown>
): Promise<T> {
  if (!isInsforgeConfigured()) {
    throw new Error(`[insforge] sin URL configurada para invocar "${slug}"`);
  }
  const res = await fetch(functionUrl(slug), {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw await parseError(res, `Error invocando "${slug}"`);
  return (await res.json()) as T;
}
