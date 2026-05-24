import { ChevronRight, ShieldCheck, Trophy } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, PointsBadge, PressableScale, ProgressBar, Text } from '@/components';
import { useTheme } from '@/theme';
import type { Passport } from '@/types';

type Props = {
  passport: Passport;
  delay?: number;
  onPress?: () => void;
};

export function PassportCard({ passport, delay = 0, onPress }: Props) {
  const { theme } = useTheme();
  const pct = Math.round((passport.points / passport.nextLevel) * 100);

  return (
    <Card delay={delay} padded style={{ padding: 18, gap: 14, flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h3">Pasaporte Financiero</Text>
        <PressableScale onPress={onPress} scaleTo={0.94}>
          <ChevronRight size={18} color={theme.colors.textMuted} />
        </PressableScale>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldCheck size={22} color={theme.colors.primaryDark} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{passport.levelName}</Text>
          <Text variant="micro" tone="muted">
            {passport.points} / {passport.nextLevel} puntos
          </Text>
        </View>
      </View>

      <ProgressBar value={pct} duration={900} delay={delay + 200} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Trophy size={12} color={theme.colors.textMuted} />
        <Text variant="micro" tone="muted" style={{ flexShrink: 1 }}>
          Próximo beneficio: {passport.nextBenefit}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <PointsBadge value={passport.monthlyPoints} delay={delay + 400} withIcon />
        <Text variant="micro" tone="muted">
          por pagos a tiempo
        </Text>
      </View>
    </Card>
  );
}
