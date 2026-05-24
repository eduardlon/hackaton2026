import { ArrowRight } from 'lucide-react-native';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  trailingArrow?: boolean;
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
  size?: 'md' | 'lg';
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon: Icon,
  trailingArrow = false,
  variant = 'primary',
  fullWidth = true,
  size = 'md',
  style,
}: Props) {
  const { theme } = useTheme();
  const isSecondary = variant === 'secondary';

  const height = size === 'lg' ? 56 : 48;
  const padH = theme.spacing.xl;

  const bg = isSecondary ? 'transparent' : theme.colors.primary;
  const borderColor = isSecondary ? theme.colors.primary : 'transparent';
  const textTone = isSecondary ? 'primary' : 'default';
  const iconColor = isSecondary ? theme.colors.primaryDark : '#0E0F0E';

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic="light"
      style={{
        height,
        paddingHorizontal: padH,
        backgroundColor: bg,
        borderColor,
        borderWidth: isSecondary ? 1.5 : 0,
        borderRadius: theme.radii.lg,
        opacity: disabled ? 0.5 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        ...(isSecondary ? {} : theme.shadows.sm),
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {Icon ? <Icon size={18} color={iconColor} strokeWidth={2} /> : null}
          <Text variant="bodyStrong" tone={textTone} style={{ color: isSecondary ? theme.colors.primaryDark : '#0E0F0E' }}>
            {label}
          </Text>
          {trailingArrow ? (
            <View style={{ marginLeft: 4 }}>
              <ArrowRight size={18} color={iconColor} strokeWidth={2.2} />
            </View>
          ) : null}
        </>
      )}
    </PressableScale>
  );
}
