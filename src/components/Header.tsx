import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CreditCard,
  LogOut,
  Moon,
  ShieldCheck,
  Star,
  Sun,
  User as UserIcon,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Modal, View } from 'react-native';

import { mockCredit, mockUser } from '@/data/mock';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

function ProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { theme } = useTheme();
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
            padding: 18,
            borderRadius: theme.radii.xxl,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
            gap: 16,
            ...theme.shadows.lg,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="h3">Mi perfil</Text>
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

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              padding: 12,
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.surfaceAlt,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Star size={18} color={theme.colors.primaryDark} fill={theme.colors.primaryDark} />
              <Text variant="bodyStrong">{user.points}</Text>
              <Text variant="micro" tone="muted">
                Puntos
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: theme.colors.borderSoft }} />
            <View style={{ flex: 1, gap: 4 }}>
              <CreditCard size={18} color={theme.colors.primaryDark} />
              <Text variant="bodyStrong" numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(mockCredit.estimatedAmount)}
              </Text>
              <Text variant="micro" tone="muted">
                Crédito
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <PressableScale
              haptic="selection"
              scaleTo={0.98}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 13,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <ShieldCheck size={18} color={theme.colors.primaryDark} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Pasaporte Financiero</Text>
                <Text variant="micro" tone="muted">
                  Revisa tu nivel, puntos y beneficios.
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.primaryDark} />
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
              <Text variant="bodyStrong" tone="danger">
                Cerrar sesión
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
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
  onProfilePress,
  onNotificationPress,
}: Props) {
  const { theme, mode, toggleMode } = useTheme();
  const [profileVisible, setProfileVisible] = useState(false);

  const handleProfilePress = () => {
    onProfilePress?.();
    setProfileVisible(true);
  };

  return (
    <View>
      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
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
            <Text variant="h2" style={{ color: '#0E0F0E' }}>
              F
            </Text>
          </View>
        ) : null}
        <View style={{ flexShrink: 1 }}>
          <Text variant="h2">{title}</Text>
          {subtitle ? (
            <Text variant="bodySmall" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
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
            accessibilityLabel={
              mode === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'
            }
          >
            {mode === 'light' ? (
              <Moon size={18} color={theme.colors.text} strokeWidth={2} />
            ) : (
              <Sun size={18} color={theme.colors.text} strokeWidth={2} />
            )}
          </PressableScale>

          <PressableScale
            onPress={onNotificationPress}
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
                <Text variant="micro" style={{ color: '#0E0F0E', fontSize: 9 }}>
                  {notifications}
                </Text>
              </View>
            ) : null}
          </PressableScale>

          <PressableScale
            onPress={handleProfilePress}
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
