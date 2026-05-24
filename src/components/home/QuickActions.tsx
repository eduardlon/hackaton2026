import { useRouter } from 'expo-router';
import { Brain, Camera, CircleDollarSign, Send } from 'lucide-react-native';
import { View } from 'react-native';

import { Card, IconCircle, PressableScale, Text } from '@/components';

type Action = {
  label: string;
  Icon: typeof Brain;
  onPress?: () => void;
};

type Props = {
  delay?: number;
  onAction?: (label: string) => void;
};

export function QuickActions({ delay = 0, onAction }: Props) {
  const router = useRouter();
  const actions: Action[] = [
    { label: 'Pagar\nBre-B', Icon: Send, onPress: () => router.push('/breb-payment') },
    { label: 'Recibir\ndinero', Icon: CircleDollarSign, onPress: () => router.push('/nfc-transfer') },
    { label: 'Pagar\ncon foto', Icon: Camera },
    { label: 'Preguntar\nIA', Icon: Brain },
  ];

  return (
    <Card delay={delay} padded style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {actions.map(({ label, Icon, onPress }) => (
          <PressableScale
            key={label}
            onPress={() => {
              if (onPress) onPress();
              else onAction?.(label);
            }}
            scaleTo={0.92}
            style={{ alignItems: 'center', gap: 6, flex: 1 }}
          >
            <IconCircle Icon={Icon} tone="primary" size={42} />
            <Text variant="micro" align="center" numberOfLines={2}>
              {label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Card>
  );
}
