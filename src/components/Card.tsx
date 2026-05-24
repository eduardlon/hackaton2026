import { MotiView } from 'moti';
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type Props = ViewProps & {
  children: ReactNode;
  padded?: boolean;
  variant?: 'default' | 'alt' | 'outline';
  delay?: number;
  animated?: boolean;
};

export function Card({
  children,
  padded = true,
  variant = 'default',
  delay = 0,
  animated = true,
  style,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const bg =
    variant === 'alt'
      ? theme.colors.surfaceAlt
      : variant === 'outline'
        ? 'transparent'
        : theme.colors.surface;

  const containerStyle: ViewStyle = {
    backgroundColor: bg,
    borderRadius: theme.radii.xl,
    padding: padded ? theme.spacing.lg : 0,
    borderWidth: variant === 'outline' ? 1 : theme.mode === 'dark' ? StyleSheet.hairlineWidth : 0,
    borderColor: variant === 'outline' ? theme.colors.border : theme.colors.borderSoft,
    ...theme.shadows.sm,
  };

  if (!animated) {
    return (
      <View style={[containerStyle, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 320, delay }}
      style={[containerStyle, style]}
      {...rest}
    >
      {children}
    </MotiView>
  );
}
