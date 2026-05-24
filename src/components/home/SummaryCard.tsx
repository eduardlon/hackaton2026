import { ArrowDownRight, ArrowUpRight, CircleDollarSign, HeartPulse } from 'lucide-react-native';
import { View } from 'react-native';

import { Badge, Card, MetricCell, Sparkline, Text } from '@/components';
import { useTheme } from '@/theme';
import type { Wallet } from '@/types';
import { formatMoney } from '@/utils/format';

type Props = {
  wallet: Wallet;
  delay?: number;
};

export function SummaryCard({ wallet, delay = 0 }: Props) {
  const { theme } = useTheme();

  return (
    <Card delay={delay} padded style={{ padding: 20, gap: 14 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text variant="h3">Resumen General</Text>
        <Badge label="Flujo saludable" tone="primary" icon={HeartPulse} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text variant="bodySmall" tone="muted">
            Saldo disponible
          </Text>
          <Text variant="display" numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(wallet.balance)}
          </Text>
        </View>
        <Sparkline data={wallet.sparkline} width={120} height={56} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 12,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSoft,
        }}
      >
        <MetricCell
          label="Ingresos del mes"
          value={formatMoney(wallet.monthlyIncome)}
          Icon={ArrowUpRight}
          tone="success"
          style={{ flex: 1 }}
        />
        <MetricCell
          label="Gastos del mes"
          value={formatMoney(wallet.monthlyExpenses)}
          Icon={ArrowDownRight}
          tone="danger"
          style={{ flex: 1 }}
        />
        <MetricCell
          label="Margen libre"
          value={formatMoney(wallet.freeMargin)}
          Icon={CircleDollarSign}
          tone="primary"
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}
