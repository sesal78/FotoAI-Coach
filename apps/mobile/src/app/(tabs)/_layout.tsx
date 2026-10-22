import { Tabs } from 'expo-router';
import { Camera, Compass, Images, Sun, UserRound } from 'lucide-react-native';
import { View } from 'react-native';

import { CoachButton } from '../../ui/CoachButton';
import { OnboardingGate } from '../../ui/OnboardingGate';
import { ThemeSync, useTheme } from '../../ui/ThemeProvider';

export default function TabsLayout() {
  const { tokens } = useTheme();
  const c = tokens.colors;
  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.primary,
          tabBarInactiveTintColor: c.textMuted,
          tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        }}
      >
        <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Sun color={color} size={size} /> }} />
        <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
        <Tabs.Screen name="shoot" options={{ title: 'Shoot', tabBarIcon: ({ color, size }) => <Camera color={color} size={size} /> }} />
        <Tabs.Screen name="photos" options={{ title: 'Photos', tabBarIcon: ({ color, size }) => <Images color={color} size={size} /> }} />
        <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
      </Tabs>
      <CoachButton />
      <ThemeSync />
      <OnboardingGate />
    </View>
  );
}
