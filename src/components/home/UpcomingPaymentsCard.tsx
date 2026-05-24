import { Home, Lightbulb, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, IconCircle, PressableScale, SectionTitle, Text } from '@/components';
import { useTheme } from '@/theme';
import type { UpcomingPayment } from '@/types';
import { formatMoney } from '@/utils/format';

const ICONS: Record<string, LucideIcon> = {
  Home,
  Lightbulb,
};

type Props = {
  delay?: number;
  payments: UpcomingPayment[];
  onSeeAll?: () => void;
};

export function UpcomingPaymentsCard({ delay = 0, payments, onSeeAll }: Props) {
  const { theme } = useTheme();
  return (
    <Card delay={delay} padded style={{ padding: 16, gap: 12, flex: 1 }}>
      <SectionTitle title="Próximos pagos" actionLabel="Ver todos" onActionPress={onSeeAll} />
      <View style={{ gap: 12 }}>
        {payments.map((p) => {
          const Icon = ICONS[p.icon] ?? Home;
          const statusTone = p.status === 'hoy' ? 'danger' : 'warn';
          const statusColor =
            p.status === 'hoy' ? theme.colors.danger : theme.colors.warn;
          return (
            <PressableScale key={p.id} scaleTo={0.98} haptic="selection">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <IconCircle Icon={Icon} tone={statusTone} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{p.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="caption">{formatMoney(p.amount)}</Text>
                    <Text variant="micro" style={{ color: statusColor }}>
                      {p.statusLabel}
                    </Text>
                  </View>
                  <Text variant="micro" tone="success">
                    +{p.pointsReward} puntos si pagas a tiempo
                  </Text>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Card>
  );
}
