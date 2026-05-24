import * as Haptics from 'expo-haptics';
import { type ReactNode, useCallback } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = Omit<PressableProps, 'children'> & {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  scaleTo?: number;
  haptic?: 'none' | 'selection' | 'light' | 'medium' | 'heavy';
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  haptic = 'selection',
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      scale.value = withTiming(scaleTo, { duration: 120 });
      onPressIn?.(e);
    },
    [onPressIn, scale, scaleTo]
  );

  const handlePressOut = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      scale.value = withTiming(1, { duration: 140 });
      onPressOut?.(e);
    },
    [onPressOut, scale]
  );

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
      if (haptic !== 'none') {
        try {
          if (haptic === 'selection') Haptics.selectionAsync();
          else if (haptic === 'light')
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          else if (haptic === 'medium')
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          else if (haptic === 'heavy')
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch {
          // no-op
        }
      }
      onPress?.(e);
    },
    [haptic, onPress]
  );

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[animatedStyle, style as ViewStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
