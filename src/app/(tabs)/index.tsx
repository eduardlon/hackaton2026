import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Header, ScreenContainer } from '@/components';
import { AIInsightCard } from '@/components/home/AIInsightCard';
import { CreditMiniCard } from '@/components/home/CreditMiniCard';
import { PassportCard } from '@/components/home/PassportCard';
import { QuickActions } from '@/components/home/QuickActions';
import { RecentMovesCard } from '@/components/home/RecentMovesCard';
import { SummaryCard } from '@/components/home/SummaryCard';
import { UpcomingPaymentsCard } from '@/components/home/UpcomingPaymentsCard';
import {
  getCredit,
  getPassport,
  getTransactions,
  getUpcomingPayments,
  getWallet,
} from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import type {
  Credit,
  Passport,
  Transaction,
  UpcomingPayment,
  Wallet,
} from '@/types';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [payments, setPayments] = useState<UpcomingPayment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    (async () => {
      const [w, c, p, up, tx] = await Promise.all([
        getWallet(),
        getCredit(),
        getPassport(),
        getUpcomingPayments(),
        getTransactions(),
      ]);
      setWallet(w);
      setCredit(c);
      setPassport(p);
      setPayments(up);
      setTransactions(tx);
    })();
  }, []);

  return (
    <ScreenContainer hasTabBar>
      <Header
        title="FinGrow"
        subtitle={`Bienvenido${user ? ' de nuevo' : ''} 👋`}
        notifications={4}
      />

      <View style={{ gap: 14 }}>
        {wallet ? <SummaryCard wallet={wallet} delay={0} /> : null}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {credit ? (
            <CreditMiniCard
              credit={credit}
              delay={120}
              onSimulate={() => router.push('/(tabs)/credito')}
            />
          ) : null}
          {passport ? <PassportCard passport={passport} delay={200} /> : null}
        </View>

        <QuickActions delay={280} />

        <AIInsightCard
          delay={360}
          message="Tus ingresos se han mantenido estables. Puedes asumir una cuota de hasta $250.000 sin afectar tu flujo."
          onPress={() => router.push('/(tabs)/analisis')}
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <UpcomingPaymentsCard
            delay={440}
            payments={payments}
            onSeeAll={() => router.push('/(tabs)/movimientos')}
          />
          <RecentMovesCard
            delay={520}
            transactions={transactions}
            onSeeAll={() => router.push('/(tabs)/movimientos')}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
