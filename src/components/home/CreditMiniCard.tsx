import { Calendar, Landmark, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { Badge, Card, PrimaryButton, ProgressBar, Text } from '@/components';
import { useTheme } from '@/theme';
import type { Credit } from '@/types';
import { formatMoney } from '@/utils/format';

type Props = {
  credit: Credit;
  delay?: number;
  onSimulate?: () => void;
  onRepay?: () => void;
};

export function CreditMiniCard({ credit, delay = 0, onSimulate, onRepay }: Props) {
  const { theme } = useTheme();
  const activeLoan = credit.activeLoan;

  if (activeLoan && activeLoan.status === 'active') {
    return (
      <Card delay={delay} padded style={{ padding: 18, gap: 16, width: '100%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text variant="h3">Crédito activo</Text>
            <Text variant="micro" tone="muted">
              Avance de tus abonos
            </Text>
          </View>
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
            Saldo pendiente
          </Text>
          <Text variant="h1" tone="primary">
            {formatMoney(activeLoan.outstandingBalance)}
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" tone="muted">
              Pagado {formatMoney(activeLoan.paidAmount)}
            </Text>
            <Text variant="caption" tone="primary">
              {Math.round(activeLoan.progressPercentage)}%
            </Text>
          </View>
          <ProgressBar value={activeLoan.progressPercentage} duration={900} delay={delay + 120} />
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="micro" tone="muted">
              Crédito tomado
            </Text>
            <Text variant="caption">{formatMoney(activeLoan.originalAmount)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="micro" tone="muted">
              Cuota sugerida
            </Text>
            <Text variant="caption">{formatMoney(activeLoan.nextPaymentAmount)}</Text>
          </View>
        </View>

        <Badge label="Al día" tone="primary" icon={ShieldCheck} />

        <PrimaryButton label="Abonar crédito" trailingArrow onPress={onRepay} />
      </Card>
    );
  }

  return (
    <Card delay={delay} padded style={{ padding: 18, gap: 16, width: '100%' }}>
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

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} color={theme.colors.textMuted} />
          <View>
            <Text variant="micro" tone="muted">
              Cuota segura
            </Text>
            <Text variant="caption">{formatMoney(credit.safeMonthlyPayment)}/mes</Text>
          </View>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
