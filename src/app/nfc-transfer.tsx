import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  QrCode,
  Radio,
  WifiOff,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

type Mode = 'select' | 'receive' | 'pay' | 'qr';
type Status = 'idle' | 'amount' | 'scanning' | 'success' | 'error';

const COP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export default function NfcTransferScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);

  const [mode, setMode] = useState<Mode>('select');
  const [status, setStatus] = useState<Status>('idle');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [receivedPayload, setReceivedPayload] = useState<NfcTransferPayload | null>(null);
  const [amountInput, setAmountInput] = useState('10000');
  const [noteInput, setNoteInput] = useState('Cobro FinGrow');

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

  const scanningTitle = mode === 'pay' ? 'Buscando cobro NFC' : 'Cobro NFC activo';

  const close = () => {
    cancelRef.current = true;
    stopListenRef.current?.().catch(() => {});
    cancelNfc().catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const getChargeAmount = () => Number(amountInput.replace(/[^0-9]/g, ''));

  const startCharge = async () => {
    if (!user?.id) {
      setStatus('error');
      setResultMessage('Inicia sesión para crear un cobro NFC.');
      return;
    }

    const amount = getChargeAmount();
    if (!Number.isFinite(amount) || amount < 1000) {
      setStatus('error');
      setResultMessage('El cobro mínimo por NFC es $1.000.');
      return;
    }

    setStatus('scanning');
    setResultMessage('Cobro activo. El pagador debe abrir “Pagar cobro NFC”, acercar su celular y confirmar.');
    const reference = await createTransferReference();
    const payload: NfcTransferPayload = {
      kind: 'fingrow.nfc.charge',
      receiverUserId: user.id,
      receiverName: user.name,
      amount,
      reference,
      note: noteInput.trim() || 'Cobro FinGrow',
      createdAt: new Date().toISOString(),
    };
    setReceivedPayload(payload);

    try {
      await writeTransferPayload(payload);
      if (cancelRef.current) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStatus('success');
      setResultMessage(`Cobro NFC de ${COP(amount)} compartido. Cuando el pagador confirme, se descuenta de su billetera y se acredita a la tuya.`);
    } catch (err) {
      if (cancelRef.current) return;
      const msg = err instanceof Error ? err.message : 'No fue posible compartir el cobro NFC';
      setStatus('error');
      setResultMessage(msg);
    }
  };

  const startPayCharge = async () => {
    setStatus('scanning');
    setResultMessage('Acerca tu celular al cobrador para leer la factura NFC. Luego confirmamos el pago desde tu sesión.');
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
                ? `Pagaste ${COP(payload.amount)} a ${payload.receiverName}. Se descontó de tu billetera y se acreditó al cobrador.`
                : 'Pago leído — pendiente de confirmación.'
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
      const msg = err instanceof Error ? err.message : 'No fue posible leer el cobro NFC';
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
        <Text variant="h3">Recibir dinero</Text>
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
              Crea una factura NFC para cobrar o lee un cobro NFC para pagar con tu billetera.
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
                  Crea una factura para cobrar
                </Text>
              </View>
              <Radio size={22} color="#0E0F0E" strokeWidth={2.2} />
            </PressableScale>

            <PressableScale
              onPress={() => {
                setMode('pay');
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
                backgroundColor: theme.colors.surface,
                borderWidth: 1.5,
                borderColor: theme.colors.border,
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
                <CreditCard size={26} color={theme.colors.primaryDark} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Pagar cobro NFC</Text>
                <Text variant="bodySmall" tone="muted">
                  Lee la factura del cobrador y confirma
                </Text>
              </View>
              <Radio size={22} color={theme.colors.primaryDark} strokeWidth={2.2} />
            </PressableScale>

            <PressableScale
              onPress={() => {
                setMode('qr');
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
                <QrCode size={26} color={theme.colors.primaryDark} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Mostrar QR</Text>
                <Text variant="bodySmall" tone="muted">
                  Permite que otro escanee y te pague
                </Text>
              </View>
              <QrCode size={22} color={theme.colors.primaryDark} strokeWidth={2.2} />
            </PressableScale>
          </View>
        ) : null}

        {mode === 'qr' ? (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            style={{ marginTop: 12, gap: 18 }}
          >
            <Text variant="body" tone="muted">
              Muestra este QR para que otra persona te pague desde su billetera.
            </Text>
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 230,
                padding: 18,
                borderRadius: theme.radii.xl,
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surface,
                ...theme.shadows.sm,
              }}
            >
              <View
                style={{
                  width: 158,
                  height: 158,
                  borderRadius: 18,
                  borderWidth: 10,
                  borderColor: theme.colors.text,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.bg,
                }}
              >
                <QrCode size={96} color={theme.colors.text} strokeWidth={2.2} />
              </View>
              <Text variant="micro" tone="muted" align="center" style={{ marginTop: 14 }}>
                QR de transferencia NFC · FinGrow
              </Text>
            </View>

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

        {mode === 'receive' && status === 'idle' ? (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            style={{ marginTop: 12, gap: 18 }}
          >
            <Text variant="body" tone="muted">
              Define el valor y activa una factura NFC. El pagador abre la app, lee el cobro,
              confirma y el dinero se descuenta de su billetera para acreditarse a la tuya.
            </Text>

            <View style={{ gap: 10 }}>
              <Text variant="micro" tone="muted">Valor a cobrar</Text>
              <TextInput
                value={amountInput}
                onChangeText={setAmountInput}
                keyboardType="number-pad"
                placeholder="10000"
                placeholderTextColor={theme.colors.textSoft}
                style={{
                  minHeight: 54,
                  paddingHorizontal: 14,
                  borderRadius: theme.radii.lg,
                  borderWidth: 1.5,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  fontFamily: 'Inter_700Bold',
                  fontSize: 18,
                }}
              />
              <Text variant="micro" tone="muted">Concepto</Text>
              <TextInput
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder="Factura, venta o servicio"
                placeholderTextColor={theme.colors.textSoft}
                maxLength={80}
                style={{
                  minHeight: 54,
                  paddingHorizontal: 14,
                  borderRadius: theme.radii.lg,
                  borderWidth: 1.5,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  fontFamily: 'Inter_500Medium',
                  fontSize: 15,
                }}
              />
            </View>

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
                  <Text variant="h3">Factura NFC lista</Text>
                  <Text variant="bodySmall" tone="muted">
                    Cobrarás {COP(getChargeAmount() || 0)} por {noteInput || 'Cobro FinGrow'}.
                  </Text>
                </View>
              </View>
              <Text variant="micro" tone="muted">
                No compartimos PIN ni token por NFC. Solo compartimos monto, referencia y
                receptor. El pagador confirma desde su propia sesión.
              </Text>
            </View>

            <PressableScale
              onPress={startCharge}
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
                Activar factura NFC
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

        {mode === 'pay' && status === 'idle' ? (
          <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            style={{ marginTop: 12, gap: 18 }}
          >
            <Text variant="body" tone="muted">
              Abre este modo frente al cobrador. Al leer la factura NFC, confirmamos con tu sesión:
              se descuenta de tu billetera y se acredita al receptor.
            </Text>
            <View
              style={{
                padding: 18,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.surface,
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
                    backgroundColor: theme.colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CreditCard size={24} color={theme.colors.primaryDark} strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="h3">Pagar factura NFC</Text>
                  <Text variant="bodySmall" tone="muted">
                    Acerca tu celular al cobrador para leer el cobro.
                  </Text>
                </View>
              </View>
            </View>

            <PressableScale
              onPress={startPayCharge}
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
                Leer y pagar NFC
              </Text>
              <CreditCard size={20} color="#0E0F0E" />
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
                <Radio size={38} color="#0E0F0E" strokeWidth={2.4} />
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
