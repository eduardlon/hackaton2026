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
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Dimensions, Modal, ScrollView, View } from 'react-native';

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
import { getPassport, getTransactions, getWallet } from '@/services/api';
import { useTheme } from '@/theme';
import type { AIInsight, ExpenseCategory, FinancialOverview, MonthlyEvolution, Passport, Transaction, Wallet } from '@/types';
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

const EMPTY_OVERVIEW: FinancialOverview = {
  status: 'Atención',
  income: { value: 0, deltaPct: 0 },
  expenses: { value: 0, deltaPct: 0 },
  savings: { value: 0, deltaPct: 0 },
  netBalance: { value: 0, deltaPct: 0 },
};

const EMPTY_PASSPORT: Passport = {
  level: 0,
  levelName: 'Inicial',
  points: 0,
  nextLevel: 0,
  progress: 0,
  nextBenefit: 'Conecta datos financieros reales para activar beneficios',
  monthlyPoints: 0,
};

type AnalysisData = {
  label: string;
  compareLabel: string;
  overview: FinancialOverview;
  categories: ExpenseCategory[];
  evolution: MonthlyEvolution[];
  insights: AIInsight[];
  passport: Passport;
};

const PERIOD_CONFIG: Record<Period, {
  label: string;
  compareLabel: string;
  multiplier: number;
  previousMultiplier: number;
}> = {
  mes: {
    label: 'este mes',
    compareLabel: 'vs. mes anterior',
    multiplier: 1,
    previousMultiplier: 0.92,
  },
  anterior: {
    label: 'el mes anterior',
    compareLabel: 'vs. hace 2 meses',
    multiplier: 0.92,
    previousMultiplier: 0.86,
  },
  trimestre: {
    label: 'este trimestre',
    compareLabel: 'vs. trimestre anterior',
    multiplier: 3,
    previousMultiplier: 2.76,
  },
  anio: {
    label: 'este año',
    compareLabel: 'vs. año anterior',
    multiplier: 12,
    previousMultiplier: 10.8,
  },
};

const CATEGORY_COLORS = ['#6366F1', '#14B8A6', '#F97316', '#EF4444', '#8B5CF6'];

function emptyAnalysis(period: Period): AnalysisData {
  const config = PERIOD_CONFIG[period];
  return {
    label: config.label,
    compareLabel: config.compareLabel,
    overview: EMPTY_OVERVIEW,
    categories: [],
    evolution: [],
    insights: [],
    passport: EMPTY_PASSPORT,
  };
}

function calculateDelta(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function buildCategories(transactions: Transaction[], expenses: number): ExpenseCategory[] {
  const totals: Record<string, number> = {};

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    totals[transaction.category] = (totals[transaction.category] ?? 0) + Math.abs(transaction.amount);
  }

  if (!Object.keys(totals).length && expenses > 0) {
    totals['Gastos operativos'] = expenses;
  }

  const total = Object.values(totals).reduce((acc, value) => acc + value, 0);

  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, amount], index) => ({
      name,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      color: CATEGORY_COLORS[index] ?? CATEGORY_COLORS[0],
    }));
}

function buildEvolution(wallet: Wallet, period: Period): MonthlyEvolution[] {
  const baseIncome = wallet.monthlyIncome;
  const baseExpenses = wallet.monthlyExpenses;
  const months = period === 'anio' ? 6 : period === 'trimestre' ? 3 : 4;

  return Array.from({ length: months }, (_, index) => {
    const distance = months - index - 1;
    const factor = Math.max(0.72, 1 - distance * 0.06);
    return {
      month: distance === 0 ? 'Ahora' : `M-${distance}`,
      income: Math.round(baseIncome * factor),
      expense: Math.round(baseExpenses * Math.max(0.72, factor - 0.03)),
    };
  });
}

function buildInsights(wallet: Wallet, passport: Passport, categories: ExpenseCategory[]): AIInsight[] {
  const savingsRate = wallet.monthlyIncome > 0 ? Math.round((wallet.freeMargin / wallet.monthlyIncome) * 100) : 0;
  const topCategory = categories[0];

  return [
    {
      id: 'cashflow',
      title: wallet.freeMargin > 0 ? 'Tienes margen libre para crecer' : 'Tu flujo necesita atención',
      description: wallet.freeMargin > 0
        ? `Tu margen estimado es ${formatMoney(wallet.freeMargin)}. Úsalo para inventario, ahorro o pagos responsables.`
        : 'Tus gastos están consumiendo tus ingresos. Prioriza reducir pagos variables antes de tomar crédito.',
      icon: 'PiggyBank',
      trend: wallet.freeMargin > 0 ? 'up' : 'down',
    },
    {
      id: 'category',
      title: topCategory ? `${topCategory.name} concentra tus gastos` : 'Registra más movimientos para afinar el análisis',
      description: topCategory
        ? `${topCategory.name} representa cerca del ${topCategory.percentage}% de tus gastos visibles.`
        : 'A medida que registres pagos, ventas y facturas, la IA tendrá mejores recomendaciones.',
      icon: 'ShoppingCart',
      trend: 'neutral',
    },
    {
      id: 'passport',
      title: `Pasaporte ${passport.levelName}`,
      description: `Llevas ${passport.points} puntos. ${passport.nextBenefit}`,
      icon: 'TrendingUp',
      trend: savingsRate >= 20 ? 'up' : 'neutral',
    },
  ];
}

