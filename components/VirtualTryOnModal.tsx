import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ImageIcon, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { grantVtonConsent, hasVtonConsent } from '../lib/consent';
import { PRIVACY_URL } from '../lib/privacy';
import {
  tryOnGarment,
  VtonServiceError,
} from '../services/vtonService';
import type { Product } from '../types/product';
import type { TryOnStatus } from '../types/vton';

const IMAGE_MAX_WIDTH = 768;

type ConsentStatus = 'checking' | 'required' | 'granted';

export interface VirtualTryOnModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
}

const resetMessage = '';

export default function VirtualTryOnModal({
  visible,
  product,
  onClose,
}: VirtualTryOnModalProps) {
  const [status, setStatus] = useState<TryOnStatus>('idle');
  const [errorMessage, setErrorMessage] = useState(resetMessage);
  const [personImageUri, setPersonImageUri] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('checking');

  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let isMounted = true;
    void hasVtonConsent().then((granted) => {
      if (isMounted) {
        setConsentStatus(granted ? 'granted' : 'required');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [visible]);

  useEffect(() => {
    if (status === 'loading') {
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return;
    }

    pulse.value = withTiming(0.55, { duration: 200 });
  }, [pulse, status]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.92 + pulse.value * 0.12 }],
  }));

  const resetState = useCallback((): void => {
    setStatus('idle');
    setErrorMessage(resetMessage);
    setPersonImageUri(null);
    setResultImageUrl(null);
  }, []);

  const handleClose = useCallback((): void => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handlePickPhoto = useCallback(async (): Promise<void> => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setStatus('error');
        setErrorMessage(
          'Galerine erişim izni verilmedi. Ayarlardan izin verip tekrar dene.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const actions =
        asset.width > IMAGE_MAX_WIDTH
          ? [{ resize: { width: IMAGE_MAX_WIDTH } }]
          : [];

      const prepared = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      setPersonImageUri(prepared.uri);
      setResultImageUrl(null);
      setErrorMessage(resetMessage);
      setStatus('idle');
    } catch (error) {
      console.error('Failed to pick photo', { error });
      setStatus('error');
      setErrorMessage('Fotoğraf seçilemedi. Lütfen tekrar dene.');
    }
  }, []);

  const handleTryOn = useCallback(async (): Promise<void> => {
    if (!product || !personImageUri) {
      setStatus('error');
      setErrorMessage('Önce tam boy bir fotoğrafını seç.');
      return;
    }

    setStatus('loading');
    setErrorMessage(resetMessage);

    try {
      const outputUrl = await tryOnGarment(personImageUri, product.imageUrl, {
        garmentDescription: product.garmentDescription,
        category: product.category,
      });
      setResultImageUrl(outputUrl);
      setStatus('success');
    } catch (error) {
      const message =
        error instanceof VtonServiceError
          ? error.message
          : 'Sanal deneme tamamlanamadı. Lütfen tekrar dene.';
      console.error('Virtual try-on request failed', { error });
      setStatus('error');
      setErrorMessage(message);
      Alert.alert('Sanal deneme hatası', message);
    }
  }, [personImageUri, product]);

  const handleRetry = useCallback((): void => {
    setStatus('idle');
    setErrorMessage(resetMessage);
    setResultImageUrl(null);
  }, []);

  const handleAcceptConsent = useCallback((): void => {
    setConsentStatus('granted');
    void grantVtonConsent();
  }, []);

  const handleOpenPrivacy = useCallback((): void => {
    void Linking.openURL(PRIVACY_URL).catch((error: unknown) => {
      console.error('Gizlilik politikası açılamadı', { error });
      Alert.alert(
        'Bağlantı açılamadı',
        'Gizlilik politikası bu cihazda açılamadı.',
      );
    });
  }, []);

  if (!product) {
    return null;
  }

  if (consentStatus !== 'granted') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <View style={styles.screen}>
          {consentStatus === 'checking' ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color="#F8FAFC" size="large" />
            </View>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.consentBody}>
                <Text style={styles.kicker}>Sanal deneme</Text>
                <Text style={styles.consentTitle}>
                  Fotoğrafın nasıl işlenir?
                </Text>
                <Text style={styles.consentLead}>
                  Fotoğrafın yalnızca bu deneme için işlenir ve saklanmaz.
                </Text>
                <Text style={styles.consentItem}>
                  • Seçtiğin fotoğraf, giydirme işlemini yapan yapay zekâ
                  servisimize (Modal.com, GPU) şifreli bağlantı üzerinden
                  gönderilir.
                </Text>
                <Text style={styles.consentItem}>
                  • İşlem bittiğinde fotoğraf sunucuda tutulmaz; sonuç görseli
                  yalnızca senin cihazında gösterilir.
                </Text>
                <Text style={styles.consentItem}>
                  • Fotoğrafın reklam, model eğitimi veya üçüncü taraflarla
                  paylaşım için kullanılmaz.
                </Text>
                <Text style={styles.consentItem}>
                  • Bu izni istediğin zaman uygulamayı kaldırarak ya da
                  hesabını silerek geri alabilirsin.
                </Text>
                <Pressable
                  onPress={handleOpenPrivacy}
                  accessibilityRole="link"
                  accessibilityLabel="Gizlilik Politikası"
                >
                  <Text style={styles.consentLink}>Gizlilik Politikası</Text>
                </Pressable>
              </ScrollView>

              <View style={styles.footer}>
                <View style={styles.footerRow}>
                  <Pressable
                    onPress={handleClose}
                    style={styles.secondaryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Vazgeç"
                  >
                    <Text style={styles.secondaryButtonText}>Vazgeç</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAcceptConsent}
                    style={styles.primaryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Kabul Et"
                  >
                    <Text style={styles.primaryButtonText}>Kabul Et</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Sanal deneme</Text>
          </View>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <X color="#F8FAFC" size={22} />
          </Pressable>
        </View>

        <View style={styles.garmentRow}>
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.garmentThumb}
            resizeMode="cover"
          />
          <View style={styles.garmentCopy}>
            <Text style={styles.garmentKicker}>Giydirilecek ürün</Text>
            <Text style={styles.garmentTitle} numberOfLines={1}>
              {product.title}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {status === 'loading' ? (
            <View style={styles.centerBlock}>
              <Animated.View style={[styles.loadingOrb, pulseStyle]}>
                <Sparkles color="#F8FAFC" size={36} />
              </Animated.View>
              <ActivityIndicator color="#F8FAFC" style={styles.spinner} />
              <Text style={styles.loadingText}>
                AI seni giydiriyor... (ilk deneme 1-2 dk sürebilir)
              </Text>
              <Text style={styles.hint}>{product.brand}</Text>
            </View>
          ) : null}

          {status === 'success' && resultImageUrl ? (
            <View style={styles.resultBlock}>
              <Image
                source={{ uri: resultImageUrl }}
                style={styles.resultImage}
                resizeMode="contain"
              />
            </View>
          ) : null}

          {status === 'error' ? (
            <View style={styles.centerBlock}>
              <Text style={styles.errorTitle}>Bir şeyler ters gitti</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          ) : null}

          {status === 'idle' ? (
            <View style={styles.previewBlock}>
              {personImageUri ? (
                <Image
                  source={{ uri: personImageUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholder}>
                  <ImageIcon color="#94A3B8" size={42} />
                  <Text style={styles.placeholderTitle}>Fotoğrafını seç</Text>
                  <Text style={styles.placeholderHint}>
                    Ayakta, net ve mümkünse 3:4 oranlı bir kare en iyi sonucu verir.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          {status === 'idle' && !personImageUri ? (
            <Pressable onPress={handlePickPhoto} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Fotoğraf Seç</Text>
            </Pressable>
          ) : null}

          {status === 'idle' && personImageUri ? (
            <View style={styles.footerRow}>
              <Pressable onPress={handlePickPhoto} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Değiştir</Text>
              </Pressable>
              <Pressable onPress={handleTryOn} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>🚀 Üzerimde Dene</Text>
              </Pressable>
            </View>
          ) : null}

          {status === 'success' ? (
            <View style={styles.footerRow}>
              <Pressable onPress={handleRetry} style={styles.secondaryButton}>
                <RotateCcw color="#F8FAFC" size={16} />
                <Text style={styles.secondaryButtonText}>Tekrar Dene</Text>
              </Pressable>
              <Pressable onPress={handleClose} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Kapat</Text>
              </Pressable>
            </View>
          ) : null}

          {status === 'error' ? (
            <View style={styles.footerRow}>
              <Pressable onPress={handleClose} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Kapat</Text>
              </Pressable>
              <Pressable onPress={personImageUri ? handleTryOn : handlePickPhoto} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {personImageUri ? 'Tekrar Dene' : 'Fotoğraf Seç'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B1220',
    paddingTop: 54,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    marginRight: 12,
  },
  kicker: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 250, 252, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(248, 250, 252, 0.08)',
  },
  garmentThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  garmentCopy: {
    flex: 1,
  },
  garmentKicker: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  garmentTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  previewBlock: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  placeholderTitle: {
    color: '#E2E8F0',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderHint: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  resultBlock: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  consentBody: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  consentTitle: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 12,
  },
  consentLead: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 25,
    marginBottom: 18,
  },
  consentItem: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 12,
  },
  consentLink: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
  loadingOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(248, 250, 252, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  hint: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 14,
  },
  errorTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(248, 250, 252, 0.08)',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
});
