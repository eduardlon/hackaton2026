import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  HelpCircle,
  Lock,
  PhoneCall,
  Shield,
  Smartphone,
  UserPlus,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

export default function PhoneScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const storedPhone = useAuthStore((s) => s.storedPhone);
  const lookupPhone = useAuthStore((s) => s.lookupPhone);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [phone, setPhone] = useState('');
  const [focus, setFocus] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (storedPhone) {
      const local = storedPhone.replace(/^\+57/, '');
      setPhone(local);
    }
  }, [storedPhone]);

  useEffect(() => {
    if (error) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const canContinue = phone.replace(/\D/g, '').length >= 10 && !loading;

  const onContinue = async () => {
    if (!canContinue) return;
    setLoading(true);
    try {
      const result = await lookupPhone(phone);
      if (result.exists) {
        router.push({
          pathname: '/(auth)/pin',
          params: { phone, fromContinue: '1' },
        });
      } else {
        router.push({
          pathname: '/(auth)/register',
          params: { phone, fromContinue: '1' },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const onRegister = () => {
    if (!canContinue) return;
    router.push({
      pathname: '/(auth)/register',
      params: { phone, fromContinue: '1' },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <AuthBackgroundDecorations />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 96,
          paddingHorizontal: 20,
          justifyContent: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top row: Acceso rápido + Ayuda */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320 }}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 28,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.primarySoft,
              borderWidth: 1,
              borderColor: theme.colors.primary,
              ...theme.shadows.sm,
            }}
          >
            <Shield size={18} color={theme.colors.primaryDark} strokeWidth={2.4} />
            <View>
              <Text variant="caption" style={{ color: theme.colors.text }}>
                Acceso rápido
              </Text>
              <Text variant="micro" tone="muted">
                Seguro y en segundos
              </Text>
            </View>
          </View>

          <PressableScale
            haptic="light"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.bg,
              borderWidth: 1,
              borderColor: theme.colors.primary,
            }}
            accessibilityLabel="Ayuda"
          >
            <HelpCircle size={18} color={theme.colors.primaryDark} strokeWidth={2.2} />
            <Text variant="caption" tone="primary">
              Ayuda
            </Text>
          </PressableScale>
        </MotiView>

        {/* Logo central */}
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 480, delay: 120 }}
          style={{ marginBottom: 28 }}
        >
          <FinGrowLogo size="lg" />
          <View style={{ marginTop: 18, alignItems: 'center' }}>
            <Text
              variant="h3"
              align="center"
              style={{ color: theme.colors.textMuted, fontWeight: '500' as const }}
            >
              Tu acceso simple para
            </Text>
            <Text variant="h3" align="center" style={{ fontWeight: '700' as const }}>
              <Text variant="h3" tone="primary" style={{ fontWeight: '700' as const }}>
                crecer{' '}
              </Text>
              financieramente
            </Text>
          </View>
        </MotiView>

        {/* Campo celular */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 360, delay: 260 }}
        >
          <Pressable onPress={() => inputRef.current?.focus()}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: 64,
                backgroundColor: theme.colors.surface,
                borderWidth: 1.5,
                borderColor: focus ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.radii.xl,
                paddingHorizontal: 16,
                gap: 12,
                ...theme.shadows.sm,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingRight: 10,
                  borderRightWidth: 1,
                  borderRightColor: theme.colors.borderSoft,
                  height: '60%',
                }}
              >
                <Text variant="bodyStrong">+57</Text>
                <ChevronDown size={16} color={theme.colors.textMuted} />
              </View>
              <Smartphone size={18} color={theme.colors.textMuted} strokeWidth={2} />
              <TextInput
                ref={inputRef}
                placeholder="Ingresa tu celular"
                placeholderTextColor={theme.colors.textSoft}
                style={{
                  flex: 1,
                  color: theme.colors.text,
                  fontFamily: 'Inter_500Medium',
                  fontSize: 17,
                  letterSpacing: 0.5,
                }}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                onFocus={() => {
                  setFocus(true);
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
                }}
                onBlur={() => setFocus(false)}
                editable={!loading}
                maxLength={10}
                autoComplete="tel"
              />
            </View>
          </Pressable>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
            }}
          >
            <Lock size={12} color={theme.colors.primaryDark} strokeWidth={2.4} />
            <Text variant="micro" tone="primary">
              Escribe tu número para continuar
            </Text>
          </View>
        </MotiView>

        {error ? (
          <MotiView
            from={{ opacity: 0, translateY: -4 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 220 }}
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.dangerSoft,
            }}
          >
            <AlertCircle size={14} color={theme.colors.danger} />
            <Text variant="micro" tone="danger" style={{ flex: 1 }}>
              {error}
            </Text>
          </MotiView>
        ) : null}

        {/* Botón continuar + registro */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 360, delay: 360 }}
          style={{ gap: 12, marginTop: 18 }}
        >
          <PressableScale
            onPress={onContinue}
            disabled={!canContinue}
            haptic="medium"
            scaleTo={0.97}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              height: 60,
              borderRadius: theme.radii.xl,
              backgroundColor: canContinue ? theme.colors.primary : theme.colors.surfaceAlt,
              opacity: canContinue ? 1 : 0.7,
              ...theme.shadows.sm,
            }}
            accessibilityLabel="Continuar"
          >
            {loading ? (
              <ActivityIndicator color="#0E0F0E" />
            ) : (
              <>
                <Text
                  style={{
                    fontFamily: 'Inter_700Bold',
                    fontSize: 17,
                    color: canContinue ? '#0E0F0E' : theme.colors.textMuted,
                  }}
                >
                  Continuar
                </Text>
                <ArrowRight
                  size={20}
                  color={canContinue ? '#0E0F0E' : theme.colors.textMuted}
                  strokeWidth={2.4}
                />
              </>
            )}
          </PressableScale>

          <PressableScale
            onPress={onRegister}
            disabled={!canContinue}
            haptic="light"
            scaleTo={0.97}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              height: 60,
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.bg,
              borderWidth: 1.5,
              borderColor: canContinue ? theme.colors.primary : theme.colors.border,
              opacity: canContinue ? 1 : 0.7,
              ...theme.shadows.sm,
            }}
            accessibilityLabel="Registrarme"
          >
            <UserPlus
              size={20}
              color={canContinue ? theme.colors.primaryDark : theme.colors.textMuted}
              strokeWidth={2.2}
            />
            <Text variant="bodyStrong" tone={canContinue ? 'primary' : 'muted'}>
              Registrarme
            </Text>
          </PressableScale>
        </MotiView>

        {/* ¿Cambiaste tu cel? */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 360, delay: 480 }}
          style={{ alignItems: 'center', marginTop: 24 }}
        >
          <PressableScale
            haptic="selection"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 8,
              paddingHorizontal: 12,
            }}
          >
            <PhoneCall size={14} color={theme.colors.primaryDark} strokeWidth={2.2} />
            <Text variant="bodySmall" tone="muted">
              ¿Cambiaste tu cel?
            </Text>
          </PressableScale>
        </MotiView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
