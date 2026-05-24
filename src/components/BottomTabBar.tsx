import * as Haptics from 'expo-haptics';
import { CoinsIcon, Home, LineChart, User, ArrowLeftRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useTheme } from '@/theme';

const ICON_MAP: Record<string, typeof Home> = {
  index: Home,
  movimientos: ArrowLeftRight,
  credito: CoinsIcon,
  analisis: LineChart,
  perfil: User,
};

const LABEL_MAP: Record<string, string> = {
  index: 'Inicio',
  movimientos: 'Movimientos',
  credito: 'Crédito',
  analisis: 'Análisis',
  perfil: 'Perfil',
};

function TabItem({
  isFocused,
  routeName,
  onPress,
}: {
  isFocused: boolean;
  routeName: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const Icon = ICON_MAP[routeName] ?? Home;
  const label = LABEL_MAP[routeName] ?? routeName;
  const scale = useSharedValue(isFocused ? 1.05 : 1);
  const pillOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.06 : 1, { damping: 14, stiffness: 220 });
    pillOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 220 });
  }, [isFocused, scale, pillOpacity]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOpacity.value }));

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingTop: 8,
      }}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center', height: 36, width: 56 }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 50,
              height: 30,
              borderRadius: 15,
              backgroundColor: theme.colors.primarySoft,
            },
            pillStyle,
          ]}
        />
        <Animated.View style={iconStyle}>
          <Icon
            size={22}
            color={isFocused ? theme.colors.primaryDark : theme.colors.textMuted}
            strokeWidth={isFocused ? 2.4 : 2}
          />
        </Animated.View>
      </View>
      <Text
        variant="micro"
        style={{ color: isFocused ? theme.colors.primaryDark : theme.colors.textMuted }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

// Tipo laxo: tomamos solo lo que necesitamos del prop de react-navigation/expo-router.
// Evita acoplarse a tipos internos del paquete (que cambian entre versiones).
export type AppTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target?: string;
      canPreventDefault?: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function BottomTabBar({ state, navigation }: AppTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 6,
        paddingHorizontal: 12,
        backgroundColor: theme.colors.bg,
        borderTopWidth: 1,
        borderTopColor: theme.colors.borderSoft,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const onPress = () => {
            Haptics.selectionAsync().catch(() => {});
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <TabItem
              key={route.key}
              isFocused={isFocused}
              routeName={route.name}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}
