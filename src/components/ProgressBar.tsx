import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTheme } from '@/theme';

type Props = {
  value: number; // 0-100
  height?: number;
  color?: string;
  trackColor?: string;
  duration?: number;
  delay?: number;
};

export function ProgressBar({ value, height = 8, color, trackColor, duration = 700, delay = 0 }: Props) {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, value));
    if (reduceMotion) {
      progress.value = target;
    } else {
      progress.value = withDelay(
        delay,
        withTiming(target, { duration, easing: theme.motion.easeOut })
      );
    }
  }, [value, duration, delay, progress, reduceMotion, theme.motion.easeOut]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%`,
  }));

  return (
    <View
      style={{
        height,
        width: '100%',
        backgroundColor: trackColor ?? theme.colors.surfaceAlt,
        borderRadius: height,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          fillStyle,
          {
            height: '100%',
            backgroundColor: color ?? theme.colors.primary,
            borderRadius: height,
          },
        ]}
      />
    </View>
  );
}
