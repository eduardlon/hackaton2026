import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { CreditCard, Radio, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, View, type AppStateStatus } from 'react-native';

import {
  confirmPaymentRequest,
  getPaymentRequest,
  type PaymentRequestDetails,
  type PaymentRequestNfcToken,
} from '@/services/api';
import {
  isNfcAvailable,
  onEmulationStateChange,
  startListeningForTransfer,
  stopListeningForTransfer,
} from '@/services/nfc';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

const COP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

export function NfcChargeDetector() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [token, setToken] = useState<PaymentRequestNfcToken | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequestDetails | null>(null);
  const [status, setStatus] = useState<'idle' | 'confirming' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  // Pausamos el reader mode si nuestro propio celular est? emitiendo un cobro
  // (HCE). Reader mode y card emulation no pueden coexistir de forma confiable
  // en el mismo NFC controller.
  const [isEmulating, setIsEmulating] = useState(false);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  const lastTokenRef = useRef<string | null>(null);

  // Suscripci?n al estado global de emulaci?n HCE.
  useEffect(() => {
    return onEmulationStateChange((emulating) => {
      setIsEmulating(emulating);
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  // La app SIEMPRE est? en modo lectura cuando hay sesi?n, excepto cuando:
  // - hay un token mostr?ndose
  // - el usuario est? en la pantalla de cobro NFC (esa pantalla maneja sus
  //   propios listeners y, si est? emitiendo, ya activ? HCE)
  // - el usuario a?n no est? autenticado
  // - nuestro propio celular est? emulando (HCE activo)
  const shouldListen =
    isAuthenticated &&
    Boolean(user?.id) &&
    appState === 'active' &&
    !token &&
    !isEmulating &&
    !pathname.includes('nfc-transfer') &&
    !pathname.includes('(auth)');

  useEffect(() => {
    let cancelled = false;

    async function startAutoDetection() {
      if (!shouldListen) return;

      const available = await isNfcAvailable();
      if (!available || cancelled) return;

      stopRef.current = await startListeningForTransfer(
        async (nextToken) => {
          if (cancelled) return;
          if (lastTokenRef.current === nextToken.token) return;

          lastTokenRef.current = nextToken.token;
          await stopListeningForTransfer();
          stopRef.current = null;
          setToken(nextToken);
          setStatus('idle');
          setMessage('Validando solicitud de pago...');
          try {
            const details = await getPaymentRequest({ token: nextToken.token });
            if (details.receiver.id === user?.id) {
              setToken(null);
              setPaymentRequest(null);
              setMessage('');
              return;
            }
            setPaymentRequest(details);
            setMessage('');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          } catch (error) {
            setStatus('error');
            setMessage(error instanceof Error ? error.message : 'Token NFC inv?lido o vencido.');
          }
        },
        () => {
          // Silencioso: el detector autom?tico no debe molestar si NFC falla.
        }
      );
    }

    startAutoDetection().catch(() => {});

    return () => {
      cancelled = true;
      stopRef.current?.().catch(() => {});
      stopRef.current = null;
    };
  }, [token, pathname, shouldListen, user?.id, isEmulating, appState]);

  const close = () => {
    setToken(null);
    setPaymentRequest(null);
    setStatus('idle');
    setMessage('');
  };

  const confirmPayment = async () => {
    if (!token || !paymentRequest || status === 'confirming') return;

    setStatus('confirming');
    setMessage('Confirmando pago NFC...');
    try {
      const result = await confirmPaymentRequest({
        token: token.token,
        confirmedByUser: true,
        confirmationMethod: 'button',
      });
      setStatus('success');
      setMessage(
        `Pagaste ${COP(result.amount)} a ${result.to.name}. Nuevo saldo: ${COP(
          result.payerWallet?.currentBalance ?? 0
        )}.`
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(close, 1700);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'No se pudo confirmar el pago NFC.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  return (
    <Modal visible={Boolean(token)} transparent animationType="fade" onRequestClose={close}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      >
        <View
          style={{
            margin: 16,
            padding: 18,
            borderRadius: theme.radii.xxl,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
            gap: 16,
            ...theme.shadows.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                <Radio size={20} color={theme.colors.primaryDark} strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Cobro NFC detectado</Text>
                <Text variant="micro" tone="muted">
                  Confirma antes de descontar dinero de tu billetera.
                </Text>
              </View>
            </View>
            <PressableScale
              onPress={close}
              disabled={status === 'confirming'}
              haptic="light"
              scaleTo={0.9}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              <X size={16} color={theme.colors.textMuted} />
            </PressableScale>
          </View>

          {paymentRequest ? (
            <View
              style={{
                padding: 16,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.primarySoft,
                gap: 8,
              }}
            >
              <Text variant="micro" tone="muted">Te cobra</Text>
              <Text variant="h2">{paymentRequest.receiver.name}</Text>
              <Text variant="micro" tone="muted">Valor</Text>
              <Text variant="h1">{COP(paymentRequest.amount)}</Text>
              <Text variant="micro" tone="muted">Concepto</Text>
              <Text variant="bodySmall">{paymentRequest.note || 'Cobro FinGrow'}</Text>
              <Text variant="micro" tone="muted">
                Expira: {new Date(paymentRequest.expiresAt).toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ) : null}

          {message ? (
            <Text variant="bodySmall" tone={status === 'error' ? 'danger' : 'muted'} align="center">
              {message}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PressableScale
              onPress={close}
              disabled={status === 'confirming'}
              haptic="light"
              style={{
                flex: 1,
                height: 54,
                borderRadius: theme.radii.xl,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: theme.colors.border,
                opacity: status === 'confirming' ? 0.5 : 1,
              }}
            >
              <Text tone="muted">Cancelar</Text>
            </PressableScale>
            <PressableScale
              onPress={confirmPayment}
              disabled={!paymentRequest || status === 'confirming' || status === 'success'}
              haptic="medium"
              style={{
                flex: 1.35,
                height: 54,
                borderRadius: theme.radii.xl,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                backgroundColor: theme.colors.primary,
                opacity: status === 'success' ? 0.75 : 1,
              }}
            >
              {status === 'confirming' ? (
                <ActivityIndicator color="#0E0F0E" />
              ) : (
                <CreditCard size={18} color="#0E0F0E" strokeWidth={2.4} />
              )}
              <Text style={{ fontFamily: 'Inter_700Bold', color: '#0E0F0E' }}>
                Confirmar pago
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}
