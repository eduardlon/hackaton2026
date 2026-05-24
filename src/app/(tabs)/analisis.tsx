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

type Period = 'mes' | 'anterior' | 'trimestre' | 'anio';

const INSIGHT_ICONS: Record<string, typeof ShoppingCart> = {
  ShoppingCart,
  PiggyBank,
  TrendingUp,
};

const PERIOD_DATA: Record<Period, {
  label: string;
  compareLabel: string;
  overview: typeof mockOverview;
  categories: typeof mockExpenseCategories;
  evolution: typeof mockEvolution;
  insights: typeof mockInsights;
  passport: typeof mockPassport;
}> = {
  mes: {
    label: 'este mes',
    compareLabel: 'vs. mes anterior',
    overview: mockOverview,
    categories: mockExpenseCategories,
    evolution: mockEvolution,
    insights: mockInsights,
    passport: mockPassport,
  },
  anterior: {
    label: 'el mes anterior',
    compareLabel: 'vs. hace 2 meses',
    overview: {
      status: 'Estable',
      income: { value: 2700000, deltaPct: 11 },
      expenses: { value: 1950000, deltaPct: 6 },
      savings: { value: 750000, deltaPct: 18 },
      netBalance: { value: 3720000, deltaPct: 12 },
    },
    categories: [
      { name: 'Servicios', amount: 610000, percentage: 31, color: '#8ED000' },
      { name: 'Inventario', amount: 520000, percentage: 27, color: '#A7E800' },
      { name: 'Transporte', amount: 430000, percentage: 22, color: '#C7F25A' },
      { name: 'Comida', amount: 250000, percentage: 13, color: '#F4A53A' },
      { name: 'Otros', amount: 140000, percentage: 7, color: '#B8C0CC' },
    ],
    evolution: mockEvolution.slice(0, 5),
    insights: [
      {
        id: 'prev-1',
        title: 'El mes anterior tu ahorro fue menor',
        description: 'Inventario y transporte dejaron menos margen libre.',
        icon: 'PiggyBank',
        trend: 'neutral',
      },
      {
        id: 'prev-2',
        title: 'Tus ingresos venían creciendo de forma constante',
        description: 'La tendencia permitió sostener mejor los gastos fijos.',
        icon: 'TrendingUp',
        trend: 'up',
      },
    ],
    passport: { ...mockPassport, points: 385, progress: 55, monthlyPoints: 25 },
  },
  trimestre: {
    label: 'este trimestre',
    compareLabel: 'vs. trimestre anterior',
    overview: {
      status: 'Saludable',
      income: { value: 8600000, deltaPct: 21 },
      expenses: { value: 5800000, deltaPct: 10 },
      savings: { value: 2800000, deltaPct: 36 },
      netBalance: { value: 4362036, deltaPct: 24 },
    },
    categories: [
      { name: 'Inventario', amount: 1780000, percentage: 31, color: '#A7E800' },
      { name: 'Servicios', amount: 1650000, percentage: 28, color: '#8ED000' },
      { name: 'Transporte', amount: 1120000, percentage: 19, color: '#C7F25A' },
      { name: 'Comida', amount: 720000, percentage: 12, color: '#F4A53A' },
      { name: 'Otros', amount: 530000, percentage: 10, color: '#B8C0CC' },
    ],
    evolution: mockEvolution.slice(3),
    insights: [
      {
        id: 'tri-1',
        title: 'El trimestre muestra crecimiento sano',
        description: 'Ingresos suben más rápido que gastos, mantén este ritmo.',
        icon: 'TrendingUp',
        trend: 'up',
      },
      {
        id: 'tri-2',
        title: 'Inventario concentra el mayor gasto',
        description: 'Negocia proveedores para proteger tu margen trimestral.',
        icon: 'ShoppingCart',
        trend: 'up',
      },
    ],
    passport: { ...mockPassport, points: 420, progress: 60, monthlyPoints: 80 },
  },
  anio: {
    label: 'este año',
    compareLabel: 'vs. año anterior',
    overview: {
      status: 'Saludable',
      income: { value: 34400000, deltaPct: 28 },
      expenses: { value: 22800000, deltaPct: 14 },
      savings: { value: 11600000, deltaPct: 41 },
      netBalance: { value: 4362036, deltaPct: 31 },
    },
    categories: [
      { name: 'Inventario', amount: 7200000, percentage: 32, color: '#A7E800' },
      { name: 'Servicios', amount: 6100000, percentage: 27, color: '#8ED000' },
      { name: 'Transporte', amount: 4100000, percentage: 18, color: '#C7F25A' },
      { name: 'Comida', amount: 2900000, percentage: 13, color: '#F4A53A' },
      { name: 'Otros', amount: 2500000, percentage: 10, color: '#B8C0CC' },
    ],
    evolution: mockEvolution,
    insights: [
      {
        id: 'year-1',
        title: 'Tu historial anual fortalece el acceso a crédito',
        description: 'La constancia de ingresos mejora tu perfil financiero.',
        icon: 'TrendingUp',
        trend: 'up',
      },
      {
        id: 'year-2',
        title: 'Puedes planear compras grandes con más seguridad',
        description: 'El ahorro acumulado da margen para invertir sin ahogarte.',
        icon: 'PiggyBank',
        trend: 'up',
      },
    ],
    passport: { ...mockPassport, points: 420, progress: 60, monthlyPoints: 210 },
  },
};

export default function AnalisisScreen() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<Period>('mes');

  const analysis = PERIOD_DATA[period];
  const overview = analysis.overview;
  const passport = analysis.passport;

  const totalExpenses = useMemo(
    () => analysis.categories.reduce((acc, c) => acc + c.amount, 0),
    [analysis.categories]
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
          <Selector value={period} options={PERIOD_OPTIONS} onChange={(value) => setPeriod(value as Period)} />
        </View>
      </View>

      {/* Estado financiero general */}
      <Card delay={0} padded style={{ padding: 18, gap: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text variant="h3">Estado financiero general</Text>
            <Text variant="micro" tone="muted">
              Así va tu negocio en {analysis.label}.
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
                {formatDelta(m.delta)} {analysis.compareLabel}
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
            data={analysis.categories}
            totalLabel="Total gastos"
            totalValue={formatMoney(totalExpenses)}
            size={150}
          />
          <View style={{ flex: 1, gap: 8 }}>
            {analysis.categories.map((c) => (
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
        <Text variant="h3">Evolución de {analysis.label}</Text>
        <EvolutionChart data={analysis.evolution} width={screenWidth - 80} />
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

        {analysis.insights.map((insight, i) => {
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
