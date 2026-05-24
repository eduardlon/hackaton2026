import { LineChart } from 'react-native-gifted-charts';
import { View } from 'react-native';

import { useTheme } from '@/theme';

type Point = { month: string; income: number; expense: number };

type Props = {
  data: Point[];
  width?: number;
};

export function EvolutionChart({ data, width = 280 }: Props) {
  const { theme } = useTheme();

  const incomeData = data.map((d) => ({
    value: d.income / 1_000_000,
    label: d.month,
    dataPointText: '',
  }));
  const expenseData = data.map((d) => ({
    value: d.expense / 1_000_000,
    label: d.month,
  }));

  return (
    <View style={{ marginLeft: -16 }}>
      <LineChart
        data={incomeData}
        data2={expenseData}
        height={150}
        width={width}
        spacing={width / (data.length + 1)}
        initialSpacing={20}
        endSpacing={10}
        thickness={2.5}
        thickness2={2.5}
        color1={theme.colors.success}
        color2={theme.colors.warn}
        dataPointsColor1={theme.colors.success}
        dataPointsColor2={theme.colors.warn}
        textColor1={theme.colors.textMuted}
        textShiftY={-4}
        yAxisColor="transparent"
        xAxisColor={theme.colors.borderSoft}
        rulesColor={theme.colors.borderSoft}
        rulesType="dashed"
        noOfSections={4}
        yAxisTextStyle={{ color: theme.colors.textMuted, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 10 }}
        yAxisLabelSuffix="M"
        curved
        isAnimated
        animationDuration={900}
        animateOnDataChange
        onDataChangeAnimationDuration={400}
        adjustToWidth
        hideRules={false}
        backgroundColor="transparent"
      />
    </View>
  );
}
