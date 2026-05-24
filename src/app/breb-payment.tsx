import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, BadgeCheck, Building2, Send } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, PressableScale, Text } from '@/components';
import { payBreb } from '@/services/api';
import { useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

const DEFAULT_RECIPIENT = 'Comercio Bre-B';

export default function BrebPaymentScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [amountText, setAmountText] = useState('');
  const [recipient, setRecipient] = useState(DEFAULT_RECIPIENT);
  const [loading, setLoading] = useState(false);

  const amount = Number(amountText.replace(/\D/g, ''));

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const submit = async () => {
    if (!amount || amount < 1000) {
      Alert.alert('Monto inválido', 'El pago mínimo por Bre-B es $1.000.');
      return;
    }
    setLoading(true);
    try {
      const result = await payBreb({
        amount,
        recipient: recipient.trim() || DEFAULT_RECIPIENT,
        note: 'Pago desde FinGrow por Bre-B',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Pago enviado',
        `Pagaste ${formatMoney(result.payment.amount)} a ${result.payment.recipient}.\nReferencia: ${result.payment.reference}`,
        [{ text: 'Listo', onPress: close }]
      );
    } catch (error) {
      Alert.alert('No pudimos enviar el pago', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
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
        <Text variant="h3">Pagar por Bre-B</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        <Card padded delay={0} style={{ padding: 18, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={23} color={theme.colors.primaryDark} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h2">Transferencia inmediata</Text>
              <Text variant="bodySmall" tone="muted">
                Envía dinero por Bre-B desde tu saldo disponible.
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text variant="micro" tone="muted">
              Destinatario o comercio
            </Text>
            <View
              style={{
                minHeight: 56,
                borderRadius: theme.radii.lg,
                borderWidth: 1.5,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surfaceAlt,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 14,
              }}
            >
              <Building2 size={18} color={theme.colors.textMuted} />
              <TextInput
                value={recipient}
                onChangeText={setRecipient}
                placeholder="Alias, comercio o celular"
                placeholderTextColor={theme.colors.textSoft}
                style={{ flex: 1, color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }}
              />
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text variant="micro" tone="muted">
              Valor a pagar
            </Text>
            <View
              style={{
                height: 70,
                borderRadius: theme.radii.xl,
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
              }}
            >
              <Text variant="h2">$</Text>
              <TextInput
                value={amountText}
                onChangeText={(value) => setAmountText(value.replace(/\D/g, '').slice(0, 9))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={theme.colors.textSoft}
                style={{
                  flex: 1,
                  color: theme.colors.text,
                  fontSize: 32,
                  fontFamily: 'Inter_700Bold',
                }}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <BadgeCheck size={16} color={theme.colors.primaryDark} />
            <Text variant="micro" style={{ color: theme.colors.primaryDark, flex: 1 }}>
              El pago se procesa contra InsForge y queda asociado a tu sesión actual.
            </Text>
          </View>
        </Card>

        <PressableScale
          onPress={submit}
          disabled={loading}
          haptic="medium"
          scaleTo={0.97}
          style={{
            height: 60,
            borderRadius: theme.radii.xl,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 10,
            opacity: loading ? 0.7 : 1,
            backgroundColor: theme.colors.primary,
            ...theme.shadows.sm,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#0E0F0E" />
          ) : (
            <>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: '#0E0F0E' }}>
                Enviar pago Bre-B
              </Text>
              <Send size={20} color="#0E0F0E" />
            </>
          )}
        </PressableScale>
      </View>
    </View>
  );
}
