import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AuthUser } from '../types/auth';

interface ProfileScreenProps {
  user: AuthUser;
  onSignOut: () => Promise<void>;
}

export default function ProfileScreen({
  user,
  onSignOut,
}: ProfileScreenProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true);
    setErrorMessage(null);
    try {
      await onSignOut();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Çıkış yapılamadı.',
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.header}>Profil</Text>
      <View style={styles.card}>
        <Text style={styles.label}>E-posta</Text>
        <Text style={styles.email}>{user.email ?? 'E-posta yok'}</Text>
        <Text style={styles.hint}>
          Bu ekran yakında dolap tercihleri ve beden bilgisi için
          genişleyecek.
        </Text>
        {errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}
        <Pressable
          onPress={() => {
            void handleSignOut();
          }}
          disabled={isSigningOut}
          style={({ pressed }) => [
            styles.signOut,
            pressed || isSigningOut ? styles.pressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Çıkış yap"
        >
          {isSigningOut ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={styles.signOutText}>Çıkış yap</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  email: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    marginBottom: 20,
  },
  error: {
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 12,
  },
  signOut: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
});
