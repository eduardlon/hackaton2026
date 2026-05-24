import { create } from 'zustand';

import { invalidateWalletHomeCache } from '@/services/api';
import {
  clearMemorySession,
  enableBiometricUnlock,
  forgetDevice,
  getStoredPhone,
  hasBiometricCredentials,
  loginWithPin,
  lookupPhone,
  readBiometricCredentials,
  registerWithPhone,
  signOutInsforge,
  type AuthUser,
} from '@/services/insforge';

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // hidratación al abrir la app: leer celular almacenado + verificar biometría
  isHydrating: boolean;
  storedPhone: string | null;
  hasBiometric: boolean;

  error: string | null;

  hydrate: () => Promise<void>;

  lookupPhone: (phone: string) => Promise<{ exists: boolean; name?: string }>;
  register: (phone: string, name: string, pin: string, enableBiometric?: boolean) => Promise<void>;
  loginWithPin: (phone: string, pin: string, enableBiometric?: boolean) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;

  signOut: () => Promise<void>;
  forgetDevice: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrating: true,
  storedPhone: null,
  hasBiometric: false,
  error: null,

  /**
   * Al abrir la app: NO restauramos sesión activa (política app financiera).
   * Solo leemos qué celular se usó por última vez para mostrarlo en el flujo
   * de PIN/huella. El token y la sesión se piden de nuevo SIEMPRE.
   */
  hydrate: async () => {
    if (!get().isHydrating && get().storedPhone !== null) return;
    try {
      const [phone, biometric] = await Promise.all([
        getStoredPhone(),
        hasBiometricCredentials(),
      ]);
      set({
        storedPhone: phone,
        hasBiometric: biometric,
        // SIEMPRE no autenticado al arrancar
        user: null,
        isAuthenticated: false,
      });
    } finally {
      set({ isHydrating: false });
    }
  },

  lookupPhone: async (phone) => {
    set({ error: null });
    try {
      return await lookupPhone(phone);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No fue posible validar el celular';
      set({ error: message });
      throw err;
    }
  },

  register: async (phone, name, pin, enableBiometricOpt = true) => {
    set({ isLoading: true, error: null });
    try {
      const user = await registerWithPhone(phone, name, pin);
      if (enableBiometricOpt) {
        await enableBiometricUnlock(user.phone, pin).catch(() => {});
      }
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        storedPhone: user.phone,
        hasBiometric: enableBiometricOpt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No fue posible crear tu cuenta';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  loginWithPin: async (phone, pin, enableBiometricOpt = true) => {
    set({ isLoading: true, error: null });
    try {
      const user = await loginWithPin(phone, pin);
      if (enableBiometricOpt) {
        await enableBiometricUnlock(user.phone, pin).catch(() => {});
      }
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        storedPhone: user.phone,
        hasBiometric: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PIN incorrecto';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  loginWithBiometric: async () => {
    set({ isLoading: true, error: null });
    try {
      const creds = await readBiometricCredentials();
      if (!creds) {
        set({ isLoading: false });
        return false;
      }
      const user = await loginWithPin(creds.phone, creds.pin);
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        storedPhone: user.phone,
        hasBiometric: true,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Huella no reconocida';
      // Cancelar biometría no es un error visible
      const isCancel = /cancel|user|denied/i.test(message);
      set({ isLoading: false, error: isCancel ? null : message });
      return false;
    }
  },

  /** Cierra sesión pero mantiene el celular recordado para próxima vez. */
  signOut: async () => {
    await signOutInsforge();
    invalidateWalletHomeCache();
    clearMemorySession();
    set({ user: null, isAuthenticated: false, error: null });
  },

  /** Olvida completamente el dispositivo (celular + biometría). */
  forgetDevice: async () => {
    await forgetDevice();
    invalidateWalletHomeCache();
    set({
      user: null,
      isAuthenticated: false,
      error: null,
      storedPhone: null,
      hasBiometric: false,
    });
  },

  clearError: () => set({ error: null }),
}));
