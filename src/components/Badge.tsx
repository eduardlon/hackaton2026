import { type ComponentType, type ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

type Tone = 'primary' | 'success' | 'warn' | 'danger' | 'neutral';

type Props = {
  label?: string;
  children?: ReactNode;
  tone?: Tone;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  size?: 'sm' | 'md';
};

export function Badge({ label, children, tone = 'primary', icon: Icon, size = 'sm' }: Props) {
  const { theme } = useTheme();

  const styles: Record<Tone, { bg: string; fg: string; border: string }> = {
    primary: {
      bg: theme.colors.primarySoft,
      fg: theme.colors.primaryDark,
      border: theme.mode === 'dark' ? theme.colors.primarySoft : theme.colors.primarySoft,
    },
    success: { bg: theme.colors.successSoft, fg: theme.colors.success, border: theme.colors.successSoft },
    warn: { bg: theme.colors.warnSoft, fg: theme.colors.warn, border: theme.colors.warnSoft },
    danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger, border: theme.colors.dangerSoft },
    neutral: { bg: theme.colors.surfaceAlt, fg: theme.colors.textMuted, border: theme.colors.border },
  };

  const s = styles[tone];
  const padH = size === 'md' ? 12 : 10;
  const padV = size === 'md' ? 6 : 4;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: padH,
        paddingVertical: padV,
        borderRadius: theme.radii.pill,
        backgroundColor: s.bg,
        borderWidth: 1,
        borderColor: s.border,
        alignSelf: 'flex-start',
      }}
    >
      {Icon ? <Icon size={12} color={s.fg} strokeWidth={2.4} /> : null}
      {label ? (
        <Text variant="caption" style={{ color: s.fg }}>
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
