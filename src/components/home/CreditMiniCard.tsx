import { Calendar, Landmark, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { Badge, Card, PrimaryButton, Text } from '@/components';
import { useTheme } from '@/theme';
import type { Credit } from '@/types';
import { formatMoney } from '@/utils/format';

type Props = {
  credit: Credit;
  delay?: number;
  onSimulate?: () => void;
};

export function CreditMiniCard({ credit, delay = 0, onSimulate }: Props) {
  const { theme } = useTheme();

  return (
    <Card delay={delay} padded style={{ padding: 18, gap: 14, flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h3">Crédito estimado</Text>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Landmark size={18} color={theme.colors.primaryDark} strokeWidth={2} />
        </View>
      </View>

      <View>
        <Text variant="bodySmall" tone="muted">
          Hasta
        </Text>
        <Text variant="h1" tone="primary">
          {formatMoney(credit.estimatedAmount)}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} color={theme.colors.textMuted} />
          <View>
            <Text variant="micro" tone="muted">
              Cuota segura
            </Text>
            <Text variant="caption">{formatMoney(credit.safeMonthlyPayment)}/mes</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={14} color={theme.colors.textMuted} />
          <View>
            <Text variant="micro" tone="muted">
              Riesgo
            </Text>
            <Text variant="caption">{credit.risk}</Text>
          </View>
        </View>
      </View>

      <Badge label={credit.level} tone="primary" icon={ShieldCheck} />

      <PrimaryButton label="Simular crédito" trailingArrow onPress={onSimulate} />
    </Card>
  );
}
