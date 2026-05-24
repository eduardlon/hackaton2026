import { Easing } from 'react-native-reanimated';

export type ThemeMode = 'light' | 'dark';

export type Palette = {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderSoft: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryContrast: string;
  text: string;
  textMuted: string;
  textSoft: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  warnSoft: string;
  success: string;
  successSoft: string;
  income: string;
  expense: string;
  shadow: string;
};

const lightPalette: Palette = {
  bg: '#FFFFFF',
  bgElevated: '#FAFBF6',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F7EE',
  border: '#E6EAE0',
  borderSoft: '#EEF1E7',
  primary: '#A7E800',
  primaryDark: '#8ED000',
  primarySoft: '#EFFBC9',
  primaryContrast: '#0E0F0E',
  text: '#0E0F0E',
  textMuted: '#5B6470',
  textSoft: '#8A92A0',
  danger: '#EF4F4F',
  dangerSoft: '#FCE3E3',
  warn: '#F4A53A',
  warnSoft: '#FBEAD0',
  success: '#22A06B',
  successSoft: '#DBF3E7',
  income: '#22A06B',
  expense: '#EF4F4F',
  shadow: 'rgba(15, 23, 12, 0.08)',
};

const darkPalette: Palette = {
  bg: '#0B0D0B',
  bgElevated: '#101410',
  surface: '#14181A',
  surfaceAlt: '#1B2120',
  border: '#23282A',
  borderSoft: '#1A1F20',
  primary: '#A7E800',
  primaryDark: '#8ED000',
  primarySoft: '#28391B',
  primaryContrast: '#0E0F0E',
  text: '#F5F7F4',
  textMuted: '#A6ADB4',
  textSoft: '#737A82',
  danger: '#EF6A6A',
  dangerSoft: '#3A1F1F',
  warn: '#F4B65A',
  warnSoft: '#3A2C13',
  success: '#3DD68C',
  successSoft: '#16331F',
  income: '#3DD68C',
  expense: '#EF6A6A',
  shadow: 'rgba(0, 0, 0, 0.5)',
};

export const palettes: Record<ThemeMode, Palette> = {
  light: lightPalette,
  dark: darkPalette,
};

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const typography = {
  display: { fontFamily: 'Inter_700Bold', fontSize: 32, lineHeight: 38 },
  h1: { fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 30 },
  h2: { fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 26 },
  h3: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 22 },
  bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  bodySmall: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14 },
} as const;

export const motion = {
  fast: 180,
  base: 250,
  slow: 350,
  bar: 700,
  easeOut: Easing.out(Easing.cubic),
  easeInOut: Easing.inOut(Easing.cubic),
  spring: { damping: 18, stiffness: 220, mass: 0.6 },
};

export const shadows = (mode: ThemeMode) => {
  const isDark = mode === 'dark';
  return {
    sm: {
      shadowColor: isDark ? '#000' : '#0E1B0B',
      shadowOpacity: isDark ? 0.45 : 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    md: {
      shadowColor: isDark ? '#000' : '#0E1B0B',
      shadowOpacity: isDark ? 0.55 : 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    lg: {
      shadowColor: isDark ? '#000' : '#0E1B0B',
      shadowOpacity: isDark ? 0.6 : 0.1,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
  };
};

export type Theme = {
  mode: ThemeMode;
  colors: Palette;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
  motion: typeof motion;
  shadows: ReturnType<typeof shadows>;
};

export const buildTheme = (mode: ThemeMode): Theme => ({
  mode,
  colors: palettes[mode],
  radii,
  spacing,
  typography,
  motion,
  shadows: shadows(mode),
});
