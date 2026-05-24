import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, View } from 'react-native';

import { Card, Header, PressableScale, ScreenContainer, Text } from '@/components';
import { AIInsightCard } from '@/components/home/AIInsightCard';
import { CreditMiniCard } from '@/components/home/CreditMiniCard';
import { SummaryCard } from '@/components/home/SummaryCard';
import { useFinancialRealtime } from '@/hooks/useFinancialRealtime';
import {
  getCredit,
  getWallet,
  repayCredit,
} from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';
import type {
  Credit,
  Wallet,
} from '@/types';
import { formatMoney } from '@/utils/format';

export default function HomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [repayMenuVisible, setRepayMenuVisible] = useState(false);
  const [repayLoadingAmount, setRepayLoadingAmount] = useState<number | null>(null);
  const realtimeUserId = user?.id ?? 'demo-user-001';

  const activeLoan = credit?.activeLoan?.status === 'active' ? credit.activeLoan : null;
  const repaymentOptions = activeLoan
    ? Array.from(
        new Set(
          [activeLoan.nextPaymentAmount, 100000, 200000, activeLoan.outstandingBalance]
            .map((amount) => Math.round(amount))
            .filter((amount) => amount > 0 && amount <= activeLoan.outstandingBalance)
        )
      )
    : [];

  const loadHome = async () => {
    const [w, c] = await Promise.all([
      getWallet(),
      getCredit(),
    ]);
    setWallet(w);
    setCredit(c);
  };

  useEffect(() => {
    loadHome();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [])
  );

  useFinancialRealtime(realtimeUserId, () => {
    loadHome();
  });

  const handleRepayCredit = async (amount: number) => {
    if (!wallet || !activeLoan) return;
    if (amount > wallet.balance) {
      Alert.alert('Saldo insuficiente', 'No tienes suficiente dinero disponible para hacer ese abono.');
      return;
    }

    setRepayLoadingAmount(amount);
    try {
      const result = await repayCredit(amount);
      await loadHome();
      setRepayMenuVisible(false);
      Alert.alert(
        'Abono aplicado',
        `Abonaste ${formatMoney(result.payment.amount)}. Tu nuevo saldo es ${formatMoney(result.wallet.currentBalance)}.`
      );
    } catch (error) {
      Alert.alert('No pudimos abonar el crédito', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setRepayLoadingAmount(null);
    }
  };

  return (
    <ScreenContainer hasTabBar>
      <Header
        title="FinGrow"
        subtitle={`Bienvenido${user ? ' de nuevo' : ''} 👋`}
        notifications={4}
        onNotificationPress={() => {
          Alert.alert('Notificaciones', 'Tienes 4 recordatorios: 2 facturas pendientes, 1 recomendación IA y 1 avance de Pasaporte.');
        }}
        onProfilePress={() => router.push('/(tabs)/perfil')}
      />

      <View style={{ gap: 14 }}>
        {wallet ? <SummaryCard wallet={wallet} delay={0} /> : null}

        {credit ? (
          <CreditMiniCard
            credit={credit}
            delay={120}
            onSimulate={() => router.push('/(tabs)/credito')}
            onRepay={() => setRepayMenuVisible(true)}
          />
        ) : null}

        <AIInsightCard
          delay={360}
          message="Tus ingresos se han mantenido estables. Puedes asumir una cuota de hasta $250.000 sin afectar tu flujo."
          onPress={() => router.push('/financial-agent')}
        />

      </View>

      <Modal
        visible={repayMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRepayMenuVisible(false)}
      >
        <Pressable
          onPress={() => setRepayMenuVisible(false)}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' }}
        >
          <Pressable style={{ padding: 16 }} onPress={() => {}}>
            <Card animated={false} padded style={{ padding: 20, gap: 16 }}>
              <View style={{ gap: 4 }}>
                <Text variant="h2">Abonar crédito</Text>
                <Text variant="bodySmall" tone="muted">
                  Elige cuánto quieres pagar. El abono se descuenta de tu saldo disponible.
                </Text>
              </View>

              {activeLoan ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="micro" tone="muted">
                      Debes
                    </Text>
                    <Text variant="bodyStrong">{formatMoney(activeLoan.outstandingBalance)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="micro" tone="muted">
                      Saldo actual
                    </Text>
                    <Text variant="bodyStrong">{formatMoney(wallet?.balance ?? 0)}</Text>
                  </View>
                </View>
              ) : null}

              <View style={{ gap: 10 }}>
                {repaymentOptions.map((amount) => {
                  const disabled = Boolean(repayLoadingAmount) || amount > (wallet?.balance ?? 0);
                  return (
                    <PressableScale
                      key={amount}
                      disabled={disabled}
                      onPress={() => handleRepayCredit(amount)}
                      haptic="light"
                      style={{
                        minHeight: 52,
                        borderRadius: theme.radii.lg,
                        paddingHorizontal: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: theme.colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: theme.colors.borderSoft,
                        opacity: disabled ? 0.55 : 1,
                      }}
                    >
                      <View>
                        <Text variant="bodyStrong">{formatMoney(amount)}</Text>
                        <Text variant="micro" tone="muted">
                          {activeLoan && amount === activeLoan.outstandingBalance ? 'Liquidar deuda' : 'Abono parcial'}
                        </Text>
                      </View>
                      {repayLoadingAmount === amount ? <ActivityIndicator /> : <Text variant="caption" tone="primary">Pagar</Text>}
                    </PressableScale>
                  );
                })}
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
