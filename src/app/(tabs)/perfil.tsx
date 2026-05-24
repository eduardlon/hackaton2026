import { useRouter } from 'expo-router';
import {
  Bell,
  BellRing,
  Camera,
  ChevronRight,
  FileText,
  Fingerprint,
  HelpCircle,
  Link2,
  Lock,
  LogOut,
  Settings,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Star,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

import {
  Badge,
  Card,
  IconCircle,
  PointsBadge,
  PressableScale,
  ScreenContainer,
  StaggeredList,
  Switch,
  Text,
} from '@/components';
import { mockUser } from '@/data/mock';
import { useAuthStore } from '@/store/authStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

const MENU_ITEMS = [
  { id: 'pasaporte', label: 'Mi Pasaporte Financiero', Icon: ShieldCheck },
  { id: 'datos', label: 'Datos personales', Icon: UserIcon },
  { id: 'cuentas', label: 'Cuentas vinculadas', Icon: Link2 },
  { id: 'seguridad', label: 'Seguridad y biometría', Icon: ShieldQuestion },
  { id: 'notificaciones', label: 'Notificaciones', Icon: Bell },
  { id: 'privacidad', label: 'Privacidad y permisos', Icon: Lock },
  { id: 'ayuda', label: 'Ayuda y soporte', Icon: HelpCircle },
] as const;

export default function PerfilScreen() {
  const { theme, toggleMode, mode } = useTheme();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const user = {
    id: authUser?.id ?? 'sin-sesion',
    name: authUser?.name ?? 'Sin sesión activa',
    phone: authUser?.phone ?? 'Celular no disponible',
    type: authUser?.type ?? 'Cuenta FinGrow',
    email: authUser?.email ?? 'Sin correo registrado',
    level: mockUser.level,
    points: mockUser.points,
  };
  const signOut = useAuthStore((s) => s.signOut);

  const prefs = usePreferencesStore();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/phone');
  };

  return (
    <ScreenContainer hasTabBar>
      {/* Header local */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <Text variant="h1">Perfil</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <PressableScale
            onPress={toggleMode}
            scaleTo={0.92}
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
          >
            <Text style={{ color: theme.colors.text }}>{mode === 'light' ? '☾' : '☀'}</Text>
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
            <Bell size={18} color={theme.colors.text} />
            <View
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 14,
                height: 14,
                paddingHorizontal: 3,
                borderRadius: 7,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: theme.colors.bg,
              }}
            >
              <Text variant="micro" style={{ color: '#0E0F0E', fontSize: 8 }}>
                4
              </Text>
            </View>
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
            <Settings size={18} color={theme.colors.text} />
          </PressableScale>
        </View>
      </View>

      {/* User card */}
      <Card delay={0} padded style={{ padding: 18, gap: 14, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.colors.primary,
              }}
            >
              <UserIcon size={28} color={theme.colors.primaryDark} />
            </View>
            <PressableScale
              scaleTo={0.9}
              haptic="medium"
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.colors.bg,
              }}
            >
              <Camera size={12} color="#0E0F0E" strokeWidth={2.4} />
            </PressableScale>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="h2" numberOfLines={1}>
              {user.name}
            </Text>
            <Text variant="bodySmall" tone="muted">
              {user.type}
            </Text>
            <Text variant="micro" tone="soft" numberOfLines={1}>
              {user.phone}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Badge label="Verificado" tone="primary" icon={ShieldCheck} />
              <Badge label={user.level} tone="primary" icon={ShieldCheck} />
            </View>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: theme.colors.borderSoft,
          }}
        >
          <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Star size={18} color={theme.colors.primaryDark} fill={theme.colors.primaryDark} />
            <Text variant="bodyStrong">{user.points}</Text>
            <Text variant="micro" tone="muted">
              Puntos
            </Text>
            <PointsBadge value={35} delay={300} />
          </View>
          <View
            style={{
              width: 1,
              backgroundColor: theme.colors.borderSoft,
              marginVertical: 4,
            }}
          />
          <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <TrendingUp size={18} color={theme.colors.primaryDark} />
            <Text variant="bodyStrong" numberOfLines={1}>
              {formatMoney(800000)}
            </Text>
            <Text variant="micro" tone="muted">
              Crédito estimado
            </Text>
            <Text variant="micro" tone="primary">
              Disponible
            </Text>
          </View>
          <View
            style={{
              width: 1,
              backgroundColor: theme.colors.borderSoft,
              marginVertical: 4,
            }}
          />
          <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <FileText size={18} color={theme.colors.primaryDark} />
            <Text variant="bodyStrong">12</Text>
            <Text variant="micro" tone="muted">
              Facturas pagadas
            </Text>
            <Text variant="micro" tone="muted">
              Este mes
            </Text>
          </View>
        </View>
      </Card>

      {/* Menú */}
      <Card delay={120} padded style={{ padding: 6, marginBottom: 14 }}>
        <StaggeredList delayStep={60} gap={2} initialDelay={150}>
          {MENU_ITEMS.map(({ id, label, Icon }) => (
            <PressableScale
              key={id}
              scaleTo={0.98}
              haptic="selection"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: theme.radii.lg,
              }}
            >
              <IconCircle Icon={Icon} tone="primary" size={36} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {label}
              </Text>
              <ChevronRight size={18} color={theme.colors.textSoft} />
            </PressableScale>
          ))}
        </StaggeredList>
      </Card>

      {/* Preferencias */}
      <Card delay={260} padded style={{ padding: 18, gap: 14, marginBottom: 14 }}>
        <Text variant="h3">Preferencias</Text>
        {[
          {
            key: 'paymentAlerts',
            title: 'Alertas de pagos',
            description: 'Recibe recordatorios y notificaciones importantes.',
            Icon: BellRing,
          },
          {
            key: 'aiRecommendations',
            title: 'Recomendaciones IA',
            description: 'Sugerencias personalizadas para ti.',
            Icon: Sparkles,
          },
          {
            key: 'biometricLogin',
            title: 'Ingreso con biometría',
            description: 'Usa tu huella o rostro para ingresar.',
            Icon: Fingerprint,
          },
        ].map(({ key, title, description, Icon }) => (
          <View
            key={key}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <IconCircle Icon={Icon} tone="primary" size={36} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{title}</Text>
              <Text variant="micro" tone="muted">
                {description}
              </Text>
            </View>
            <Switch
              value={prefs[key as 'paymentAlerts' | 'aiRecommendations' | 'biometricLogin']}
              onValueChange={() =>
                prefs.toggle(key as 'paymentAlerts' | 'aiRecommendations' | 'biometricLogin')
              }
            />
          </View>
        ))}
      </Card>

      {/* Cerrar sesión */}
      <PressableScale
        onPress={handleSignOut}
        scaleTo={0.97}
        haptic="medium"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.borderSoft,
          ...theme.shadows.sm,
        }}
      >
        <LogOut size={18} color={theme.colors.danger} strokeWidth={2} />
        <Text variant="bodyStrong" tone="danger">
          Cerrar sesión
        </Text>
      </PressableScale>
    </ScreenContainer>
  );
}
