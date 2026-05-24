import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

import { Text } from './Text';

type Size = 'sm' | 'md' | 'lg';

const sizes: Record<Size, { icon: number; wordmark: number; tagline: number; gap: number }> = {
  sm: { icon: 36, wordmark: 22, tagline: 10, gap: 8 },
  md: { icon: 52, wordmark: 30, tagline: 11, gap: 10 },
  lg: { icon: 72, wordmark: 42, tagline: 12, gap: 12 },
};

/**
 * Logotipo oficial de FinGrow:
 *  - escudo con flecha ascendente + barras de crecimiento
 *  - wordmark "Fin" en negro + "Grow" en verde
 *  - tagline: "Haz crecer tu futuro financiero"
 */
export function FinGrowLogo({
  size = 'md',
  showTagline = true,
  showWordmark = true,
}: {
  size?: Size;
  showTagline?: boolean;
  showWordmark?: boolean;
}) {
  const { theme } = useTheme();
  const s = sizes[size];
  const green = theme.colors.primaryDark;
  const greenLight = theme.colors.primary;
  const ink = theme.colors.text;

  return (
    <View style={{ alignItems: 'center', gap: s.gap }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.gap + 4 }}>
        {/* Ícono escudo + flecha + barras */}
        <Svg width={s.icon} height={s.icon} viewBox="0 0 64 64">
          {/* Escudo */}
          <Path
            d="M32 4 L56 12 V32 C56 46 44 56 32 60 C20 56 8 46 8 32 V12 Z"
            fill={ink}
          />
          <Path
            d="M32 9 L51 15.5 V31 C51 43 41 51.5 32 55 C23 51.5 13 43 13 31 V15.5 Z"
            fill={theme.colors.bg}
          />
          {/* Barras de crecimiento */}
          <Rect x="18" y="36" width="6" height="10" rx="1.5" fill={ink} />
          <Rect x="26" y="30" width="6" height="16" rx="1.5" fill={greenLight} />
          <Rect x="34" y="22" width="6" height="24" rx="1.5" fill={green} />
          {/* Flecha ascendente */}
          <Path
            d="M44 38 L44 18 L36 18 M44 18 L28 34"
            stroke={green}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>

        {showWordmark ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: s.wordmark,
                  lineHeight: s.wordmark * 1.05,
                  color: ink,
                }}
              >
                Fin
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter_700Bold',
                  fontSize: s.wordmark,
                  lineHeight: s.wordmark * 1.05,
                  color: green,
                }}
              >
                Grow
              </Text>
            </View>
            {showTagline ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View
                  style={{ width: 14, height: 1.5, backgroundColor: green, borderRadius: 1 }}
                />
                <Text
                  style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: s.tagline,
                    color: theme.colors.textMuted,
                    letterSpacing: 0.1,
                  }}
                >
                  Haz crecer tu futuro financiero
                </Text>
                <View
                  style={{ width: 14, height: 1.5, backgroundColor: green, borderRadius: 1 }}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
