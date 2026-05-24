import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Delete, Sparkles, User } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AuthBackgroundDecorations,
  FinGrowLogo,
  PressableScale,
  Text,
} from '@/components';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';

const PIN_LENGTH = 4;

type Step = 'name' | 'pin' | 'confirm';

export default function RegisterScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string; fromContinue?: string }>();
  const phone = (params.phone as string) ?? '';
  const fromContinue = params.fromContinue === '1';

  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!fromContinue || !phone.replace(/\D/g, '')) {
      router.replace('/(auth)/phone');
    }
  }, [fromContinue, phone, router]);

  const goBackToPhone = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/phone');
  };

  useEffect(() => {
    if (authError) clearError();
    if (localError) setLocalError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, pin, confirm, step]);

  const goNext = async () => {
    if (step === 'name') {
      if (name.trim().length < 2) {
        setLocalError('Ingresa tu nombre completo');
        return;
      }
      setStep('pin');
      return;
    }
    if (step === 'pin') {
      if (pin.length !== PIN_LENGTH) {
        setLocalError('Tu clave debe tener 4 dígitos');
        return;
      }
      setStep('confirm');
      return;
    }
    if (step === 'confirm') {
      if (confirm !== pin) {
        setLocalError('Las claves no coinciden');
        setConfirm('');
        return;
      }
      try {
        await register(phone, name, pin, true);
        router.replace('/(tabs)');
      } catch {
        // authError ya tiene el mensaje
      }
    }
  };

  const onDigit = (d: string) => {
    if (isLoading) return;
    if (step === 'pin') {
      if (pin.length >= PIN_LENGTH) return;
      const next = pin + d;
      setPin(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => setStep('confirm'), 160);
      }
    } else if (step === 'confirm') {
      if (confirm.length >= PIN_LENGTH) return;
      const next = confirm + d;
      setConfirm(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => goNext(), 160);
      }
    }
  };

  const onBackspace = () => {
    if (isLoading) return;
    if (step === 'pin') setPin((p) => p.slice(0, -1));
    if (step === 'confirm') setConfirm((p) => p.slice(0, -1));
  };

  const value = step === 'pin' ? pin : confirm;
  const errorMsg = localError ?? authError;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthBackgroundDecorations />

      <View
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          zIndex: 2,
        }}
      >
        <PressableScale
          onPress={() => {
            if (step === 'name') return goBackToPhone();
            if (step === 'pin') return setStep('name');
            setStep('pin');
            setConfirm('');
          }}
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
        >
          <ArrowLeft size={20} color={theme.colors.primaryDark} strokeWidth={2.2} />
        </PressableScale>
      </View>

      <View style={{ flex: 1, paddingTop: insets.top + 16 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + 12,
            paddingHorizontal: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <FinGrowLogo size="sm" />
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          key={step}
          transition={{ type: 'timing', duration: 280 }}
          style={{ marginTop: 28 }}
        >
          {step === 'name' ? (
            <>
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 26,
                  color: theme.colors.text,
                  textAlign: 'center',
                }}
              >
                Bienvenido a{' '}
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    fontSize: 26,
                    color: theme.colors.primaryDark,
                  }}
                >
                  FinGrow
                </Text>
              </Text>
              <Text
                variant="bodySmall"
                tone="muted"
                align="center"
                style={{ marginTop: 8 }}
              >
                Estamos creando tu cuenta para el celular
              </Text>
              <Text variant="bodyStrong" tone="primary" align="center">
                +57 {phone.replace(/\D/g, '')}
              </Text>

              <View
                style={{
                  marginTop: 32,
                  flexDirection: 'row',
                  alignItems: 'center',
                  height: 60,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1.5,
                  borderColor: theme.colors.primary,
                  borderRadius: theme.radii.xl,
                  paddingHorizontal: 16,
                  gap: 12,
                  ...theme.shadows.sm,
                }}
              >
                <User size={20} color={theme.colors.primaryDark} strokeWidth={2.2} />
                <TextInput
                  ref={nameInputRef}
                  placeholder="¿Cómo te llamas?"
                  placeholderTextColor={theme.colors.textSoft}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                  style={{
                    flex: 1,
                    color: theme.colors.text,
                    fontFamily: 'Inter_500Medium',
                    fontSize: 17,
                  }}
                />
              </View>

              <View
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={12} color={theme.colors.primaryDark} />
                <Text variant="micro" tone="muted">
                  Usamos tu nombre solo para personalizar tu billetera.
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: 28,
                  color: theme.colors.text,
                  textAlign: 'center',
                }}
              >
                {step === 'pin' ? 'Crea tu clave' : 'Confírmala'}
              </Text>
              <Text
                variant="bodySmall"
                tone="muted"
                align="center"
                style={{ marginTop: 8 }}
              >
                {step === 'pin'
                  ? 'Elige 4 dígitos fáciles de recordar para ti.'
                  : 'Vuelve a escribirla para asegurarnos.'}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 16,
                  marginTop: 28,
                }}
              >
                {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                  const filled = i < value.length;
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
              </View>
            </>
          )}

          {errorMsg ? (
            <Text
              variant="micro"
              tone="danger"
              align="center"
              style={{ marginTop: 14 }}
            >
              {errorMsg}
            </Text>
          ) : null}
        </MotiView>

        <View style={{ flex: 1 }} />

        {step === 'name' ? (
          <View style={{ marginTop: 32 }}>
            <PressableScale
              onPress={goNext}
              disabled={isLoading || name.trim().length < 2}
              haptic="medium"
              scaleTo={0.97}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                height: 60,
                borderRadius: theme.radii.xl,
                backgroundColor:
                  name.trim().length >= 2 ? theme.colors.primary : theme.colors.surfaceAlt,
                opacity: name.trim().length >= 2 ? 1 : 0.7,
                ...theme.shadows.sm,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#0E0F0E" />
              ) : (
                <>
                  <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: '#0E0F0E' }}>
                    Continuar
                  </Text>
                  <ArrowRight size={20} color="#0E0F0E" strokeWidth={2.4} />
                </>
              )}
            </PressableScale>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 24 }}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['', '0', 'del'],
            ].map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                {row.map((cell, ci) => {
                  if (cell === '') {
                    return <View key={`empty-${ri}-${ci}`} style={{ flex: 1 }} />;
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
          </View>
        )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
