import { Compass, Heart, User } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type AppTab = 'explore' | 'liked' | 'profile';

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

interface TabItem {
  id: AppTab;
  label: string;
  Icon: typeof Compass;
}

const TABS: TabItem[] = [
  { id: 'explore', label: 'Keşfet', Icon: Compass },
  { id: 'liked', label: 'Beğenilenler', Icon: Heart },
  { id: 'profile', label: 'Profil', Icon: User },
];

const ACTIVE_COLOR = '#0F172A';
const INACTIVE_COLOR = '#94A3B8';

export default function BottomNav({
  activeTab,
  onChangeTab,
}: BottomNavProps) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChangeTab(tab.id)}
            style={({ pressed }) => [
              styles.item,
              pressed ? styles.itemPressed : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <tab.Icon color={color} size={22} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  itemPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
