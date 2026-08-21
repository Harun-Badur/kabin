import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppErrorBoundary from '../components/AppErrorBoundary';
import { AuthProvider, useAuthContext } from '../hooks/useAuthContext';
import { logger } from '../lib/logger';
import { STACK_TRANSITION_MS } from '../lib/motion';
import { colors, spacing } from '../lib/theme';
import { useAppStore } from '../store/useAppStore';

const registerPushIfSupported = async (userId: string): Promise<void> => {
  if (Constants.appOwnership === 'expo') {
    return;
  }

  try {
    const { registerForPushNotifications } = await import(
      '../services/notificationService'
    );
    await registerForPushNotifications(userId);
  } catch (error: unknown) {
    logger.info('Push kaydı atlandı', { error });
  }
};

function RootNavigator() {
  const { user, loading } = useAuthContext();
  const hydrateSession = useAppStore((state) => state.hydrateSession);
  const resetSession = useAppStore((state) => state.resetSession);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null) {
      resetSession();
      return;
    }
    void hydrateSession(userId);
    void registerPushIfSupported(userId);
  }, [hydrateSession, resetSession, userId]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.bootText}>Kabin açılıyor...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: styles.stackContent,
        animation: 'fade',
        animationDuration: STACK_TRANSITION_MS,
      }}
    >
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="auth" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppErrorBoundary>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="dark" />
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  stackContent: {
    backgroundColor: colors.bg,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  bootText: {
    marginTop: spacing.lg,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
});
