import { MotiView } from 'moti';
import { Children, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  delayStep?: number;
  initialDelay?: number;
  gap?: number;
  style?: ViewStyle;
};

export function StaggeredList({
  children,
  delayStep = 80,
  initialDelay = 0,
  gap = 14,
  style,
}: Props) {
  return (
    <View style={[{ gap }, style]}>
      {Children.map(children, (child, index) =>
        child == null ? null : (
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{
              type: 'timing',
              duration: 320,
              delay: initialDelay + index * delayStep,
            }}
          >
            {child}
          </MotiView>
        )
      )}
    </View>
  );
}
