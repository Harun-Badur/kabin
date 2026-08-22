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
import { colors, radius, shadows, spacing } from '../../lib/theme';
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
      'Hesabın ve tüm verilerin (beğeniler, geçilen ürünler, bildirim kayıtları) kalıcı olarak silinecek. Bu işlem geri alınamaz.',
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
          Bu ekran yakında dolap tercihleri ve beden bilgisi için genişleyecek.
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
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.signOutText}>Çıkış yap</Text>
          )}
        </PressableScale>
      </View>

      <PressableScale
        onPress={handleDeleteAccount}
        disabled={isBusy}
        style={styles.deleteLink}
        accessibilityRole="button"
        accessibilityLabel="Hesabı sil"
      >
        {isDeleting ? (
          <ActivityIndicator color={colors.destructive} />
        ) : (
          <Text style={styles.deleteLinkText}>Hesabı Sil</Text>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    paddingTop: 56,
    paddingHorizontal: spacing.xl,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.xl,
    ...shadows.card,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  email: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.destructive,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  linkButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  linkButtonText: {
    color: colors.accentDark,
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  signOut: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  deleteLink: {
    marginTop: 'auto',
    alignSelf: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  deleteLinkText: {
    color: colors.destructive,
    fontSize: 14,
    fontWeight: '600',
  },
});
