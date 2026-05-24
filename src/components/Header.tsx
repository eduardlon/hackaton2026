import { useRouter } from 'expo-router';
import {
  Bell,
  BellRing,
  CreditCard,
  LogOut,
  Moon,
  PiggyBank,
  Send,
  ShieldCheck,
  Star,
  Sun,
  TrendingUp,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Alert, Modal, View } from 'react-native';

import { mockCredit, mockOverview, mockPassport, mockUser, mockWallet } from '@/data/mock';
import { canUseNativeNotifications, sendLocalNotification } from '@/services/notifications';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

const NOTIFICATION_ITEMS = [
  {
    title: 'Facturas pendientes',
    body: 'Tienes 2 pagos próximos. Pagar a tiempo fortalece tu Pasaporte Financiero.',
  },
  {
    title: 'Recomendación IA',
    body: 'Mantén al menos $950.000 disponibles antes de tomar una nueva cuota.',
  },
  {
    title: 'Avance de Pasaporte',
    body: 'Estás cerca de desbloquear mejores condiciones de crédito.',
  },
];

function SheetFrame({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
      <View
        style={{
          margin: 16,
          padding: 18,
          borderRadius: theme.radii.xxl,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderSoft,
          gap: 16,
          ...theme.shadows.lg,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
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
  );
}

function NotificationsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const [sending, setSending] = useState(false);
  const nativeNotifications = canUseNativeNotifications();

  const notifyNow = async () => {
    setSending(true);
    try {
      await sendLocalNotification(
        'Credigrow te recuerda',
        'Revisa tus pagos próximos y protege tu margen libre de esta semana.'
      );
      Alert.alert('Notificación enviada', 'El recordatorio fue enviado correctamente.');
    } catch (err) {
      Alert.alert(
        'No se pudo notificar',
        err instanceof Error ? err.message : 'Revisa permisos de notificaciones.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SheetFrame>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <BellRing size={18} color={theme.colors.primaryDark} />
            </View>
            <View>
              <Text variant="h3">Notificaciones</Text>
              <Text variant="micro" tone="muted">
                Recordatorios financieros importantes
              </Text>
            </View>
          </View>
          <CloseButton onPress={onClose} />
        </View>

        <View style={{ gap: 10 }}>
          {!nativeNotifications ? (
            <View
              style={{
                padding: 12,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.warnSoft,
              }}
            >
              <Text variant="bodySmall" tone="warn">
                En Expo Go se muestran estos recordatorios dentro de la app. Las notificaciones
                nativas requieren un development build o APK instalado.
              </Text>
            </View>
          ) : null}
          {NOTIFICATION_ITEMS.map((item) => (
            <View
              key={item.title}
              style={{
                flexDirection: 'row',
                gap: 10,
                padding: 12,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              <Bell size={16} color={theme.colors.primaryDark} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{item.title}</Text>
                <Text variant="micro" tone="muted">
                  {item.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <PressableScale
          onPress={notifyNow}
          haptic="medium"
          scaleTo={0.98}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.primary,
          }}
        >
          <Send size={17} color={theme.colors.primaryContrast} />
          <Text variant="bodyStrong" style={{ color: theme.colors.primaryContrast }}>
            {sending
              ? 'Enviando...'
              : nativeNotifications
                ? 'Enviar recordatorio ahora'
                : 'Probar en dev build'}
          </Text>
        </PressableScale>
      </SheetFrame>
    </Modal>
  );
}

function FinancialProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const passportPct = Math.round((mockPassport.points / mockPassport.nextLevel) * 100);

  const metrics = [
    { label: 'Saldo billetera', value: formatMoney(mockWallet.balance), Icon: Wallet, tone: 'primary' as const },
    { label: 'Ingresos mes', value: formatMoney(mockWallet.monthlyIncome), Icon: TrendingUp, tone: 'success' as const },
    { label: 'Gastos mes', value: formatMoney(mockWallet.monthlyExpenses), Icon: CreditCard, tone: 'danger' as const },
    { label: 'Margen libre', value: formatMoney(mockWallet.freeMargin), Icon: PiggyBank, tone: 'primary' as const },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SheetFrame>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text variant="h3">Perfil financiero</Text>
            <Text variant="micro" tone="muted">Resumen de salud, cupo y Pasaporte</Text>
          </View>
          <CloseButton onPress={onClose} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {metrics.map(({ label, value, Icon, tone }) => (
            <View
              key={label}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                padding: 12,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.surfaceAlt,
                gap: 5,
              }}
            >
              <Icon size={17} color={tone === 'danger' ? theme.colors.danger : tone === 'success' ? theme.colors.success : theme.colors.primaryDark} />
              <Text variant="micro" tone="muted">{label}</Text>
              <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
            </View>
          ))}
        </View>

        <View style={{ padding: 12, borderRadius: theme.radii.xl, backgroundColor: theme.colors.primarySoft, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="bodyStrong" tone="primary">Pasaporte Financiero</Text>
            <Text variant="caption" tone="primary">{passportPct}%</Text>
          </View>
          <Text variant="micro" tone="primary">
            {mockPassport.points} de {mockPassport.nextLevel} puntos · Nivel {mockPassport.levelName}
          </Text>
          <Text variant="micro" tone="primary">Próximo beneficio: {mockPassport.nextBenefit}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt, gap: 4 }}>
            <Text variant="micro" tone="muted">Crédito disponible</Text>
            <Text variant="bodyStrong" tone="primary">{formatMoney(mockCredit.estimatedAmount)}</Text>
            <Text variant="micro" tone="muted">Riesgo {mockCredit.risk}</Text>
          </View>
          <View style={{ flex: 1, padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt, gap: 4 }}>
            <Text variant="micro" tone="muted">Estado</Text>
            <Text variant="bodyStrong" tone="success">{mockOverview.status}</Text>
            <Text variant="micro" tone="muted">Balance +{mockOverview.netBalance.deltaPct}%</Text>
          </View>
        </View>

        <View style={{ padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt }}>
          <Text variant="bodySmall" tone="muted">
            Recomendación: mantén tu margen libre sobre {formatMoney(900000)} y paga facturas a tiempo para mejorar tu cupo.
          </Text>
        </View>
      </SheetFrame>
    </Modal>
  );
}

function ProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
  const [financialVisible, setFinancialVisible] = useState(false);
  const authUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const user = authUser
    ? {
        ...mockUser,
        id: authUser.id,
        name: authUser.name,
        phone: authUser.phone,
        type: authUser.type ?? mockUser.type,
        email: authUser.email ?? mockUser.email,
      }
    : { ...mockUser, phone: 'Celular no disponible' };

  const handleSignOut = async () => {
    await signOut();
    onClose();
    router.replace('/(auth)/phone');
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <SheetFrame>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="h3">Mi perfil</Text>
            <CloseButton onPress={onClose} />
          </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primarySoft,
              borderWidth: 2,
              borderColor: theme.colors.primary,
            }}
          >
            <UserIcon size={28} color={theme.colors.primaryDark} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="h2" numberOfLines={1}>
              {user.name}
            </Text>
            <Text variant="bodySmall" tone="muted" numberOfLines={1}>
              {user.type}
            </Text>
            <Text variant="micro" tone="soft" numberOfLines={1}>
              {user.phone}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color={theme.colors.primaryDark} />
              <Text variant="micro" tone="primary">
                {user.level}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: theme.radii.xl, backgroundColor: theme.colors.surfaceAlt }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Star size={18} color={theme.colors.primaryDark} fill={theme.colors.primaryDark} />
            <Text variant="bodyStrong">{user.points}</Text>
            <Text variant="micro" tone="muted">Puntos</Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.colors.borderSoft }} />
          <View style={{ flex: 1, gap: 4 }}>
            <CreditCard size={18} color={theme.colors.primaryDark} />
            <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(mockCredit.estimatedAmount)}
            </Text>
            <Text variant="micro" tone="muted">Crédito</Text>
          </View>
        </View>

          <PressableScale
            onPress={() => setFinancialVisible(true)}
            haptic="selection"
            scaleTo={0.98}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.primary,
            }}
          >
            <ShieldCheck size={18} color={theme.colors.primaryContrast} />
            <Text variant="bodyStrong" style={{ color: theme.colors.primaryContrast }}>Ver perfil financiero</Text>
          </PressableScale>

          <PressableScale
            onPress={handleSignOut}
            haptic="medium"
            scaleTo={0.98}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: theme.colors.dangerSoft,
              backgroundColor: theme.colors.surface,
            }}
          >
            <LogOut size={18} color={theme.colors.danger} />
            <Text variant="bodyStrong" tone="danger">Cerrar sesión</Text>
          </PressableScale>
        </SheetFrame>
      </Modal>
      <FinancialProfileModal visible={financialVisible} onClose={() => setFinancialVisible(false)} />
    </>
  );
}

