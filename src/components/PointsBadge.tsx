import { MotiView } from 'moti';
import { Star } from 'lucide-react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

type Props = {
  value: number;
  delay?: number;
  withIcon?: boolean;
};

export function PointsBadge({ value, delay = 0, withIcon = false }: Props) {
  const { theme } = useTheme();
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.6, translateY: 6 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 12, stiffness: 220, delay }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: theme.colors.primarySoft,
        borderRadius: theme.radii.pill,
        alignSelf: 'flex-start',
      }}
    >
      {withIcon ? <Star size={11} color={theme.colors.primaryDark} fill={theme.colors.primaryDark} /> : null}
      <Text variant="micro" style={{ color: theme.colors.primaryDark }}>
        +{value} pts
      </Text>
    </MotiView>
  );
}
