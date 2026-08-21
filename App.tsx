import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import AuthScreen from './app/auth';
import FeedScreen from './app/feed';
import LikedScreen from './app/liked';
import ProfileScreen from './app/profile';
import BottomNav, { type AppTab } from './components/BottomNav';
import { useAuth } from './hooks/useAuth';
import { useAppStore } from './store/useAppStore';

const registerPushIfSupported = async (userId: string): Promise<void> => {
  if (Constants.appOwnership === 'expo') {
    return;
  }

  try {
    const { registerForPushNotifications } = await import(
      './services/notificationService'
    );
    await registerForPushNotifications(userId);
  } catch (error: unknown) {
    console.info('Push kaydı atlandı', { error });
  }
};

export default function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const hydrateSession = useAppStore((state) => state.hydrateSession);
  const resetSession = useAppStore((state) => state.resetSession);
  const [activeTab, setActiveTab] = useState<AppTab>('explore');

  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null) {
      resetSession();
      setActiveTab('explore');
      return;
    }
    void hydrateSession(userId);
    void registerPushIfSupported(userId);
  }, [hydrateSession, resetSession, userId]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#0F172A" size="large" />
        <Text style={styles.bootText}>Kabin açılıyor...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.root}>
        <AuthScreen
          onSignIn={(email, password) => signIn({ email, password })}
          onSignUp={(email, password) => signUp({ email, password })}
        />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.screen}>
        {activeTab === 'explore' ? (
          <FeedScreen canLike onRequireAuth={() => setActiveTab('profile')} />
        ) : null}
        <View
          style={
            activeTab === 'liked' ? styles.screen : styles.hiddenScreen
          }
          pointerEvents={activeTab === 'liked' ? 'auto' : 'none'}
        >
          <LikedScreen isFocused={activeTab === 'liked'} />
        </View>
        {activeTab === 'profile' ? (
          <ProfileScreen user={user} onSignOut={signOut} />
        ) : null}
      </View>
      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  screen: {
    flex: 1,
  },
  hiddenScreen: {
    display: 'none',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  bootText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
});
