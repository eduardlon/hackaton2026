import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * Decoraciones sutiles para pantallas de auth: arcos verdes muy suaves
 * y hojas decorativas hacia el lateral derecho. Posición absoluta,
 * `pointerEvents="none"` para no bloquear toques.
 */
export function AuthBackgroundDecorations() {
  const { theme } = useTheme();
  const tint = theme.colors.primarySoft;
  const tintDarker = theme.colors.primary;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Arcos superiores izquierda */}
      <Svg
        width={220}
        height={220}
        viewBox="0 0 220 220"
        style={{ position: 'absolute', top: -40, left: -60, opacity: 0.7 }}
      >
        <Circle cx="110" cy="110" r="100" stroke={tint} strokeWidth={1.5} fill="none" />
        <Circle cx="110" cy="110" r="70" stroke={tint} strokeWidth={1} fill="none" />
        <Circle cx="100" cy="100" r="3" fill={tintDarker} opacity={0.5} />
      </Svg>

      {/* Hojas derecha */}
      <Svg
        width={180}
        height={420}
        viewBox="0 0 180 420"
        style={{ position: 'absolute', top: 60, right: -30, opacity: 0.35 }}
      >
        {/* Tallo principal */}
        <Path
          d="M120 0 C 100 80, 130 150, 105 240 C 90 300, 110 360, 80 420"
          stroke={tintDarker}
          strokeWidth={1.2}
          fill="none"
        />
        {/* Hojas */}
        <Path
          d="M120 70 C 150 70, 165 90, 160 115 C 135 120, 115 100, 120 70 Z"
          fill={tint}
        />
        <Path
          d="M105 150 C 75 150, 60 170, 65 195 C 90 200, 110 180, 105 150 Z"
          fill={tint}
        />
        <Path
          d="M115 230 C 145 230, 160 250, 155 275 C 130 280, 110 260, 115 230 Z"
          fill={tint}
        />
        <Path
          d="M95 320 C 65 320, 50 340, 55 365 C 80 370, 100 350, 95 320 Z"
          fill={tint}
        />
      </Svg>

      {/* Puntos decorativos */}
      <Svg
        width={40}
        height={40}
        viewBox="0 0 40 40"
        style={{ position: 'absolute', top: 200, left: 30, opacity: 0.4 }}
      >
        <Circle cx="10" cy="10" r="2" fill={tintDarker} />
        <Circle cx="28" cy="22" r="1.5" fill={tintDarker} />
        <Circle cx="14" cy="32" r="1" fill={tintDarker} />
      </Svg>
    </View>
  );
}
