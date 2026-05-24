import { View } from 'react-native';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionTitle({ title, actionLabel, onActionPress }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <Text variant="h3">{title}</Text>
      {actionLabel ? (
        <PressableScale onPress={onActionPress} scaleTo={0.95}>
          <Text variant="caption" tone="primary">
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
