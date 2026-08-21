import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuthContext } from '../../hooks/useAuthContext';
import PressableScale from '../../components/PressableScale';
import { logger } from '../../lib/logger';
import { PRIVACY_URL } from '../../lib/privacy';
import { deleteAccount } from '../../services/accountService';

export default function ProfileScreen() {
  const { user, signOut } = useAuthContext();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = isSigningOut || isDeleting;

  const handleSignOut = async (): Promise<void> => {
    setIsSigningOut(true);
    setErrorMessage(null);
    try {
      await signOut();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Çıkış yapılamadı.',
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const runDeleteAccount = async (): Promise<void> => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deleteAccount();
      await signOut();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Hesap silinemedi.';
      setErrorMessage(message);
      Alert.alert('Hesap silinemedi', message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccount = (): void => {
    Alert.alert(
      'Hesabımı sil',
      'Hesabın ve tüm verilerin (beğeniler, geçilen ürünler, fiyat alarmları, bildirim kayıtları) kalıcı olarak silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kalıcı olarak sil',
          style: 'destructive',
          onPress: () => {
            void runDeleteAccount();
          },
        },
      ],
    );
  };

  const handleOpenPrivacy = (): void => {
    void Linking.openURL(PRIVACY_URL).catch((error: unknown) => {
      logger.error('Gizlilik politikası açılamadı', { error });
      Alert.alert(
        'Bağlantı açılamadı',
        'Gizlilik politikası bu cihazda açılamadı.',
      );
    });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.header}>Profil</Text>
      <View style={styles.card}>
        <Text style={styles.label}>E-posta</Text>
        <Text style={styles.email}>{user?.email ?? 'E-posta yok'}</Text>
        <Text style={styles.hint}>
          Bu ekran yakında dolap tercihleri ve beden bilgisi için
          genişleyecek.
        </Text>
        {errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}
        <PressableScale
          onPress={handleOpenPrivacy}
          style={styles.linkButton}
          accessibilityRole="link"
          accessibilityLabel="Gizlilik politikası"
        >
          <Text style={styles.linkButtonText}>Gizlilik Politikası</Text>
        </PressableScale>
        <PressableScale
          onPress={() => {
            void handleSignOut();
          }}
          disabled={isBusy}
          style={styles.signOut}
          accessibilityRole="button"
          accessibilityLabel="Çıkış yap"
        >
          {isSigningOut ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={styles.signOutText}>Çıkış yap</Text>
          )}
        </PressableScale>
      </View>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Hesabı sil</Text>
        <Text style={styles.dangerHint}>
          Hesabın ve tüm verilerin kalıcı olarak silinir. Bu işlem geri
          alınamaz.
        </Text>
        <PressableScale
          onPress={handleDeleteAccount}
          disabled={isBusy}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel="Hesabımı sil"
        >
          {isDeleting ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={styles.deleteButtonText}>Hesabımı Sil</Text>
          )}
        </PressableScale>
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
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  linkButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
  dangerCard: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 6,
  },
  dangerHint: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
});
