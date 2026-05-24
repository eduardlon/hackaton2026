import { Tabs } from 'expo-router';

import { BottomTabBar, type AppTabBarProps } from '@/components/BottomTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => (
        <BottomTabBar {...(props as unknown as AppTabBarProps)} />
      )}
      >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="credito" options={{ title: 'Crédito' }} />
      <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="analisis" options={{ title: 'Análisis' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
