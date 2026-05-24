import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ChevronRight,
  CircleEqual,
  FileText,
  Filter,
  Home,
  Lightbulb,
  type LucideIcon,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Card,
  ChipFilter,
  IconCircle,
  MetricCell,
  PointsBadge,
  PressableScale,
  ScreenContainer,
  StaggeredList,
  Text,
} from '@/components';
import { useTheme } from '@/theme';
import type { Transaction, TransactionGroup } from '@/types';
import { mockTransactions, mockWallet } from '@/data/mock';
import { formatMoney } from '@/utils/format';

const ICONS: Record<string, LucideIcon> = {
  Building2,
  Home,
  Lightbulb,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
};

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'Ingreso', label: 'Ingresos', icon: ArrowUpRight },
  { id: 'Gasto', label: 'Gastos', icon: ArrowDownRight },
  { id: 'Factura', label: 'Facturas', icon: FileText },
  { id: 'Venta', label: 'Ventas', icon: ShoppingCart },
] as const;

const GROUP_LABEL: Record<TransactionGroup, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  semana: 'Esta semana',
};

export default function MovimientosScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>('todos');

  const filtered = useMemo(() => {
    if (filter === 'todos') return mockTransactions;
    if (filter === 'Ingreso')
      return mockTransactions.filter((t) => t.amount > 0 || t.category === 'Ingreso');
    if (filter === 'Gasto')
      return mockTransactions.filter((t) => t.amount < 0 && t.category !== 'Factura');
    return mockTransactions.filter((t) => t.category === filter);
  }, [filter]);

  const grouped = useMemo(() => {
    const groups: Record<TransactionGroup, Transaction[]> = {
      hoy: [],
      ayer: [],
      semana: [],
    };
    for (const tx of filtered) {
      groups[tx.group].push(tx);
    }
    return groups;
  }, [filtered]);

  return (
    <ScreenContainer scroll hasTabBar>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <PressableScale
          onPress={() => router.back()}
          scaleTo={0.92}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
          }}
        >
          <ArrowLeft size={18} color={theme.colors.text} />
        </PressableScale>
        <Text variant="h2">Movimientos</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <PressableScale
            scaleTo={0.92}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
            }}
          >
            <Search size={18} color={theme.colors.text} />
          </PressableScale>
          <PressableScale
            scaleTo={0.92}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
            }}
          >
            <Filter size={18} color={theme.colors.text} />
          </PressableScale>
        </View>
      </View>

      {/* Resumen */}
      <Card padded delay={0} style={{ padding: 16, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <MetricCell
            label="Ingresos del mes"
            value={formatMoney(mockWallet.monthlyIncome)}
            Icon={ArrowUpRight}
            tone="success"
            style={{ flex: 1 }}
          />
          <MetricCell
            label="Gastos del mes"
            value={formatMoney(mockWallet.monthlyExpenses)}
            Icon={ArrowDownRight}
            tone="danger"
            style={{ flex: 1 }}
          />
          <MetricCell
            label="Balance neto"
            value={formatMoney(mockWallet.freeMargin)}
            Icon={CircleEqual}
            tone="primary"
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      {/* Filtros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 12 }}
      >
        {FILTERS.map((f) => (
          <ChipFilter
            key={f.id}
            label={f.label}
            active={filter === f.id}
            onPress={() => setFilter(f.id)}
            icon={'icon' in f ? f.icon : undefined}
          />
        ))}
      </ScrollView>

      {/* Grupos */}
      <View style={{ gap: 16 }}>
        {(Object.keys(grouped) as TransactionGroup[]).map((g) =>
          grouped[g].length === 0 ? null : (
            <View key={g} style={{ gap: 10 }}>
              <Text variant="bodyStrong">{GROUP_LABEL[g]}</Text>
              <Card padded={false} delay={0} style={{ padding: 8 }}>
                <StaggeredList delayStep={60} gap={4}>
                  {grouped[g].map((tx) => {
                    const Icon = ICONS[tx.icon] ?? Sparkles;
                    return (
                      <PressableScale
                        key={tx.id}
                        scaleTo={0.98}
                        haptic="selection"
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          padding: 10,
                          borderRadius: theme.radii.lg,
                        }}
                      >
                        <IconCircle Icon={Icon} tone={tx.amount > 0 ? 'success' : 'neutral'} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text variant="bodyStrong" numberOfLines={1}>
                            {tx.title}
                          </Text>
                          {tx.subtitle ? (
                            <Text variant="micro" tone="muted">
                              {tx.subtitle}
                            </Text>
                          ) : null}
                          <Text variant="micro" tone="soft">
                            {tx.date ? `${tx.date} • ${tx.time}` : tx.time}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text
                            variant="bodyStrong"
                            tone={tx.amount < 0 ? 'expense' : 'income'}
                          >
                            {formatMoney(tx.amount, { sign: true })}
                          </Text>
                          {tx.points > 0 ? <PointsBadge value={tx.points} delay={0} /> : null}
                        </View>
                        <ChevronRight size={16} color={theme.colors.textSoft} />
                      </PressableScale>
                    );
                  })}
                </StaggeredList>
              </Card>
            </View>
          )
        )}

        {/* Tarjeta informativa */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 320, delay: 300 }}
        >
          <Card padded delay={0} style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconCircle Icon={Star} tone="primary" size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">Acumula puntos con tus ingresos y ventas.</Text>
                <Text variant="micro" tone="muted">
                  Entre más constante seas, más crece tu Pasaporte Financiero.
                </Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textSoft} />
            </View>
          </Card>
        </MotiView>
        <View style={{ height: insets.bottom }} />
      </View>
    </ScreenContainer>
  );
}
