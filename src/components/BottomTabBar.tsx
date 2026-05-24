import * as Haptics from 'expo-haptics';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Brain,
  Camera,
  CoinsIcon,
  Home,
  LineChart,
  Mic,
  Send,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import {
  askFinancialChat,
  confirmBillPaymentFromInvoice,
  processInvoiceDemo,
  recordFinancialActivity,
} from '@/services/api';
import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

const ICON_MAP: Record<string, typeof Home> = {
  index: Home,
  movimientos: ArrowLeftRight,
  credito: CoinsIcon,
  analisis: LineChart,
};

const LABEL_MAP: Record<string, string> = {
  index: 'Inicio',
  movimientos: 'Movimientos',
  credito: 'Crédito',
  analisis: 'Análisis',
};

const QUICK_AI_PROMPT =
  'Dame una recomendación financiera corta, concreta y accionable para hoy según mi estado financiero.';

const QUICK_ACTION = {
  TRANSFER: 'transfer',
  RECEIVE: 'receive',
  PAY_PHOTO: 'pay_photo',
  ASK_AI: 'ask_ai',
} as const;

type QuickActionKey = (typeof QUICK_ACTION)[keyof typeof QUICK_ACTION];

type QuickMenuAction = {
  key: QuickActionKey;
  label: string;
  helper: string;
  Icon: typeof Home;
};

const QUICK_MENU_ACTIONS: QuickMenuAction[] = [
  {
    key: QUICK_ACTION.TRANSFER,
    label: 'Transferir',
    helper: 'Enviar por NFC',
    Icon: Send,
  },
  {
    key: QUICK_ACTION.RECEIVE,
    label: 'Recibir',
    helper: 'Entrada demo',
    Icon: ArrowDownLeft,
  },
  {
    key: QUICK_ACTION.PAY_PHOTO,
    label: 'Pagar foto',
    helper: 'Factura IA',
    Icon: Camera,
  },
  {
    key: QUICK_ACTION.ASK_AI,
    label: 'Preguntar IA',
    helper: 'Consejo rápido',
    Icon: Brain,
  },
];

function QuickAIModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState<'listening' | 'thinking' | 'answer'>('listening');
  const [answer, setAnswer] = useState('');
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;

    setStatus('listening');
    setAnswer('');
    pulse.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) }),
      -1,
      false
    );

    const timeout = setTimeout(() => {
      setStatus('thinking');
      askFinancialChat(QUICK_AI_PROMPT)
        .then((res) => {
          const text =
            res.answer ||
            'Hoy mantén tu margen libre protegido, prioriza pagos próximos y evita asumir cuotas nuevas si reducen tu flujo.';
          setAnswer(text);
          setStatus('answer');
        })
        .catch(() => {
          const fallback =
            'Hoy cuida tu flujo: paga primero lo que vence pronto, registra tus ingresos y evita gastos que reduzcan tu margen disponible.';
          setAnswer(fallback);
          setStatus('answer');
        });
    }, 1100);

    return () => {
      clearTimeout(timeout);
      pulse.value = 0;
    };
  }, [pulse, visible]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 0.75 + pulse.value * 1.2 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
        }}
      >
        <View
          style={{
            margin: 16,
            padding: 20,
            borderRadius: theme.radii.xxl,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
            gap: 18,
            ...theme.shadows.lg,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primarySoft,
                }}
              >
                <Sparkles size={18} color={theme.colors.primaryDark} />
              </View>
              <View>
                <Text variant="h3">Asistente IA</Text>
                <Text variant="micro" tone="muted">
                  Respuesta rápida para tu día
                </Text>
              </View>
            </View>
            <PressableScale
              onPress={onClose}
              haptic="light"
              scaleTo={0.9}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              <X size={16} color={theme.colors.textMuted} />
            </PressableScale>
          </View>

          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 6 }}>
            <View style={{ width: 112, height: 112, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: theme.colors.primarySoft,
                  },
                  ringStyle,
                ]}
              />
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primary,
                  ...theme.shadows.md,
                }}
              >
                {status === 'thinking' ? (
                  <ActivityIndicator color={theme.colors.primaryContrast} />
                ) : (
                  <Mic size={30} color={theme.colors.primaryContrast} strokeWidth={2.4} />
                )}
              </View>
            </View>

            <Text variant="h2" align="center">
              {status === 'listening'
                ? 'Te estoy escuchando...'
                : status === 'thinking'
                  ? 'Analizando tu contexto...'
                  : 'Esto te recomiendo'}
            </Text>
            <Text variant="bodySmall" tone="muted" align="center">
              {status === 'answer'
                ? answer
                : 'Mantén presionado el botón inteligente para abrir una recomendación inmediata en texto.'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function QuickActionMenu({
  visible,
  bottomOffset,
  loadingKey,
  onClose,
  onSelect,
}: {
  visible: boolean;
  bottomOffset: number;
  loadingKey: QuickActionKey | null;
  onClose: () => void;
  onSelect: (key: QuickActionKey) => void;
}) {
  const { theme } = useTheme();

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        alignItems: 'center',
      }}
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Cerrar menú de acciones"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -bottomOffset,
          height: 420,
        }}
      />
      <View
        style={{
          width: '92%',
          maxWidth: 420,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 28,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderSoft,
          shadowColor: '#000',
          shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.16,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {QUICK_MENU_ACTIONS.map(({ key, label, helper, Icon }) => {
            const isLoading = loadingKey === key;
            return (
              <PressableScale
                key={key}
                disabled={Boolean(loadingKey)}
                onPress={() => onSelect(key)}
                haptic="light"
                scaleTo={0.92}
                accessibilityLabel={label}
                style={{
                  flex: 1,
                  minHeight: 86,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: loadingKey && !isLoading ? 0.46 : 1,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isLoading ? theme.colors.primary : theme.colors.primarySoft,
                    borderWidth: 1,
                    borderColor: theme.colors.borderSoft,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryContrast} />
                  ) : (
                    <Icon size={22} color={theme.colors.primaryDark} strokeWidth={2.35} />
                  )}
                </View>
                <View style={{ alignItems: 'center', gap: 1 }}>
                  <Text variant="caption" align="center" numberOfLines={1}>
                    {label}
                  </Text>
                  <Text variant="micro" tone="muted" align="center" numberOfLines={1}>
                    {helper}
                  </Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function QuickAIButton({
  isOpen,
  onPress,
  onLongPress,
}: {
  isOpen: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      haptic="none"
      scaleTo={0.9}
      style={{
        width: 76,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -18,
      }}
    >
      <ExpoLinearGradient
        colors={['#D8FF45', theme.colors.primary, '#8ED000']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{
          width: 66,
          height: 54,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: theme.colors.bg,
          shadowColor: theme.colors.primary,
          shadowOpacity: 0.55,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 5,
            left: 9,
            right: 9,
            height: 14,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.22)',
          }}
        />
        <Svg width={39} height={36} viewBox="0 0 56 52">
          <Defs>
            <LinearGradient id="aiIconDepth" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1F2524" />
              <Stop offset="1" stopColor="#0B0D0B" />
            </LinearGradient>
          </Defs>
          <Path
            d="M19.8 5.2C21.4 14.3 26.8 19.7 36 21.3C26.8 22.9 21.4 28.3 19.8 37.4C18.2 28.3 12.8 22.9 3.7 21.3C12.8 19.7 18.2 14.3 19.8 5.2Z"
            fill="url(#aiIconDepth)"
          />
          <Path
            d="M43.4 8.4C44.2 12.7 46.7 15.2 51 16C46.7 16.8 44.2 19.3 43.4 23.6C42.6 19.3 40.1 16.8 35.8 16C40.1 15.2 42.6 12.7 43.4 8.4Z"
            fill="url(#aiIconDepth)"
          />
          <Rect x="13" y="36" width="9" height="12" rx="4" fill="url(#aiIconDepth)" />
          <Rect x="25" y="30" width="9" height="18" rx="4" fill="url(#aiIconDepth)" />
          <Rect x="37" y="23" width="9" height="25" rx="4" fill="url(#aiIconDepth)" />
        </Svg>
        {isOpen ? (
          <View
            style={{
              position: 'absolute',
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.bg,
            }}
          >
            <X size={15} color={theme.colors.text} strokeWidth={2.6} />
          </View>
        ) : null}
      </ExpoLinearGradient>
    </PressableScale>
  );
}

function TabItem({
  isFocused,
  routeName,
  onPress,
}: {
  isFocused: boolean;
  routeName: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const Icon = ICON_MAP[routeName] ?? Home;
  const label = LABEL_MAP[routeName] ?? routeName;
  const scale = useSharedValue(isFocused ? 1.05 : 1);
  const pillOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.06 : 1, { damping: 14, stiffness: 220 });
    pillOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 220 });
  }, [isFocused, scale, pillOpacity]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: pillOpacity.value }));

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.94}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingTop: 8,
      }}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center', height: 36, width: 56 }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: 50,
              height: 30,
              borderRadius: 15,
              backgroundColor: theme.colors.primarySoft,
            },
            pillStyle,
          ]}
        />
        <Animated.View style={iconStyle}>
          <Icon
            size={22}
            color={isFocused ? theme.colors.primaryDark : theme.colors.textMuted}
            strokeWidth={isFocused ? 2.4 : 2}
          />
        </Animated.View>
      </View>
      <Text
        variant="micro"
        style={{ color: isFocused ? theme.colors.primaryDark : theme.colors.textMuted }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

// Tipo laxo: tomamos solo lo que necesitamos del prop de react-navigation/expo-router.
// Evita acoplarse a tipos internos del paquete (que cambian entre versiones).
export type AppTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target?: string;
      canPreventDefault?: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function BottomTabBar({ state, navigation }: AppTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [aiVisible, setAiVisible] = useState(false);
  const [quickMenuVisible, setQuickMenuVisible] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState<QuickActionKey | null>(null);
  const visibleRoutes = state.routes.filter((route) => route.name !== 'perfil');
  const quickMenuBottomOffset = Math.max(insets.bottom, 10) + 72;

  const openAI = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setQuickMenuVisible(false);
    setAiVisible(true);
  };

  const runQuickTask = async (key: QuickActionKey, task: () => Promise<void>) => {
    if (quickActionLoading) return;
    setQuickActionLoading(key);
    try {
      await task();
    } catch (error) {
      Alert.alert(
        'No pudimos completar la acción',
        error instanceof Error ? error.message : 'Intenta de nuevo.'
      );
    } finally {
      setQuickActionLoading(null);
    }
  };

  const handleReceiveMoney = () => {
    runQuickTask(QUICK_ACTION.RECEIVE, async () => {
      const result = await recordFinancialActivity({
        type: 'income',
        amount: 300000,
        category: 'Transferencias',
        description: 'Dinero recibido desde menú rápido',
      });
      setQuickMenuVisible(false);
      Alert.alert('Dinero recibido', `Tu Pasaporte sumó +${result.passportUpdate.pointsAdded} puntos.`);
    });
  };

  const handlePayWithPhoto = () => {
    runQuickTask(QUICK_ACTION.PAY_PHOTO, async () => {
      const invoice = await processInvoiceDemo();
      const { extracted } = invoice;
      Alert.alert(
        'Factura detectada',
        `${extracted.provider ?? 'Proveedor'}\nValor: $${(extracted.amount ?? 0).toLocaleString('es-CO')}\nReferencia: ${extracted.reference ?? 'requiere revisión'}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Pagar',
            onPress: () => {
              runQuickTask(QUICK_ACTION.PAY_PHOTO, async () => {
                const result = await confirmBillPaymentFromInvoice(invoice);
                setQuickMenuVisible(false);
                Alert.alert(
                  'Pago exitoso',
                  `Pagaste ${result.payment.provider} y tu Pasaporte sumó +${result.passportUpdate.pointsAdded} puntos.`
                );
              });
            },
          },
        ]
      );
    });
  };

  const handleQuickMenuSelect = (key: QuickActionKey) => {
    if (key === QUICK_ACTION.TRANSFER) {
      setQuickMenuVisible(false);
      router.push('/nfc-transfer');
      return;
    }
    if (key === QUICK_ACTION.RECEIVE) {
      handleReceiveMoney();
      return;
    }
    if (key === QUICK_ACTION.PAY_PHOTO) {
      handlePayWithPhoto();
      return;
    }
    if (key === QUICK_ACTION.ASK_AI) {
      openAI();
    }
  };

  const renderTab = (route: { key: string; name: string }) => {
    const routeIndex = state.routes.findIndex((item) => item.key === route.key);
    const isFocused = state.index === routeIndex;
    const onPress = () => {
      Haptics.selectionAsync().catch(() => {});
      setQuickMenuVisible(false);
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };
    return (
      <TabItem
        key={route.key}
        isFocused={isFocused}
        routeName={route.name}
        onPress={onPress}
      />
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <QuickAIModal visible={aiVisible} onClose={() => setAiVisible(false)} />
      <QuickActionMenu
        visible={quickMenuVisible}
        bottomOffset={quickMenuBottomOffset}
        loadingKey={quickActionLoading}
        onClose={() => setQuickMenuVisible(false)}
        onSelect={handleQuickMenuSelect}
      />
      <View
        style={{
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 6,
          paddingHorizontal: 12,
          backgroundColor: theme.colors.bg,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSoft,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {visibleRoutes.slice(0, 2).map(renderTab)}
          <QuickAIButton
            isOpen={quickMenuVisible}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setQuickMenuVisible((current) => !current);
            }}
            onLongPress={openAI}
          />
          {visibleRoutes.slice(2).map(renderTab)}
        </View>
      </View>
    </View>
  );
}
