import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Props = {
  value: boolean;
  onValueChange?: (v: boolean) => void;
  disabled?: boolean;
};

export function Switch({ value, onValueChange, disabled = false }: Props) {
  const { theme } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 220 });
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? theme.colors.primary : theme.colors.surfaceAlt,
    borderColor: progress.value > 0.5 ? theme.colors.primary : theme.colors.border,
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 2 + progress.value * 22 }, { scale: withSpring(value ? 1 : 0.95) }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          {
            width: 50,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            justifyContent: 'center',
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#FFFFFF',
            },
            knobStyle,
            theme.shadows.sm,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
