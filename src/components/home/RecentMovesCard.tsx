import { Droplet, ShoppingCart, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, IconCircle, PointsBadge, PressableScale, SectionTitle, Text } from '@/components';
import type { Transaction } from '@/types';
import { formatMoney } from '@/utils/format';

const ICONS: Record<string, LucideIcon> = {
  Droplet,
  ShoppingCart,
};

type Props = {
  delay?: number;
  transactions: Transaction[];
  onSeeAll?: () => void;
};

export function RecentMovesCard({ delay = 0, transactions, onSeeAll }: Props) {
  return (
    <Card delay={delay} padded style={{ padding: 16, gap: 12, flex: 1 }}>
      <SectionTitle title="Últimos movimientos" actionLabel="Ver todos" onActionPress={onSeeAll} />
      <View style={{ gap: 12 }}>
        {transactions.slice(0, 2).map((t, i) => {
          const Icon = ICONS[t.icon] ?? Droplet;
          return (
            <PressableScale key={t.id} scaleTo={0.98} haptic="selection">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <IconCircle Icon={Icon} tone={t.amount < 0 ? 'neutral' : 'success'} size={36} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text variant="micro" tone="muted">
                    {i === 0 ? 'Hoy' : 'Ayer'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="bodyStrong" tone={t.amount < 0 ? 'expense' : 'income'}>
                    {formatMoney(t.amount, { sign: true })}
                  </Text>
                  {t.points > 0 ? <PointsBadge value={t.points} delay={i * 100} /> : null}
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Card>
  );
}
