import { MotiView } from 'moti';
import {
  Banknote,
  Calculator,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Landmark,
  Lightbulb,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  Badge,
  Card,
  Header,
  IconCircle,
  PressableScale,
  PrimaryButton,
  ProgressBar,
  ScreenContainer,
  Text,
} from '@/components';
import { Selector } from '@/components/Selector';
import { mockCredit } from '@/data/mock';
import { simulateLoan } from '@/services/api';
import { useTheme } from '@/theme';
import type { SimulatorResult } from '@/types';
import { formatMoney, formatPercent } from '@/utils/format';

const MONTH_OPTIONS = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 9, label: '9 meses' },
  { value: 12, label: '12 meses' },
  { value: 18, label: '18 meses' },
  { value: 24, label: '24 meses' },
];

const REASON_OPTIONS = [
  { value: 'Inventario', label: 'Inventario' },
  { value: 'Capital de trabajo', label: 'Capital de trabajo' },
  { value: 'Compra de equipo', label: 'Compra de equipo' },
  { value: 'Educación', label: 'Educación' },
  { value: 'Salud', label: 'Salud' },
  { value: 'Otro', label: 'Otro' },
];

const STEP = 100000;
const MIN_AMOUNT = 100000;
const MAX_AMOUNT = 2000000;

export default function CreditoScreen() {
  const { theme } = useTheme();
  const credit = mockCredit;

  const [amount, setAmount] = useState(600000);
  const [months, setMonths] = useState(6);
  const [reason, setReason] = useState('Inventario');
  const [resultKey, setResultKey] = useState(0);
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [loadingSim, setLoadingSim] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingSim(true);
    simulateLoan({ amount, months, reason })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setResultKey((k) => k + 1);
      })
      .finally(() => {
        if (!cancelled) setLoadingSim(false);
      });
    return () => {
      cancelled = true;
    };
  }, [amount, months, reason]);

  const inc = () => setAmount((a) => Math.min(MAX_AMOUNT, a + STEP));
  const dec = () => setAmount((a) => Math.max(MIN_AMOUNT, a - STEP));

  const fallback: SimulatorResult = {
    monthlyPayment: 0,
    totalPayable: 0,
    paymentCapacityPct: 0,
    capacityLabel: 'Adecuada',
    aiRecommendation: 'Aprobado',
    aiNote: 'Calculando…',
    passportImpactPoints: 0,
  };
  const view = result ?? fallback;

  const capacityTone =
    view.capacityLabel === 'Adecuada'
      ? 'success'
      : view.capacityLabel === 'Ajustada'
        ? 'warn'
        : 'danger';

  const aiTone =
    view.aiRecommendation === 'Aprobado'
      ? 'success'
      : view.aiRecommendation === 'Revisar'
        ? 'warn'
        : 'danger';

  return (
    <ScreenContainer hasTabBar>
      <Header
        title="Crédito"
        subtitle="Financiamiento responsable para tu negocio"
        notifications={4}
      />

      {/* Crédito estimado */}
      <Card delay={0} padded style={{ padding: 20, gap: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="bodyStrong">Crédito estimado disponible</Text>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: theme.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Landmark size={20} color={theme.colors.primaryDark} />
          </View>
        </View>
        <Text variant="display" tone="primary" numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(credit.estimatedAmount)}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <ShieldCheck size={18} color={theme.colors.primaryDark} />
            <View>
              <Text variant="micro" tone="muted">
                Riesgo actual
              </Text>
              <Text variant="caption">{credit.risk}</Text>
            </View>
          </View>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 10,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <ShieldCheck size={18} color={theme.colors.primaryDark} />
            <View>
              <Text variant="micro" tone="muted">
                Nivel actual
              </Text>
              <Text variant="caption">{credit.level}</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" tone="muted">
              Tu elegibilidad
            </Text>
            <Text variant="caption" tone="primary">
              {credit.eligibility}%
            </Text>
          </View>
          <ProgressBar value={credit.eligibility} duration={900} delay={200} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              padding: 10,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <TrendingUp size={14} color={theme.colors.primaryDark} />
            <Text variant="micro" style={{ color: theme.colors.primaryDark, flexShrink: 1 }}>
              Podrías subir hasta {formatMoney(credit.potentialAmount)} mejorando tu Pasaporte Financiero.
            </Text>
          </View>
        </View>
      </Card>

      {/* Simulador */}
      <Card delay={120} padded style={{ padding: 18, gap: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconCircle Icon={Calculator} tone="primary" size={36} />
          <Text variant="h3">Simulador de préstamo</Text>
        </View>

        {/* Monto */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 6,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="micro" tone="muted">
              Monto que necesitas
            </Text>
            <Text variant="bodyStrong">{formatMoney(amount)}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PressableScale
              onPress={dec}
              scaleTo={0.9}
              haptic="light"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Minus size={16} color={theme.colors.text} />
            </PressableScale>
            <PressableScale
              onPress={inc}
              scaleTo={0.9}
              haptic="light"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
              }}
            >
              <Plus size={16} color="#0E0F0E" />
            </PressableScale>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />

        <Selector
          label="Plazo"
          value={months}
          options={MONTH_OPTIONS}
          onChange={setMonths}
        />
        <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />

        <Selector
          label="Motivo del préstamo"
          value={reason}
          options={REASON_OPTIONS}
          onChange={setReason}
        />
      </Card>

      {/* Resultados */}
      <MotiView
        key={resultKey}
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 260 }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <Card animated={false} padded style={{ flexBasis: '47%', flexGrow: 1, gap: 6 }}>
            <IconCircle Icon={CircleDollarSign} tone="primary" size={32} />
            <Text variant="micro" tone="muted">
              Cuota estimada
            </Text>
            <Text variant="h3" tone="primary" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(view.monthlyPayment)}
            </Text>
            <Text variant="micro" tone="muted">
              /mes — Total: {formatMoney(view.totalPayable)}
            </Text>
          </Card>

          <Card animated={false} padded style={{ flexBasis: '47%', flexGrow: 1, gap: 6 }}>
            <IconCircle Icon={WalletIcon} tone={capacityTone} size={32} />
            <Text variant="micro" tone="muted">
              Capacidad de pago
            </Text>
            <Text variant="h3" numberOfLines={1}>
              {formatPercent(view.paymentCapacityPct)}
            </Text>
            <Badge label={view.capacityLabel} tone={capacityTone} />
          </Card>

          <Card animated={false} padded style={{ flexBasis: '47%', flexGrow: 1, gap: 6 }}>
            <IconCircle Icon={Sparkles} tone={aiTone} size={32} />
            <Text variant="micro" tone="muted">
              Recomendación IA
            </Text>
            <Text variant="h3" numberOfLines={1}>
              {view.aiRecommendation}
            </Text>
            <Text variant="micro" tone="muted" numberOfLines={2}>
              {view.aiNote}
            </Text>
          </Card>

          <Card animated={false} padded style={{ flexBasis: '47%', flexGrow: 1, gap: 6 }}>
            <IconCircle Icon={ShieldCheck} tone="primary" size={32} />
            <Text variant="micro" tone="muted">
              Impacto en tu Pasaporte
            </Text>
            <Text variant="h3" tone="primary">
              +{view.passportImpactPoints} puntos
            </Text>
            <Text variant="micro" tone="muted">
              si pagas a tiempo
            </Text>
          </Card>
        </View>
      </MotiView>

      <View style={{ gap: 10, marginBottom: 14 }}>
        <PrimaryButton
          label={loadingSim ? 'Simulando…' : 'Simular crédito'}
          trailingArrow
          loading={loadingSim}
          onPress={() => setResultKey((k) => k + 1)}
        />
        <PrimaryButton
          label="Solicitar evaluación"
          variant="secondary"
          icon={FileText}
          trailingArrow
        />
      </View>

      {/* Cómo aumentar tu cupo */}
      <Card delay={300} padded style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconCircle Icon={Lightbulb} tone="warn" size={36} />
          <Text variant="h3">Cómo aumentar tu cupo</Text>
        </View>
        {[
          'Paga tus cuotas a tiempo para subir tu puntaje.',
          'Conecta tu cuenta bancaria y aumenta tu historial.',
          'Mantén tu información actualizada en tu perfil.',
        ].map((tip) => (
          <View key={tip} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: theme.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              <Check size={12} color={theme.colors.primaryDark} strokeWidth={3} />
            </View>
            <Text variant="bodySmall" style={{ flex: 1 }}>
              {tip}
            </Text>
            <ChevronRight size={14} color={theme.colors.textSoft} />
          </View>
        ))}
      </Card>
      <View style={{ display: 'none' }}>
        <Banknote />
      </View>
    </ScreenContainer>
  );
}
