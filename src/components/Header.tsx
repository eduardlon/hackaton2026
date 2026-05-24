import { Bell, Moon, Sun, User as UserIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

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

  return (
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
            onPress={onProfilePress}
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
  );
}
