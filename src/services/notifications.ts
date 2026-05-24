import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExpoNotifications = typeof import('expo-notifications');

let configured = false;
let notificationsModule: ExpoNotifications | null = null;

export function canUseNativeNotifications() {
  // Expo Go no soporta notificaciones push remotas en Android desde SDK 53.
  // Evitamos importar expo-notifications ahí porque el módulo avisa/falla al cargar.
  return Constants.appOwnership !== 'expo';
}

async function getNotificationsModule(): Promise<ExpoNotifications> {
  if (!canUseNativeNotifications()) {
    throw new Error('Las notificaciones nativas requieren un development build o APK instalado.');
  }

  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  return notificationsModule;
}

export async function configureNotifications(): Promise<boolean> {
  if (!canUseNativeNotifications()) return false;

  const Notifications = await getNotificationsModule();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('credigrow-default', {
      name: 'Credigrow',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A7E800',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let finalStatus = current.status;
  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = requested.status;
  }

  configured = finalStatus === 'granted';
  return configured;
}

export async function sendLocalNotification(title: string, body: string) {
  const Notifications = await getNotificationsModule();
  const canNotify = configured || (await configureNotifications());
  if (!canNotify) {
    throw new Error('Permiso de notificaciones denegado');
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { source: 'credigrow' },
    },
    trigger: null,
  });
}
