import { type ComponentType } from 'react';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

export function ChipFilter({ label, active = false, onPress, icon: Icon }: Props) {
  const { theme } = useTheme();
  const bg = active ? theme.colors.primarySoft : theme.colors.surface;
  const fg = active ? theme.colors.primaryDark : theme.colors.textMuted;
  const border = active ? theme.colors.primary : theme.colors.border;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: theme.radii.pill,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      {Icon ? <Icon size={14} color={fg} strokeWidth={2.2} /> : null}
      <Text variant="caption" style={{ color: fg }}>
        {label}
      </Text>
    </PressableScale>
  );
}
