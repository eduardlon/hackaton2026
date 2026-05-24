import { type ComponentType } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  size?: number;
  tone?: 'primary' | 'success' | 'danger' | 'warn' | 'neutral';
  background?: string;
  color?: string;
};

export function IconCircle({ Icon, size = 40, tone = 'primary', background, color }: Props) {
  const { theme } = useTheme();
  const toneMap = {
    primary: { bg: theme.colors.primarySoft, fg: theme.colors.primaryDark },
    success: { bg: theme.colors.successSoft, fg: theme.colors.success },
    danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger },
    warn: { bg: theme.colors.warnSoft, fg: theme.colors.warn },
    neutral: { bg: theme.colors.surfaceAlt, fg: theme.colors.textMuted },
  } as const;
  const { bg, fg } = toneMap[tone];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background ?? bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={Math.round(size * 0.45)} color={color ?? fg} strokeWidth={2} />
    </View>
  );
}
