import { Bot, ChevronRight, Sparkles } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, PressableScale, Text } from '@/components';
import { useTheme } from '@/theme';

type Props = {
  delay?: number;
  message: string;
  onPress?: () => void;
};

export function AIInsightCard({ delay = 0, message, onPress }: Props) {
  const { theme } = useTheme();
  return (
    <Card delay={delay} padded style={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: theme.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bot size={26} color={theme.colors.primaryDark} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="bodyStrong">IA financiera</Text>
          <Sparkles size={14} color={theme.colors.primaryDark} />
        </View>
        <Text variant="bodySmall" tone="muted" style={{ lineHeight: 18 }}>
          {message}
        </Text>
      </View>
      <PressableScale
        onPress={onPress}
        haptic="selection"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.colors.primary,
        }}
      >
        <Text variant="caption" tone="primary">
          Ver análisis
        </Text>
        <ChevronRight size={12} color={theme.colors.primaryDark} />
      </PressableScale>
    </Card>
  );
}
