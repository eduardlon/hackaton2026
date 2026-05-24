import { MotiView } from 'moti';
import {
  Banknote,
  Calculator,
  Check,
  ChevronRight,
  CircleDollarSign,
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
import { Alert, View } from 'react-native';

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
import { useFinancialRealtime } from '@/hooks/useFinancialRealtime';
import { getCreditProfile, getWallet, obtainCreditAmount, simulateLoan } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';
import type { Credit, SimulatorResult, Wallet } from '@/types';
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
type CreditProfile = Awaited<ReturnType<typeof getCreditProfile>>;

export default function CreditoScreen() {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);

  const [credit, setCredit] = useState<Credit | null>(null);
  const [creditProfile, setCreditProfile] = useState<CreditProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [amount, setAmount] = useState(100000);
  const [months, setMonths] = useState(6);
  const [reason, setReason] = useState('Inventario');
  const [resultKey, setResultKey] = useState(0);
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [loadingSim, setLoadingSim] = useState(false);
  const [disbursedAmount, setDisbursedAmount] = useState(0);

  const loadCreditData = async () => {
    const [profile, w] = await Promise.all([getCreditProfile(), getWallet()]);
    setCreditProfile(profile);
    setCredit({
      estimatedAmount: profile.availableAmount,
      safeMonthlyPayment: profile.safeMonthlyPayment,
      risk: ['bajo', 'medio-bajo', 'medio', 'medio-alto', 'alto'].includes(String(profile.risk))
        ? (profile.risk as Credit['risk'])
        : 'medio-bajo',
      eligibility: profile.eligibility,
      potentialAmount: profile.nextTierAmount || profile.maxAmount,
      level: profile.level,
    });
    setWallet(w);
    setAmount((current) => Math.min(Math.max(MIN_AMOUNT, current), Math.max(MIN_AMOUNT, profile.availableAmount)));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profile, w] = await Promise.all([getCreditProfile(), getWallet()]);
      if (cancelled) return;
      setCreditProfile(profile);
      setCredit({
        estimatedAmount: profile.availableAmount,
        safeMonthlyPayment: profile.safeMonthlyPayment,
        risk: ['bajo', 'medio-bajo', 'medio', 'medio-alto', 'alto'].includes(String(profile.risk))
          ? (profile.risk as Credit['risk'])
          : 'medio-bajo',
        eligibility: profile.eligibility,
        potentialAmount: profile.nextTierAmount || profile.maxAmount,
        level: profile.level,
      });
      setWallet(w);
      setAmount((current) => Math.min(Math.max(MIN_AMOUNT, current), Math.max(MIN_AMOUNT, profile.availableAmount)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFinancialRealtime(user?.id ?? 'demo-user-001', () => {
    loadCreditData();
  });

  const available = credit?.estimatedAmount ?? 0;
  const nextTierAmount = creditProfile?.nextTierAmount ?? credit?.potentialAmount ?? 0;
  const pointsToNextTier = creditProfile?.pointsToNextTier ?? 0;
  const canRequest = available > 0;
  const requestAmount = Math.min(amount, available);
  const remainingAfterSimulation = Math.max(0, available - requestAmount);

  const clearSimulation = () => {
    setResult(null);
    setDisbursedAmount(0);
  };

  const inc = () => {
    clearSimulation();
    setAmount((a) => Math.min(available, a + STEP));
  };

  const dec = () => {
    clearSimulation();
    setAmount((a) => Math.max(MIN_AMOUNT, a - STEP));
  };

  const useFullAvailable = () => {
    clearSimulation();
    setAmount(Math.max(MIN_AMOUNT, available));
  };

  const handleMonthsChange = (value: number) => {
    clearSimulation();
    setMonths(value);
  };

  const handleReasonChange = (value: string) => {
    clearSimulation();
    setReason(value);
  };

  const handleSimulate = async () => {
    if (!canRequest) return;
    setLoadingSim(true);
    try {
      const simulation = await simulateLoan({ amount: requestAmount, months, reason });
      setResult(simulation);
      setResultKey((k) => k + 1);
      setDisbursedAmount(0);
    } finally {
      setLoadingSim(false);
    }
  };

  const handleObtainCredit = async () => {
    if (!result || !canRequest) return;
    const outcome = await obtainCreditAmount({ amount: requestAmount, months, reason, simulation: result });
    const [nextProfile, nextWallet] = await Promise.all([getCreditProfile(), getWallet()]);
    setCreditProfile(nextProfile);
    setCredit({
      estimatedAmount: nextProfile.availableAmount,
      safeMonthlyPayment: nextProfile.safeMonthlyPayment,
      risk: ['bajo', 'medio-bajo', 'medio', 'medio-alto', 'alto'].includes(String(nextProfile.risk))
        ? (nextProfile.risk as Credit['risk'])
        : 'medio-bajo',
      eligibility: nextProfile.eligibility,
      potentialAmount: nextProfile.nextTierAmount || nextProfile.maxAmount,
      level: nextProfile.level,
    });
    setWallet(nextWallet);
    setDisbursedAmount(outcome.loan.amount);
    setAmount(Math.max(MIN_AMOUNT, nextProfile.availableAmount));
    setResult(null);
    setResultKey((k) => k + 1);
    Alert.alert(
      'Crédito desembolsado',
      `${formatMoney(outcome.loan.amount)} fueron enviados a tu billetera. Te queda disponible ${formatMoney(nextProfile.availableAmount)}.`
    );
  };

  const fallback: SimulatorResult = {
    monthlyPayment: 0,
    totalPayable: 0,
    paymentCapacityPct: 0,
    capacityLabel: 'Adecuada',
    aiRecommendation: 'Aprobado',
    aiNote: 'Simula para ver tu recomendación',
    passportImpactPoints: 0,
  };
  const view = result ?? fallback;

  const capacityTone: 'success' | 'warn' | 'danger' =
    view.capacityLabel === 'Adecuada'
      ? 'success'
      : view.capacityLabel === 'Ajustada'
        ? 'warn'
        : 'danger';

  const aiTone: 'success' | 'warn' | 'danger' =
    view.aiRecommendation === 'Aprobado'
      ? 'success'
      : view.aiRecommendation === 'Revisar'
        ? 'warn'
        : 'danger';

  return (
    <ScreenContainer hasTabBar>
      <Header
        title="Crédito"
        subtitle="Simula, decide y desembolsa de forma responsable"
        notifications={4}
      />

      <Card delay={0} padded style={{ padding: 20, gap: 16, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text variant="bodyStrong">Cupo disponible</Text>
            <Text variant="micro" tone="muted">
              Puedes usarlo completo o solo una parte.
            </Text>
          </View>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: theme.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Landmark size={21} color={theme.colors.primaryDark} />
          </View>
        </View>

        <Text variant="display" tone="primary" numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(available)}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt, gap: 4 }}>
            <WalletIcon size={18} color={theme.colors.primaryDark} />
            <Text variant="micro" tone="muted">Billetera actual</Text>
            <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(wallet?.balance ?? 0)}
            </Text>
          </View>
          <View style={{ flex: 1, padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt, gap: 4 }}>
            <ShieldCheck size={18} color={theme.colors.primaryDark} />
            <Text variant="micro" tone="muted">Elegibilidad</Text>
            <Text variant="bodyStrong">{credit?.eligibility ?? 0}%</Text>
          </View>
        </View>

        <ProgressBar value={credit?.eligibility ?? 0} duration={900} delay={120} />

        <View style={{ padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.primarySoft }}>
          <Text variant="bodySmall" tone="primary">
            {pointsToNextTier > 0
              ? `Te faltan ${pointsToNextTier} puntos para subir tu cupo a ${formatMoney(nextTierAmount)}.`
              : `Ya puedes aspirar al siguiente cupo de ${formatMoney(nextTierAmount)} según tu Pasaporte.`}
          </Text>
        </View>

        {disbursedAmount > 0 ? (
          <View style={{ padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.primarySoft }}>
            <Text variant="bodySmall" tone="primary">
              Último desembolso: {formatMoney(disbursedAmount)}. Tu billetera ya fue actualizada.
            </Text>
          </View>
        ) : null}
      </Card>

      <Card delay={120} padded style={{ padding: 18, gap: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconCircle Icon={Calculator} tone="primary" size={36} />
          <View style={{ flex: 1 }}>
            <Text variant="h3">Configura tu crédito</Text>
            <Text variant="micro" tone="muted">
              La simulación solo cambia cuando presionas Simular.
            </Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="micro" tone="muted">Monto a solicitar</Text>
              <Text variant="h2" tone="primary" numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(requestAmount)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <PressableScale
                onPress={dec}
                disabled={!canRequest || amount <= MIN_AMOUNT}
                scaleTo={0.9}
                haptic="light"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  opacity: !canRequest || amount <= MIN_AMOUNT ? 0.4 : 1,
                }}
              >
                <Minus size={16} color={theme.colors.text} />
              </PressableScale>
              <PressableScale
                onPress={inc}
                disabled={!canRequest || amount >= available}
                scaleTo={0.9}
                haptic="light"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primary,
                  opacity: !canRequest || amount >= available ? 0.4 : 1,
                }}
              >
                <Plus size={16} color="#0E0F0E" />
              </PressableScale>
            </View>
          </View>

          <PressableScale
            onPress={useFullAvailable}
            disabled={!canRequest}
            haptic="selection"
            scaleTo={0.98}
            style={{
              alignSelf: 'flex-start',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.primarySoft,
              opacity: canRequest ? 1 : 0.5,
            }}
          >
            <Text variant="caption" tone="primary">Usar todo mi cupo</Text>
          </PressableScale>
        </View>

        <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />

        <Selector label="Plazo" value={months} options={MONTH_OPTIONS} onChange={handleMonthsChange} />
        <View style={{ height: 1, backgroundColor: theme.colors.borderSoft }} />
        <Selector label="Motivo del préstamo" value={reason} options={REASON_OPTIONS} onChange={handleReasonChange} />

        <View style={{ padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt, gap: 4 }}>
          <Text variant="micro" tone="muted">Disponible después si tomas este monto</Text>
          <Text variant="bodyStrong">{formatMoney(remainingAfterSimulation)}</Text>
        </View>

        <PrimaryButton
          label={loadingSim ? 'Simulando…' : 'Simular crédito'}
          trailingArrow
          loading={loadingSim}
          disabled={!canRequest || loadingSim}
          onPress={handleSimulate}
        />
      </Card>

      {result ? (
        <MotiView
          key={resultKey}
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 260 }}
        >
          <Card animated={false} padded style={{ padding: 18, gap: 14, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconCircle Icon={Sparkles} tone={aiTone} size={36} />
              <View style={{ flex: 1 }}>
                <Text variant="h3">Resultado de simulación</Text>
                <Text variant="micro" tone="muted">
                  Revisa antes de obtener el crédito.
                </Text>
              </View>
              <Badge label={view.aiRecommendation} tone={aiTone} />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                { label: 'Cuota estimada', value: formatMoney(view.monthlyPayment), Icon: CircleDollarSign, tone: 'primary' as const },
                { label: 'Capacidad usada', value: formatPercent(view.paymentCapacityPct), Icon: WalletIcon, tone: capacityTone },
                { label: 'Total a pagar', value: formatMoney(view.totalPayable), Icon: Banknote, tone: 'neutral' as const },
                { label: 'Puntos posibles', value: `+${view.passportImpactPoints}`, Icon: ShieldCheck, tone: 'primary' as const },
              ].map((item) => (
                <View key={item.label} style={{ flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt, gap: 6 }}>
                  <IconCircle Icon={item.Icon} tone={item.tone} size={30} />
                  <Text variant="micro" tone="muted">{item.label}</Text>
                  <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={{ padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.primarySoft }}>
              <Text variant="bodySmall" tone="primary">{view.aiNote}</Text>
            </View>

            <PrimaryButton label="Obtener crédito" trailingArrow onPress={handleObtainCredit} />
          </Card>
        </MotiView>
      ) : (
        <Card delay={220} padded style={{ padding: 16, gap: 10, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconCircle Icon={Lightbulb} tone="warn" size={36} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">Primero simula</Text>
              <Text variant="bodySmall" tone="muted">
                Cambia monto, plazo o motivo y presiona Simular crédito para ver cuota, riesgo y cupo restante.
              </Text>
            </View>
          </View>
        </Card>
      )}

      <Card delay={300} padded style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconCircle Icon={TrendingUp} tone="primary" size={36} />
          <Text variant="h3">Cómo cuidar tu cupo</Text>
        </View>
        {[
          'Usa solo el monto que realmente necesitas.',
          'El cupo restante queda disponible para futuras solicitudes.',
          'Paga a tiempo para mejorar tu Pasaporte Financiero.',
        ].map((tip) => (
          <View key={tip} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <Check size={12} color={theme.colors.primaryDark} strokeWidth={3} />
            </View>
            <Text variant="bodySmall" style={{ flex: 1 }}>{tip}</Text>
            <ChevronRight size={14} color={theme.colors.textSoft} />
          </View>
        ))}
      </Card>
    </ScreenContainer>
  );
}
