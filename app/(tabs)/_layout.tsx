import { useEffect } from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Compass, Heart, User } from 'lucide-react-native';
import { TAB_TRANSITION_MS } from '../../lib/motion';
import { colors, spacing } from '../../lib/theme';

const ACTIVE_COLOR = colors.accent;
const INACTIVE_COLOR = colors.tabInactive;
const ICON_SIZE = 22;

export default function TabsLayout() {
  const router = useRouter();

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // Gidilecek bir geçmiş varsa navigator kendi davranışını uygulasın.
        // Kök sekmedeyken geri tuşu uygulamadan çıkmasın.
        return !router.canGoBack();
      },
    );

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        sceneStyle: styles.scene,
        animation: 'shift',
        transitionSpec: {
          animation: 'timing',
          config: { duration: TAB_TRANSITION_MS },
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color }) => <Compass color={color} size={ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="liked"
        options={{
          title: 'Beğenilenler',
          tabBarIcon: ({ color }) => <Heart color={color} size={ICON_SIZE} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User color={color} size={ICON_SIZE} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  item: {
    paddingVertical: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  scene: {
    backgroundColor: colors.bgSoft,
  },
});
