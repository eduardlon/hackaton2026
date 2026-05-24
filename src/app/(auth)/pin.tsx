import { useLocalSearchParams, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { ArrowLeft, Delete, Fingerprint } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import {
  Easing,
  default as Animated,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AuthBackgroundDecorations,
  FinGrowLogo,
  PressableScale,
  Text,
} from '@/components';
import { normalizePhone } from '@/services/insforge';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';

const PIN_LENGTH = 4;

export default function PinScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string; fromContinue?: string }>();

  const storedPhone = useAuthStore((s) => s.storedPhone);
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const loginWithBiometric = useAuthStore((s) => s.loginWithBiometric);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const hasBiometric = useAuthStore((s) => s.hasBiometric);
  const biometricPhone = useAuthStore((s) => s.biometricPhone);

  const fromContinue = params.fromContinue === '1';
  const phone = (params.phone as string) ?? (fromContinue ? storedPhone ?? '' : '');
  const selectedPhone = phone ? normalizePhone(phone) : '';
  const phoneMasked = phone ? `+57 ${phone.replace(/^\+?57/, '').replace(/^(\d{3})(\d{3})(\d{4}).*/, '$1 $2 $3')}` : '';
  const biometricMatchesPhone = Boolean(selectedPhone && biometricPhone === selectedPhone);

  const [pin, setPin] = useState<string>('');
  const [hasBiometricHw, setHasBiometricHw] = useState(false);
  const [allowAutoBiometric] = useState(() => hasBiometric && biometricMatchesPhone);
  const triedBiometric = useRef(false);
  const canUseBiometric = hasBiometricHw && hasBiometric && biometricMatchesPhone;

  // Si llegaron directo a PIN (sin pasar por Continuar), volver al celular.
  useEffect(() => {
    if (!fromContinue || !phone.replace(/\D/g, '')) {
      router.replace('/(auth)/phone');
    }
  }, [fromContinue, phone, router]);

  // Animación shake en error
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  // Animación pulso huella
  const fingerPulse = useSharedValue(1);
  useEffect(() => {
    fingerPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
  }, [fingerPulse]);
  const fingerStyle = useAnimatedStyle(() => ({ transform: [{ scale: fingerPulse.value }] }));

  // Detectar hardware biométrico
  useEffect(() => {
    (async () => {
      try {
        const supported = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBiometricHw(supported && enrolled);
      } catch {
        setHasBiometricHw(false);
      }
    })();
  }, []);

  // Huella automática solo si ya existía al entrar a esta pantalla.
  // Al primer login con PIN se activa biometría, pero no debe pedir huella otra vez.
  useEffect(() => {
    if (!fromContinue) return;
    if (triedBiometric.current) return;
    if (!hasBiometricHw || !allowAutoBiometric || !biometricMatchesPhone) return;
    triedBiometric.current = true;
    setTimeout(() => {
      promptBiometric();
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromContinue, hasBiometricHw, allowAutoBiometric]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/phone');
    }
  };

  // Limpiar error al editar
  useEffect(() => {
    if (authError) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  };

  const submitPin = async (finalPin: string) => {
    try {
      await loginWithPin(phone, finalPin);
      router.replace('/(tabs)');
    } catch {
      triggerShake();
      setTimeout(() => setPin(''), 320);
    }
  };

  const onDigit = (d: string) => {
    if (isLoading) return;
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      submitPin(next);
    }
  };

  const onBackspace = () => {
    if (isLoading) return;
    setPin((p) => p.slice(0, -1));
  };

  const promptBiometric = async () => {
    if (isLoading) return;
    if (!canUseBiometric) return;
    const ok = await loginWithBiometric(selectedPhone);
    if (ok) {
      router.replace('/(tabs)');
    }
  };

  if (!fromContinue || !phone.replace(/\D/g, '')) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <AuthBackgroundDecorations />

      {/* Botón volver */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          zIndex: 2,
        }}
      >
        <PressableScale
          onPress={goBack}
          haptic="light"
          scaleTo={0.92}
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radii.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.bg,
            borderWidth: 1.5,
            borderColor: theme.colors.primary,
            ...theme.shadows.sm,
          }}
          accessibilityLabel="Volver"
        >
          <ArrowLeft size={20} color={theme.colors.primaryDark} strokeWidth={2.2} />
        </PressableScale>
      </View>

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: 20,
        }}
      >
        {/* Logo arriba */}
        <MotiView
          from={{ opacity: 0, translateY: -8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 360 }}
          style={{ alignItems: 'center', marginTop: 12 }}
        >
          <FinGrowLogo size="sm" />
        </MotiView>

        {/* Título */}
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 360, delay: 100 }}
          style={{ alignItems: 'center', marginTop: 24 }}
        >
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 30,
              lineHeight: 36,
              color: theme.colors.text,
              textAlign: 'center',
            }}
          >
            Escribe tu clave
          </Text>
          {phoneMasked ? (
            <Text variant="bodySmall" tone="muted" align="center" style={{ marginTop: 6 }}>
              {phoneMasked}
            </Text>
          ) : null}
        </MotiView>

        {/* Cuadros PIN */}
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 16,
              marginTop: 28,
            },
            shakeStyle,
          ]}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < pin.length;
            return (
              <MotiView
                key={i}
                animate={{ scale: filled ? 1.05 : 1 }}
                transition={{ type: 'timing', duration: 140 }}
                style={{
                  width: 60,
                  height: 64,
                  borderRadius: theme.radii.lg,
                  borderWidth: 2,
                  borderColor: filled ? theme.colors.primary : theme.colors.primarySoft,
                  backgroundColor: theme.colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...theme.shadows.sm,
                }}
              >
                {filled ? (
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: theme.colors.primaryDark,
                    }}
                  />
                ) : null}
              </MotiView>
            );
          })}
        </Animated.View>

        {/* Mensaje de seguridad */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 360, delay: 280 }}
          style={{ alignItems: 'center', marginTop: 18 }}
        >
          <Text variant="bodySmall" tone="muted" align="center">
            Confirmamos que eres tú
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text variant="bodySmall" tone="muted">
              para{' '}
            </Text>
            <Text variant="bodySmall" tone="primary">
              proteger tu acceso
            </Text>
          </View>
          {authError ? (
            <Text
              variant="micro"
              tone="danger"
              align="center"
              style={{ marginTop: 8 }}
            >
              {authError}
            </Text>
          ) : null}
        </MotiView>

        {/* Teclado numérico */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 360, delay: 220 }}
            style={{ gap: 8 }}
          >
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['bio', '0', 'del'],
            ].map((row, ri) => (
              <View
                key={ri}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                {row.map((cell) => {
                  if (cell === 'bio') {
                    return (
                      <PressableScale
                        key={`bio-${ri}`}
                        onPress={promptBiometric}
                        haptic="light"
                        scaleTo={0.92}
                        disabled={!canUseBiometric}
                        style={{
                          flex: 1,
                          height: 64,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: theme.radii.lg,
                          opacity: canUseBiometric ? 1 : 0.35,
                        }}
                        accessibilityLabel="Ingresar con huella"
                      >
                        <Animated.View style={fingerStyle}>
                          <Fingerprint
                            size={32}
                            color={theme.colors.primaryDark}
                            strokeWidth={2.2}
                          />
                        </Animated.View>
                      </PressableScale>
                    );
                  }
                  if (cell === 'del') {
                    return (
                      <PressableScale
                        key={`del-${ri}`}
                        onPress={onBackspace}
                        haptic="light"
                        scaleTo={0.92}
                        style={{
                          flex: 1,
                          height: 64,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: theme.radii.lg,
                          borderWidth: 1.5,
                          borderColor: theme.colors.primary,
                          backgroundColor: theme.colors.bg,
                        }}
                        accessibilityLabel="Borrar"
                      >
                        <Delete size={22} color={theme.colors.primaryDark} strokeWidth={2.2} />
                      </PressableScale>
                    );
                  }
                  return (
                    <PressableScale
                      key={`${ri}-${cell}`}
                      onPress={() => onDigit(cell)}
                      haptic={Platform.OS === 'ios' ? 'selection' : 'light'}
                      scaleTo={0.92}
                      style={{
                        flex: 1,
                        height: 64,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: theme.radii.lg,
                      }}
                      accessibilityLabel={`Dígito ${cell}`}
                    >
                      <Text
                        style={{
                          fontFamily: 'Inter_500Medium',
                          fontSize: 32,
                          color: theme.colors.text,
                        }}
                      >
                        {cell}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            ))}
          </MotiView>

          {/* Olvidé mi clave */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 360, delay: 360 }}
            style={{ marginTop: 16 }}
          >
            <PressableScale
              haptic="selection"
              scaleTo={0.97}
              style={{
                alignSelf: 'center',
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderRadius: theme.radii.xl,
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.bg,
              }}
            >
              <Text variant="bodyStrong" tone="primary">
                Olvidé mi clave
              </Text>
            </PressableScale>
          </MotiView>
        </View>
      </View>
    </View>
  );
}
