import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Antenna,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Radio,
  WifiOff,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, Text } from '@/components';
import { confirmNfcTransfer, type NfcTransferPayload } from '@/services/api';
import {
  cancelNfc,
  createTransferReference,
  isNfcAvailable,
  startListeningForTransfer,
  stopListeningForTransfer,
  writeTransferPayload,
} from '@/services/nfc';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';

type Mode = 'select' | 'send' | 'receive';
type Status = 'idle' | 'amount' | 'scanning' | 'success' | 'error';

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export default function NfcTransferScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<Mode>('select');
  const [status, setStatus] = useState<Status>('idle');
  const [amountText, setAmountText] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [receivedPayload, setReceivedPayload] = useState<NfcTransferPayload | null>(null);

  const cancelRef = useRef(false);
  const stopListenRef = useRef<(() => Promise<void>) | null>(null);

  // ondas concéntricas mientras escanea
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);

  useEffect(() => {
    (async () => {
      const ok = await isNfcAvailable();
      setAvailable(ok);
    })();
    return () => {
      cancelRef.current = true;
      stopListenRef.current?.().catch(() => {});
      cancelNfc().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (status === 'scanning') {
      ring1.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1
      );
      ring2.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1
      );
    } else {
      ring1.value = 0;
      ring2.value = 0;
    }
  }, [status, ring1, ring2]);

  const ring1Style = useAnimatedStyle(() => ({
    opacity: 1 - ring1.value,
    transform: [{ scale: 0.7 + ring1.value * 1.6 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: 1 - ring2.value,
    transform: [{ scale: 0.7 + ring2.value * 1.2 }],
  }));

  const scanningTitle = mode === 'receive' ? 'Recepción habilitada' : 'Enviando por NFC…';

  const close = () => {
    cancelRef.current = true;
    stopListenRef.current?.().catch(() => {});
    cancelNfc().catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const startSend = async () => {
    const amount = Number(amountText.replace(/\D/g, ''));
    if (!amount || amount < 1000) {
      Alert.alert('Monto inválido', 'El mínimo para enviar por NFC es $1.000');
      return;
    }
    if (!user) {
      Alert.alert('Sesión expirada', 'Vuelve a iniciar sesión.');
      return;
    }
    setStatus('scanning');
    setResultMessage(
      'El receptor debe tener la recepción habilitada. Acerca tu celular cuando te confirme.'
    );
    try {
      const payload: NfcTransferPayload = {
        fromUserId: user.id,
        fromName: user.name,
        amount,
        reference: await createTransferReference(),
        createdAt: new Date().toISOString(),
      };
      await writeTransferPayload(payload);
      if (cancelRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStatus('success');
      setResultMessage(
        `Solicitud NFC enviada por ${COP(amount)}. El receptor finaliza la confirmación.`
      );
    } catch (err) {
      if (cancelRef.current) return;
      const msg = err instanceof Error ? err.message : 'Error NFC desconocido';
      setStatus('error');
      setResultMessage(msg);
    }
  };

  const startReceive = async () => {
    setStatus('scanning');
    setResultMessage('Permiso activo. Dile al emisor que active NFC y acerque su celular.');
    try {
      stopListenRef.current = await startListeningForTransfer(
        async (payload) => {
          if (cancelRef.current) return;
          await stopListeningForTransfer();
          stopListenRef.current = null;
          setReceivedPayload(payload);
          try {
            const res = await confirmNfcTransfer(payload);
            if (cancelRef.current) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setStatus('success');
            setResultMessage(
              res.status === 'completed'
                ? `Recibiste ${COP(payload.amount)} de ${payload.fromName}`
                : 'Pago recibido — pendiente de confirmación.'
            );
          } catch (err) {
            if (cancelRef.current) return;
            const msg = err instanceof Error ? err.message : 'No fue posible confirmar';
            setStatus('error');
            setResultMessage(msg);
          }
        },
        (err) => {
          if (cancelRef.current) return;
          setStatus('error');
          setResultMessage(err.message);
        }
      );
    } catch (err) {
      if (cancelRef.current) return;
      const msg = err instanceof Error ? err.message : 'No fue posible leer';
      setStatus('error');
      setResultMessage(msg);
    }
  };

  const resetFlow = () => {
    stopListenRef.current?.().catch(() => {});
    cancelNfc().catch(() => {});
    stopListenRef.current = null;
    setStatus('idle');
    setMode('select');
    setAmountText('');
    setResultMessage(null);
    setReceivedPayload(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <PressableScale
          onPress={close}
          haptic="light"
          scaleTo={0.92}
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radii.lg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.bg,
          }}
        >
          <ArrowLeft size={20} color={theme.colors.primaryDark} strokeWidth={2.2} />
        </PressableScale>
        <Text variant="h3">Pago por NFC</Text>
        <View style={{ width: 44 }} />
      </View>

      {available === false ? (
        <View
          style={{
            margin: 16,
            padding: 14,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.warnSoft,
            flexDirection: 'row',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <WifiOff size={18} color={theme.colors.warn} />
          <Text variant="micro" style={{ flex: 1 }}>
            NFC no está disponible aquí. Estás corriendo en Expo Go o el dispositivo no
            tiene chip NFC. Para probarlo, crea un dev build:{'\n'}
            <Text variant="micro" tone="primary">
              npx expo prebuild && eas build --profile development
            </Text>
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {mode === 'select' ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            <Text variant="body" tone="muted">
              Primero el receptor permite la recepción; luego el emisor acerca su celular para
              enviar por NFC.
            </Text>

            <PressableScale
              onPress={() => {
                setMode('receive');
                setStatus('idle');
                setResultMessage(null);
              }}
              haptic="medium"
              scaleTo={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.primary,
                ...theme.shadows.md,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: theme.colors.primaryDark,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowDownLeft size={26} color="#0E0F0E" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3" style={{ color: '#0E0F0E' }}>
                  Recibir por NFC
                </Text>
                <Text variant="bodySmall" style={{ color: '#0E0F0E', opacity: 0.7 }}>
                  Permite el envío desde otro celular
                </Text>
              </View>
              <Radio size={22} color="#0E0F0E" strokeWidth={2.2} />
            </PressableScale>

            <PressableScale
              onPress={() => {
                setMode('send');
                setStatus('amount');
              }}
              haptic="medium"
              scaleTo={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.bg,
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                ...theme.shadows.sm,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: theme.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowUpRight size={26} color={theme.colors.primaryDark} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Enviar por NFC</Text>
                <Text variant="bodySmall" tone="muted">
                  Continúa cuando el receptor ya permitió
                </Text>
              </View>
              <Antenna size={22} color={theme.colors.primaryDark} strokeWidth={2.2} />
            </PressableScale>
          </View>
        ) : null}

        {mode === 'send' && status === 'amount' ? (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            style={{ marginTop: 12, gap: 18 }}
          >
            <Text variant="body" tone="muted">
              ¿Cuánto quieres enviar por NFC?
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                height: 70,
                paddingHorizontal: 16,
                borderRadius: theme.radii.xl,
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surface,
                ...theme.shadows.sm,
              }}
            >
              <Banknote size={22} color={theme.colors.primaryDark} />
              <Text variant="h2">$</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={theme.colors.textSoft}
                keyboardType="number-pad"
                value={amountText}
                onChangeText={(v) => setAmountText(v.replace(/\D/g, '').slice(0, 9))}
                style={{
                  flex: 1,
                  color: theme.colors.text,
                  fontSize: 32,
                  fontFamily: 'Inter_700Bold',
                }}
              />
            </View>
            <Text variant="micro" tone="muted">
              Mínimo $1.000. El receptor debe tocar Permitir recepción NFC antes de enviar.
            </Text>

            <PressableScale
              onPress={startSend}
              haptic="medium"
              scaleTo={0.97}
              style={{
                marginTop: 8,
                height: 60,
                borderRadius: theme.radii.xl,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 10,
                backgroundColor: theme.colors.primary,
                ...theme.shadows.sm,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: '#0E0F0E' }}>
                Continuar: receptor ya permitió
              </Text>
              <Antenna size={20} color="#0E0F0E" />
            </PressableScale>
          </MotiView>
        ) : null}

        {mode === 'receive' && status === 'idle' ? (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            style={{ marginTop: 12, gap: 18 }}
          >
            <Text variant="body" tone="muted">
              Activa la recepción solo cuando estés listo para recibir. Después de permitirla,
              el emisor podrá acercar su celular y continuar el pago por NFC.
            </Text>

            <View
              style={{
                padding: 18,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.primarySoft,
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Radio size={24} color="#0E0F0E" strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="h3">Permiso del receptor</Text>
                  <Text variant="bodySmall" tone="muted">
                    Tu celular quedará escuchando el pago del emisor.
                  </Text>
                </View>
              </View>
              <Text variant="micro" tone="muted">
                No compartimos tu PIN ni token por NFC. La transferencia se confirma con tu sesión
                al leer el pago.
              </Text>
            </View>

            <PressableScale
              onPress={startReceive}
              haptic="medium"
              scaleTo={0.97}
              style={{
                height: 60,
                borderRadius: theme.radii.xl,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 10,
                backgroundColor: theme.colors.primary,
                ...theme.shadows.sm,
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: '#0E0F0E' }}>
                Permitir recepción NFC
              </Text>
              <ArrowDownLeft size={20} color="#0E0F0E" />
            </PressableScale>

            <PressableScale
              onPress={resetFlow}
              haptic="light"
              style={{
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: theme.radii.lg,
                borderWidth: 1.5,
                borderColor: theme.colors.border,
              }}
            >
              <Text tone="muted">Volver</Text>
            </PressableScale>
          </MotiView>
        ) : null}

        {status === 'scanning' ? (
          <View style={{ alignItems: 'center', marginTop: 40, gap: 20 }}>
            <View
              style={{
                width: 180,
                height: 180,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 180,
                    height: 180,
                    borderRadius: 90,
                    backgroundColor: theme.colors.primarySoft,
                  },
                  ring1Style,
                ]}
              />
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 130,
                    height: 130,
                    borderRadius: 65,
                    backgroundColor: theme.colors.primarySoft,
                  },
                  ring2Style,
                ]}
              />
              <View
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...theme.shadows.md,
                }}
              >
                <Antenna size={38} color="#0E0F0E" strokeWidth={2.4} />
              </View>
            </View>
            <Text variant="h3" align="center">
              {scanningTitle}
            </Text>
            {resultMessage ? (
              <Text variant="bodySmall" tone="muted" align="center">
                {resultMessage}
              </Text>
            ) : null}
            <ActivityIndicator color={theme.colors.primaryDark} />
            <PressableScale
              onPress={resetFlow}
              haptic="light"
              style={{
                marginTop: 10,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: theme.radii.lg,
                borderWidth: 1.5,
                borderColor: theme.colors.border,
              }}
            >
              <Text tone="muted">Cancelar</Text>
            </PressableScale>
          </View>
        ) : null}

        {status === 'success' ? (
          <MotiView
            from={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 360 }}
            style={{ alignItems: 'center', marginTop: 40, gap: 16 }}
          >
            <View
              style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.shadows.md,
              }}
            >
              <CheckCircle2 size={56} color="#0E0F0E" strokeWidth={2.4} />
            </View>
            <Text variant="h2" align="center">
              ¡Listo!
            </Text>
            <Text variant="body" tone="muted" align="center">
              {resultMessage}
            </Text>
            {receivedPayload ? (
              <View
                style={{
                  width: '100%',
                  padding: 14,
                  borderRadius: theme.radii.lg,
                  backgroundColor: theme.colors.primarySoft,
                  gap: 4,
                }}
              >
                <Text variant="micro" tone="muted">
                  Referencia
                </Text>
                <Text variant="bodySmall">{receivedPayload.reference}</Text>
              </View>
            ) : null}
            <PressableScale
              onPress={close}
              haptic="medium"
              style={{
                height: 56,
                paddingHorizontal: 28,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#0E0F0E' }}>Cerrar</Text>
            </PressableScale>
          </MotiView>
        ) : null}

        {status === 'error' ? (
          <View style={{ alignItems: 'center', marginTop: 40, gap: 16 }}>
            <Text variant="h3" tone="danger" align="center">
              No pudimos completar la operación
            </Text>
            <Text variant="bodySmall" tone="muted" align="center">
              {resultMessage}
            </Text>
            <PressableScale
              onPress={resetFlow}
              haptic="light"
              style={{
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: theme.radii.xl,
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.bg,
              }}
            >
              <Text tone="primary">Volver a intentar</Text>
            </PressableScale>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
