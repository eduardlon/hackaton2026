import { MotiView } from 'moti';
import { type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padHorizontal?: boolean;
  hasTabBar?: boolean;
  contentContainerStyle?: ViewStyle;
  refreshControl?: ScrollViewProps['refreshControl'];
};

export function ScreenContainer({
  children,
  scroll = true,
  padHorizontal = true,
  hasTabBar = false,
  contentContainerStyle,
  refreshControl,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const Wrapper = scroll ? ScrollView : View;
  const baseContentStyle: ViewStyle = {
    paddingBottom: (hasTabBar ? 110 : insets.bottom) + 16,
    paddingHorizontal: padHorizontal ? 18 : 0,
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280 }}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <View style={{ flex: 1, paddingTop: insets.top + 12 }}>
        <Wrapper
          showsVerticalScrollIndicator={false}
          contentContainerStyle={scroll ? [baseContentStyle, contentContainerStyle] : undefined}
          style={!scroll ? [{ flex: 1 }, baseContentStyle] : { flex: 1 }}
          refreshControl={refreshControl}
        >
          {children}
        </Wrapper>
      </View>
    </MotiView>
  );
}
