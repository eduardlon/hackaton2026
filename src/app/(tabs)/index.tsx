import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Header, ScreenContainer } from '@/components';
import { AIInsightCard } from '@/components/home/AIInsightCard';
import { CreditMiniCard } from '@/components/home/CreditMiniCard';
import { QuickActions } from '@/components/home/QuickActions';
import { SummaryCard } from '@/components/home/SummaryCard';
import {
  getCredit,
  getWallet,
  askFinancialChat,
  confirmBillPaymentFromInvoice,
  processInvoiceDemo,
  recordFinancialActivity,
} from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import type {
  Credit,
  Wallet,
} from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const runAction = async (label: string, task: () => Promise<void>) => {
    if (actionLoading) return;
    setActionLoading(label);
    try {
      await task();
    } catch (error) {
      Alert.alert('No pudimos completar la acción', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegisterIncome = () => {
    Alert.alert('Registrar ingreso', 'Agregaremos un ingreso demo de $300.000 a tu billetera.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Registrar',
        onPress: () => {
          runAction('Registrando ingreso…', async () => {
            const result = await recordFinancialActivity({
              type: 'income',
              amount: 300000,
              category: 'Ingresos',
              description: 'Ingreso registrado desde Inicio',
            });
            await loadHome();
            Alert.alert('Ingreso registrado', `Tu Pasaporte sumó +${result.passportUpdate.pointsAdded} puntos.`);
          });
        },
      },
    ]);
  };

  const handleRegisterSale = () => {
    Alert.alert('Registrar venta', 'Agregaremos una venta demo de $150.000 a tu negocio.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Registrar',
        onPress: () => {
          runAction('Registrando venta…', async () => {
            const result = await recordFinancialActivity({
              type: 'sale',
              amount: 150000,
              category: 'Ventas',
              description: 'Venta registrada desde Inicio',
            });
            await loadHome();
            Alert.alert('Venta registrada', `Tu Pasaporte sumó +${result.passportUpdate.pointsAdded} puntos.`);
          });
        },
      },
    ]);
  };

  const handlePayWithPhoto = () => {
    runAction('Analizando factura…', async () => {
      const invoice = await processInvoiceDemo();
      const { extracted } = invoice;
      Alert.alert(
        'Factura detectada',
        `${extracted.provider ?? 'Proveedor'}\nValor: $${(extracted.amount ?? 0).toLocaleString('es-CO')}\nReferencia: ${extracted.reference ?? 'requiere revisión'}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Pagar',
            onPress: () => {
              runAction('Pagando factura…', async () => {
                const result = await confirmBillPaymentFromInvoice(invoice);
                await loadHome();
                Alert.alert(
                  'Pago exitoso',
                  `Pagaste ${result.payment.provider} y tu Pasaporte sumó +${result.passportUpdate.pointsAdded} puntos.`
                );
              });
            },
          },
        ]
      );
    });
  };

  const handleAskAI = () => {
    runAction('Consultando IA…', async () => {
      const result = await askFinancialChat('¿Puedo pedir $2.000.000 para mi negocio?');
      Alert.alert('IA financiera', result.answer, [
        { text: 'Cerrar' },
        { text: 'Ver análisis', onPress: () => router.push('/(tabs)/analisis') },
      ]);
    });
  };

  const handleQuickAction = (label: string) => {
    if (label.includes('ingreso')) return handleRegisterIncome();
    if (label.includes('venta')) return handleRegisterSale();
    if (label.includes('foto')) return handlePayWithPhoto();
    if (label.includes('IA')) return handleAskAI();
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
          />
        ) : null}

        <QuickActions delay={280} onAction={handleQuickAction} />

        {actionLoading ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 6 }}>
            <ActivityIndicator />
          </View>
        ) : null}

        <AIInsightCard
          delay={360}
          message="Tus ingresos se han mantenido estables. Puedes asumir una cuota de hasta $250.000 sin afectar tu flujo."
          onPress={() => router.push('/(tabs)/analisis')}
        />

      </View>
    </ScreenContainer>
  );
}
