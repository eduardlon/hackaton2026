import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { configureNotifications } from '@/services/notifications';
import { useAuthStore } from '@/store/authStore';
import { ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { theme, isReady } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const hydrate = useAuthStore((s) => s.hydrate);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    hydrate();
    configureNotifications().catch(() => {});
  }, [hydrate]);

  useEffect(() => {
    if (!isReady || isHydrating) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/phone');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isHydrating, segments, isReady, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="nfc-transfer"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="breb-payment"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="invoice-payment"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}

function ThemedRoot() {
  const { theme, mode } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <RootStack />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontsTimeout, setFontsTimeout] = useState(false);

  useEffect(() => {
    // Failsafe: si las fuentes no cargan en 3s (red lenta), seguimos con
    // la fuente del sistema para no dejar la app en splash infinito.
    const t = setTimeout(() => setFontsTimeout(true), 3000);
    return () => clearTimeout(t);
  }, [setFontsTimeout]);

  const canRender = fontsLoaded || !!fontsError || fontsTimeout;

  useEffect(() => {
    if (canRender) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [canRender]);

  if (!canRender) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <ThemedRoot />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
