import { PieChart } from 'react-native-gifted-charts';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from '../Text';

type Slice = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
};

type Props = {
  data: Slice[];
  totalLabel: string;
  totalValue: string;
  size?: number;
};

export function DonutChart({ data, totalLabel, totalValue, size = 160 }: Props) {
  const { theme } = useTheme();

  const chartData = data.map((d) => ({
    value: d.percentage,
    color: d.color,
    text: '',
  }));

  return (
    <View style={{ alignItems: 'center' }}>
      <PieChart
        data={chartData}
        donut
        radius={size / 2}
        innerRadius={size / 2 - 22}
        innerCircleColor={theme.colors.surface}
        backgroundColor={theme.colors.surface}
        focusOnPress={false}
        centerLabelComponent={() => (
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="micro" tone="muted">
              {totalLabel}
            </Text>
            <Text variant="h3" align="center">
              {totalValue}
            </Text>
            <Text variant="micro" tone="muted">
              100%
            </Text>
          </View>
        )}
      />
    </View>
  );
}