function buildAnalysis(period: Period, wallet: Wallet, passport: Passport, transactions: Transaction[]): AnalysisData {
  const config = PERIOD_CONFIG[period];
  const income = Math.round(wallet.monthlyIncome * config.multiplier);
  const expenses = Math.round(wallet.monthlyExpenses * config.multiplier);
  const previousIncome = Math.round(wallet.monthlyIncome * config.previousMultiplier);
  const previousExpenses = Math.round(wallet.monthlyExpenses * config.previousMultiplier);
  const savings = Math.max(0, income - expenses);
  const previousSavings = Math.max(0, previousIncome - previousExpenses);
  const netBalance = Math.round(wallet.balance + savings);
  const categories = buildCategories(transactions, expenses);

  const overview: FinancialOverview = {
    status: savings > income * 0.2 ? 'Saludable' : savings > 0 ? 'Estable' : 'Atención',
    income: { value: income, deltaPct: calculateDelta(income, previousIncome) },
    expenses: { value: expenses, deltaPct: calculateDelta(expenses, previousExpenses) },
    savings: { value: savings, deltaPct: calculateDelta(savings, previousSavings) },
    netBalance: { value: netBalance, deltaPct: calculateDelta(netBalance, wallet.balance) },
  };

  return {
    label: config.label,
    compareLabel: config.compareLabel,
    overview,
    categories,
    evolution: buildEvolution(wallet, period),
    insights: buildInsights(wallet, passport, categories),
    passport,
  };
}

export default function AnalisisScreen() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState<Period>('mes');
  const [source, setSource] = useState<{ wallet: Wallet; passport: Passport; transactions: Transaction[] } | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAnalysis() {
      const [wallet, passport, transactions] = await Promise.all([
        getWallet(),
        getPassport(),
        getTransactions(),
      ]);
      if (!cancelled) setSource({ wallet, passport, transactions });
    }

    loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, []);

  const analysis = source
    ? buildAnalysis(period, source.wallet, source.passport, source.transactions)
    : emptyAnalysis(period);
  const overview = analysis.overview;
  const passport = analysis.passport;

  const totalExpenses = analysis.categories.reduce((acc, c) => acc + c.amount, 0);
  const categoryDetails = analysis.categories.map((category) => {
    const transactions =
      source?.transactions
        .filter((transaction) => transaction.amount < 0 && transaction.category === category.name)
        .slice(0, 5) ?? [];

    return {
      ...category,
      transactions,
      count: transactions.length,
    };
  });

  const passportPct = passport.nextLevel > 0 ? Math.round((passport.points / passport.nextLevel) * 100) : 0;

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
          onPress={() => setCategoryModalVisible(true)}
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

      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        >
          <View
            style={{
              maxHeight: '82%',
              margin: 16,
              padding: 18,
              borderRadius: theme.radii.xxl,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
              gap: 14,
              ...theme.shadows.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">Detalle por categoría</Text>
                <Text variant="micro" tone="muted">
                  Gastos de {analysis.label}: {formatMoney(totalExpenses)}
                </Text>
              </View>
              <PressableScale
                onPress={() => setCategoryModalVisible(false)}
                haptic="light"
                scaleTo={0.9}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surfaceAlt,
                }}
              >
                <X size={18} color={theme.colors.textMuted} />
              </PressableScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
              {categoryDetails.length ? (
                categoryDetails.map((category) => (
                  <View
                    key={category.name}
                    style={{
                      padding: 14,
                      borderRadius: theme.radii.xl,
                      backgroundColor: theme.colors.surfaceAlt,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: category.color,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{category.name}</Text>
                        <Text variant="micro" tone="muted">
                          {category.count ? `${category.count} movimientos visibles` : 'Sin movimientos recientes visibles'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="bodyStrong">{formatMoney(category.amount)}</Text>
                        <Text variant="micro" tone="muted">{category.percentage}% del gasto</Text>
                      </View>
                    </View>

                    <View
                      style={{
                        height: 8,
                        borderRadius: 999,
                        overflow: 'hidden',
                        backgroundColor: theme.colors.borderSoft,
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.max(4, category.percentage)}%`,
                          height: '100%',
                          borderRadius: 999,
                          backgroundColor: category.color,
                        }}
                      />
                    </View>

                    {category.transactions.length ? (
                      <View style={{ gap: 8 }}>
                        {category.transactions.map((transaction) => (
                          <View
                            key={transaction.id}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text variant="caption" numberOfLines={1}>
                                {transaction.title}
                              </Text>
                              <Text variant="micro" tone="muted" numberOfLines={1}>
                                {transaction.subtitle || transaction.time}
                              </Text>
                            </View>
                            <Text variant="caption" tone="danger">
                              {formatMoney(Math.abs(transaction.amount))}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text variant="micro" tone="muted">
                        Esta categoría viene del resumen mensual de tu billetera. Cuando registres movimientos, verás aquí cada pago.
                      </Text>
                    )}
                  </View>
                ))
              ) : (
                <View
                  style={{
                    padding: 18,
                    borderRadius: theme.radii.xl,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                >
                  <Text variant="bodySmall" tone="muted" align="center">
                    Todavía no hay categorías de gasto para mostrar en este periodo.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
