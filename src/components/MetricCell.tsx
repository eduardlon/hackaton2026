import { type ComponentType } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { IconCircle } from './IconCircle';
import { Text } from './Text';

type Props = {
  label: string;
  value: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tone?: 'primary' | 'success' | 'danger' | 'warn' | 'neutral';
  trailing?: string;
  trailingTone?: 'success' | 'danger' | 'muted';
  align?: 'left' | 'center';
  style?: ViewStyle;
};

export function MetricCell({
  label,
  value,
  Icon,
  tone = 'primary',
  trailing,
  trailingTone = 'muted',
  align = 'left',
  style,
}: Props) {
  const { theme } = useTheme();
  const trailingToneMap = {
    success: theme.colors.success,
    danger: theme.colors.danger,
    muted: theme.colors.textMuted,
  };

  return (
    <View style={[{ alignItems: align === 'center' ? 'center' : 'flex-start', gap: 6 }, style]}>
      {Icon ? <IconCircle Icon={Icon} tone={tone} size={32} /> : null}
      <Text variant="micro" tone="muted">
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={1}>
        {value}
      </Text>
      {trailing ? (
        <Text variant="micro" style={{ color: trailingToneMap[trailingTone] }}>
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}
