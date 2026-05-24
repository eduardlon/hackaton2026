import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { buildTheme, type Theme, type ThemeMode } from './tokens';

type Ctx = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  isReady: boolean;
};

const ThemeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = '@credigrow/theme-mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Brief: la app SIEMPRE arranca en claro; el usuario puede cambiar a oscuro
  // y la preferencia se respeta en próximas aperturas.
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as ThemeMode | null;
        if (stored === 'dark' || stored === 'light') {
          setModeState(stored);
        }
      } catch {
        // ignore
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      theme: buildTheme(mode),
      mode,
      setMode,
      toggleMode,
      isReady,
    }),
    [mode, setMode, toggleMode, isReady]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
