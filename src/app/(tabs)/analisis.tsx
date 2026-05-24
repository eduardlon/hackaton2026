import { MotiView } from 'moti';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  ChevronRight,
  HeartPulse,
  Info,
  PiggyBank,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Dimensions, View } from 'react-native';

import {
  Badge,
  Card,
  DonutChart,
  EvolutionChart,
  IconCircle,
  PointsBadge,
  PressableScale,
  ProgressBar,
  ScreenContainer,
  SectionTitle,
  Text,
} from '@/components';
import { Selector } from '@/components/Selector';
import {
  mockEvolution,
  mockExpenseCategories,
  mockInsights,
  mockOverview,
  mockPassport,
} from '@/data/mock';
import { useTheme } from '@/theme';
import { formatDelta, formatMoney } from '@/utils/format';

const PERIOD_OPTIONS = [
  { value: 'mes', label: 'Este mes' },
  { value: 'anterior', label: 'Mes anterior' },
  { value: 'trimestre', label: 'Este trimestre' },
  { value: 'anio', label: 'Este año' },
];

const INSIGHT_ICONS: Record<string, typeof ShoppingCart> = {
  ShoppingCart,
  PiggyBank,
  TrendingUp,
};

export default function AnalisisScreen() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<string>('mes');

  const overview = mockOverview;
  const passport = mockPassport;

  const totalExpenses = useMemo(
    () => mockExpenseCategories.reduce((acc, c) => acc + c.amount, 0),
    []
  );

  const passportPct = Math.round((passport.points / passport.nextLevel) * 100);

  const screenWidth = Dimensions.get('window').width;

  return (
    <ScreenContainer hasTabBar>
      {/* Header local con selector */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <Text variant="h1">Análisis</Text>
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
            minWidth: 140,
          }}
        >
          <Selector value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
        </View>
      </View>

      {/* Estado financiero general */}
      <Card delay={0} padded style={{ padding: 18, gap: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text variant="h3">Estado financiero general</Text>
            <Text variant="micro" tone="muted">
              Así va tu negocio en este periodo.
            </Text>
          </View>
          <Badge label={overview.status} tone="primary" icon={HeartPulse} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[
            {
              label: 'Ingresos',
              value: overview.income.value,
              delta: overview.income.deltaPct,
              Icon: ArrowUpRight,
              tone: 'success' as const,
            },
            {
              label: 'Gastos',
              value: overview.expenses.value,
              delta: overview.expenses.deltaPct,
              Icon: ArrowDownRight,
              tone: 'danger' as const,
            },
            {
              label: 'Ahorro',
              value: overview.savings.value,
              delta: overview.savings.deltaPct,
              Icon: PiggyBank,
              tone: 'primary' as const,
            },
            {
              label: 'Balance neto',
              value: overview.netBalance.value,
              delta: overview.netBalance.deltaPct,
              Icon: WalletIcon,
              tone: 'primary' as const,
            },
          ].map((m) => (
            <View
              key={m.label}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                gap: 4,
                padding: 10,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              <IconCircle Icon={m.Icon} tone={m.tone} size={28} />
              <Text variant="micro" tone="muted">
                {m.label}
              </Text>
              <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(m.value)}
              </Text>
              <Text variant="micro" tone="success">
                {formatDelta(m.delta)} vs. mes anterior
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Gastos por categoría */}
      <Card delay={120} padded style={{ padding: 18, gap: 12, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="h3">Gastos por categoría</Text>
          <Info size={14} color={theme.colors.textMuted} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <DonutChart
            data={mockExpenseCategories}
            totalLabel="Total gastos"
            totalValue={formatMoney(totalExpenses)}
            size={150}
          />
          <View style={{ flex: 1, gap: 8 }}>
            {mockExpenseCategories.map((c) => (
              <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: c.color,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="caption">{c.name}</Text>
                  <Text variant="micro" tone="muted">
                    {formatMoney(c.amount)} • {c.percentage}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <PressableScale
          haptic="selection"
          scaleTo={0.98}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.primarySoft,
          }}
        >
          <Text variant="caption" tone="primary">
            Ver detalle por categoría
          </Text>
          <ChevronRight size={14} color={theme.colors.primaryDark} />
        </PressableScale>
      </Card>

      {/* Evolución mensual */}
      <Card delay={200} padded style={{ padding: 18, gap: 10, marginBottom: 14 }}>
        <Text variant="h3">Evolución mensual</Text>
        <EvolutionChart data={mockEvolution} width={screenWidth - 80} />
        <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.colors.success,
              }}
            />
            <Text variant="micro" tone="muted">
              Ingresos
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.colors.warn,
              }}
            />
            <Text variant="micro" tone="muted">
              Gastos
            </Text>
          </View>
        </View>
      </Card>

      {/* Insights IA */}
      <Card delay={280} padded style={{ padding: 16, gap: 12, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconCircle Icon={Bot} tone="primary" size={36} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="h3">Insights de IA</Text>
              <Sparkles size={14} color={theme.colors.primaryDark} />
            </View>
            <Text variant="micro" tone="muted">
              Recomendaciones para hacer crecer tu negocio.
            </Text>
          </View>
        </View>

        {mockInsights.map((insight, i) => {
          const Icon = INSIGHT_ICONS[insight.icon] ?? TrendingUp;
          return (
            <MotiView
              key={insight.id}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 280, delay: 320 + i * 80 }}
            >
              <PressableScale
                scaleTo={0.98}
                haptic="selection"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.borderSoft,
                }}
              >
                <IconCircle Icon={Icon} tone="neutral" size={32} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {insight.title}
                  </Text>
                  <Text variant="micro" tone="muted">
                    {insight.description}
                  </Text>
                </View>
                <ChevronRight size={16} color={theme.colors.textSoft} />
              </PressableScale>
            </MotiView>
          );
        })}
      </Card>

      {/* Pasaporte */}
      <Card delay={360} padded style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle title="Pasaporte Financiero" />
          <PointsBadge value={passport.monthlyPoints} delay={420} withIcon />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="bodyStrong">{passport.levelName}</Text>
            <Text variant="micro" tone="muted">
              {passport.points} / {passport.nextLevel} puntos
            </Text>
            <ProgressBar value={passportPct} duration={900} delay={420} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text variant="micro" tone="muted">
              Tendencia
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={14} color={theme.colors.success} />
              <Text variant="bodyStrong" tone="success">
                +{passport.monthlyPoints}
              </Text>
            </View>
            <Text variant="micro" tone="muted">
              vs. mes anterior
            </Text>
          </View>
        </View>
      </Card>
    </ScreenContainer>
  );
}
