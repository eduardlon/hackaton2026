import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
};

export function Sparkline({
  data,
  width = 160,
  height = 60,
  stroke,
  fill,
}: Props) {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();

  const { strokePath, fillPath, lastPoint, total } = useMemo(() => {
    if (!data.length) {
      return { strokePath: '', fillPath: '', lastPoint: { x: 0, y: 0 }, total: 0 };
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 8) - 4;
      return { x, y };
    });
    const sp = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ');
    const fp = `${sp} L ${width} ${height} L 0 ${height} Z`;

    // total length approx
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      len += Math.hypot(dx, dy);
    }

    return {
      strokePath: sp,
      fillPath: fp,
      lastPoint: points[points.length - 1],
      total: len,
    };
  }, [data, width, height]);

  const offset = useSharedValue(total);

  useEffect(() => {
    if (reduceMotion) {
      offset.value = 0;
    } else {
      offset.value = total;
      offset.value = withTiming(0, { duration: 900, easing: theme.motion.easeOut });
    }
  }, [total, offset, reduceMotion, theme.motion.easeOut]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  const strokeColor = stroke ?? theme.colors.primary;
  const fillColor = fill ?? theme.colors.primary;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fillColor} stopOpacity="0.35" />
            <Stop offset="1" stopColor={fillColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={fillPath} fill="url(#spark-fill)" />
        <AnimatedPath
          d={strokePath}
          stroke={strokeColor}
          strokeWidth={2.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={total}
          animatedProps={animatedProps}
        />
        <Circle cx={lastPoint.x} cy={lastPoint.y} r={3.5} fill={strokeColor} />
        <Circle cx={lastPoint.x} cy={lastPoint.y} r={6} fill={strokeColor} opacity={0.25} />
      </Svg>
    </View>
  );
}
