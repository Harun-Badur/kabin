import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthStatus, SignUpResult } from '../types/auth';

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<SignUpResult>;
}

type AuthMode = 'login' | 'signup';

const MIN_PASSWORD_LENGTH = 6;

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function AuthScreen({
  onSignIn,
  onSignUp,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [isInfoMessage, setIsInfoMessage] = useState(false);

  const title = mode === 'login' ? 'Kabin\'e hoş geldin' : 'Kabin hesabı oluştur';
  const submitLabel = mode === 'login' ? 'Giriş yap' : 'Kayıt ol';
  const toggleLabel =
    mode === 'login'
      ? 'Hesabın yok mu? Kayıt ol'
      : 'Zaten hesabın var mı? Giriş yap';

  const handleSubmit = async (): Promise<void> => {
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setIsInfoMessage(false);
      setMessage('Geçerli bir e-posta adresi gir.');
      setStatus('error');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setIsInfoMessage(false);
      setMessage(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage(null);
    try {
      if (mode === 'login') {
        await onSignIn(trimmedEmail, password);
        setStatus('success');
        return;
      }
      const result = await onSignUp(trimmedEmail, password);
      if (result.needsEmailConfirmation) {
        setIsInfoMessage(true);
        setMessage(
          'Kayıt alındı. E-posta doğrulaması açıksa gelen bağlantıyı onayla, sonra giriş yap.',
        );
        setStatus('success');
        return;
      }
      setStatus('success');
    } catch (error) {
      const text =
        error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
      const isConfirmation = text.includes('Kayıt alındı');
      setIsInfoMessage(isConfirmation);
      setMessage(text);
      setStatus(isConfirmation ? 'success' : 'error');
    }
  };

  const isLoading = status === 'loading';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>Kabin</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          Beğenilerin dolabında kalsın. Sanal denemeye devam etmek için giriş
          yap.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={styles.input}
          editable={!isLoading}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          style={styles.input}
          editable={!isLoading}
        />

        {message ? (
          <Text style={isInfoMessage ? styles.info : styles.error}>
            {message}
          </Text>
        ) : null}

        <Pressable
          onPress={() => {
            void handleSubmit();
          }}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.submit,
            pressed || isLoading ? styles.submitPressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
        >
          {isLoading ? (
            <ActivityIndicator color="#F8FAFC" />
          ) : (
            <Text style={styles.submitText}>{submitLabel}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setMessage(null);
            setStatus('idle');
          }}
          disabled={isLoading}
          accessibilityRole="button"
        >
          <Text style={styles.toggle}>{toggleLabel}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#0F172A',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
    marginBottom: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  info: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  submit: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitPressed: {
    opacity: 0.82,
  },
  submitText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  toggle: {
    marginTop: 18,
    textAlign: 'center',
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
});