type Props = {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  notifications?: number;
  showActions?: boolean;
  onProfilePress?: () => void;
  onNotificationPress?: () => void;
};

export function Header({
  title = 'FinGrow',
  subtitle,
  showLogo = true,
  notifications = 4,
  showActions = true,
}: Props) {
  const { theme, mode, toggleMode } = useTheme();
  const [profileVisible, setProfileVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  const openProfile = () => {
    setProfileVisible(true);
  };

  const openNotifications = () => {
    setNotificationsVisible(true);
  };

  return (
    <View>
      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
      <NotificationsModal visible={notificationsVisible} onClose={() => setNotificationsVisible(false)} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 6,
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
          {showLogo ? (
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="h2" style={{ color: '#0E0F0E' }}>F</Text>
            </View>
          ) : null}
          <View style={{ flexShrink: 1 }}>
            <Text variant="h2">{title}</Text>
            {subtitle ? <Text variant="bodySmall" tone="muted" numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        {showActions ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <PressableScale
              onPress={toggleMode}
              haptic="light"
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
              accessibilityLabel={mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
            >
              {mode === 'light' ? <Moon size={18} color={theme.colors.text} strokeWidth={2} /> : <Sun size={18} color={theme.colors.text} strokeWidth={2} />}
            </PressableScale>

            <PressableScale
              onPress={openNotifications}
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
              accessibilityLabel="Notificaciones"
            >
              <Bell size={18} color={theme.colors.text} strokeWidth={2} />
              {notifications > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 3,
                    borderRadius: 8,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: theme.colors.bg,
                  }}
                >
                  <Text variant="micro" style={{ color: '#0E0F0E', fontSize: 9 }}>{notifications}</Text>
                </View>
              ) : null}
            </PressableScale>

            <PressableScale
              onPress={openProfile}
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
              accessibilityLabel="Mi perfil"
            >
              <UserIcon size={18} color={theme.colors.text} strokeWidth={2} />
            </PressableScale>
          </View>
        ) : null}
      </View>
    </View>
  );
}
