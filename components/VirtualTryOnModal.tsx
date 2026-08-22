import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ImageIcon, RotateCcw, Sparkles, X } from 'lucide-react-native';
import PressableScale from './PressableScale';
import SkeletonShimmer from './SkeletonShimmer';
import { grantVtonConsent, hasVtonConsent } from '../lib/consent';
import { hapticSuccess } from '../lib/haptics';
import { logger } from '../lib/logger';
import {
  CONSENT_ENTER_DURATION_MS,
  HERO_GROW_DURATION_MS,
  MODAL_BACKDROP_MAX_OPACITY,
  MODAL_SLIDE_DURATION_MS,
} from '../lib/motion';
import { PRIVACY_URL } from '../lib/privacy';
import { colors, radius, spacing } from '../lib/theme';
import {
  tryOnGarment,
  VtonServiceError,
} from '../services/vtonService';
import type { Product } from '../types/product';
import type { TryOnStatus } from '../types/vton';

const IMAGE_MAX_WIDTH = 768;
const ICON_SIZE = 16;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_CLOSE_DURATION_MS = 220;
const LOADING_MESSAGES = [
  'Kombinin hazırlanıyor...',
  'Kıyafet giydiriliyor...',
] as const;
const LOADING_MESSAGE_INTERVAL_MS = 2500;
const SLOW_HINT_AFTER_MS = 20_000;
const SLOW_HINT_TEXT = 'İlk deneme biraz uzun sürebilir';
const LOADING_SHIMMER_WIDTH = SCREEN_WIDTH - spacing.xl * 2;
const LOADING_SHIMMER_HEIGHT = 160;

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
  const [isRendered, setIsRendered] = useState(visible);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [showSlowHint, setShowSlowHint] = useState(false);

  const lastProductRef = useRef(product);
  if (product) {
    lastProductRef.current = product;
  }
  const displayProduct = product ?? lastProductRef.current;

  const pulse = useSharedValue(0.55);
  const sheetProgress = useSharedValue(0);
  const consentProgress = useSharedValue(0);
  const heroProgress = useSharedValue(0);

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

  useEffect(() => {
    if (status !== 'loading') {
      setLoadingMessageIndex(0);
      setShowSlowHint(false);
      return;
    }

    const rotateId = setInterval(() => {
      setLoadingMessageIndex(
        (current) => (current + 1) % LOADING_MESSAGES.length,
      );
    }, LOADING_MESSAGE_INTERVAL_MS);
    const slowHintId = setTimeout(() => {
      setShowSlowHint(true);
    }, SLOW_HINT_AFTER_MS);

    return () => {
      clearInterval(rotateId);
      clearTimeout(slowHintId);
    };
  }, [status]);

  // withRepeat sonsuz döngüde; unmount'ta iptal edilmezse worklet çalışmaya
  // devam eder ve shared value sızar.
  useEffect(
    () => () => {
      cancelAnimation(pulse);
      cancelAnimation(sheetProgress);
      cancelAnimation(consentProgress);
      cancelAnimation(heroProgress);
    },
    [consentProgress, heroProgress, pulse, sheetProgress],
  );

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.92 + pulse.value * 0.12 }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: sheetProgress.value * MODAL_BACKDROP_MAX_OPACITY,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          sheetProgress.value,
          [0, 1],
          [SCREEN_HEIGHT, 0],
        ),
      },
    ],
  }));

  const consentEnterStyle = useAnimatedStyle(() => ({
    opacity: consentProgress.value,
    transform: [
      { scale: interpolate(consentProgress.value, [0, 1], [0.9, 1]) },
    ],
  }));

  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, [0, 1], [0.35, 1]),
    transform: [
      { scale: interpolate(heroProgress.value, [0, 1], [0.78, 1]) },
    ],
  }));

  const resetState = useCallback((): void => {
    setStatus('idle');
    setErrorMessage(resetMessage);
    setPersonImageUri(null);
    setResultImageUrl(null);
  }, []);

  const finishExit = useCallback((): void => {
    resetState();
    setIsRendered(false);
  }, [resetState]);

  const handleClose = useCallback((): void => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      sheetProgress.value = withTiming(1, {
        duration: MODAL_SLIDE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    sheetProgress.value = withTiming(
      0,
      {
        duration: SHEET_CLOSE_DURATION_MS,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishExit)();
        }
      },
    );
  }, [finishExit, sheetProgress, visible]);

  useEffect(() => {
    if (!visible) {
      consentProgress.value = 0;
      heroProgress.value = 0;
      return;
    }

    if (consentStatus === 'required') {
      consentProgress.value = 0;
      consentProgress.value = withTiming(1, {
        duration: CONSENT_ENTER_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
    }

    if (consentStatus === 'granted') {
      heroProgress.value = 0;
      heroProgress.value = withTiming(1, {
        duration: HERO_GROW_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [consentProgress, consentStatus, heroProgress, visible]);

  // Sekme katmanı, kök sekmedeyken geri tuşuyla uygulamadan çıkışı engelliyor.
  // Modal görünürken geri tuşunun sahibi burasıdır; aksi halde o engel modalın
  // kapanmasını da yutar.
  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleClose();
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [handleClose, visible]);

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
      logger.error('Fotoğraf seçilemedi', { error });
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
      hapticSuccess();
    } catch (error) {
      const message =
        error instanceof VtonServiceError
          ? error.message
          : 'Sanal deneme tamamlanamadı. Lütfen tekrar dene.';
      logger.error('Sanal deneme isteği başarısız', { error });
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
      logger.error('Gizlilik politikası açılamadı', { error });
      Alert.alert(
        'Bağlantı açılamadı',
        'Gizlilik politikası bu cihazda açılamadı.',
      );
    });
  }, []);

  if (!displayProduct || !isRendered) {
    return null;
  }

  const isConsentFlow = consentStatus !== 'granted';

  return (
    <Modal
      visible={isRendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, backdropStyle]}
        />
        <Animated.View style={[styles.screen, sheetStyle]}>
          {isConsentFlow ? (
            consentStatus === 'checking' ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
            ) : (
              <Animated.View style={[styles.consentFill, consentEnterStyle]}>
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
                <PressableScale
                  onPress={handleOpenPrivacy}
                  accessibilityRole="link"
                  accessibilityLabel="Gizlilik Politikası"
                >
                  <Text style={styles.consentLink}>Gizlilik Politikası</Text>
                </PressableScale>
              </ScrollView>

              <View style={styles.footer}>
                <View style={styles.footerRow}>
                  <PressableScale
                    onPress={handleClose}
                    style={styles.secondaryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Vazgeç"
                  >
                    <Text style={styles.secondaryButtonText}>Vazgeç</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={handleAcceptConsent}
                    style={styles.primaryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Kabul Et"
                  >
                    <Text style={styles.primaryButtonText}>Kabul Et</Text>
                  </PressableScale>
                </View>
              </View>
              </Animated.View>
            )
          ) : (
            <>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Sanal deneme</Text>
          </View>
          <PressableScale
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <X color={colors.text} size={22} />
          </PressableScale>
        </View>

        <Animated.View style={[styles.heroCard, heroStyle]}>
          <Image
            source={{ uri: displayProduct.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={displayProduct.id}
          />
        </Animated.View>
        <View style={styles.garmentRow}>
          <View style={styles.garmentCopy}>
            <Text style={styles.garmentKicker}>Giydirilecek ürün</Text>
            <Text style={styles.garmentTitle} numberOfLines={1}>
              {displayProduct.title}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {status === 'loading' ? (
            <View style={styles.centerBlock}>
              <SkeletonShimmer
                width={LOADING_SHIMMER_WIDTH}
                height={LOADING_SHIMMER_HEIGHT}
                borderRadius={radius.card}
              />
              <Animated.View style={[styles.loadingOrb, pulseStyle]}>
                <Sparkles color={colors.accent} size={36} />
              </Animated.View>
              <Text style={styles.loadingText}>
                {LOADING_MESSAGES[loadingMessageIndex]}
              </Text>
              {showSlowHint ? (
                <Text style={styles.slowHint}>{SLOW_HINT_TEXT}</Text>
              ) : (
                <Text style={styles.hint}>{displayProduct.brand}</Text>
              )}
            </View>
          ) : null}

          {status === 'success' && resultImageUrl ? (
            <View style={styles.resultBlock}>
              <Image
                source={{ uri: resultImageUrl }}
                style={styles.resultImage}
                contentFit="contain"
                cachePolicy="none"
                recyclingKey={resultImageUrl}
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
                  contentFit="cover"
                  cachePolicy="none"
                  recyclingKey={personImageUri}
                />
              ) : (
                <View style={styles.placeholder}>
                  <ImageIcon color={colors.textSecondary} size={42} />
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
            <PressableScale onPress={handlePickPhoto} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Fotoğraf Seç</Text>
            </PressableScale>
          ) : null}

          {status === 'idle' && personImageUri ? (
            <View style={styles.footerRow}>
              <PressableScale onPress={handlePickPhoto} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Değiştir</Text>
              </PressableScale>
              <PressableScale onPress={handleTryOn} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>🚀 Üzerimde Dene</Text>
              </PressableScale>
            </View>
          ) : null}

          {status === 'success' ? (
            <View style={styles.footerRow}>
              <PressableScale onPress={handleRetry} style={styles.secondaryButton}>
                <RotateCcw color={colors.text} size={ICON_SIZE} />
                <Text style={styles.secondaryButtonText}>Tekrar Dene</Text>
              </PressableScale>
              <PressableScale onPress={handleClose} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Kapat</Text>
              </PressableScale>
            </View>
          ) : null}

          {status === 'error' ? (
            <View style={styles.footerRow}>
              <PressableScale onPress={handleClose} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Kapat</Text>
              </PressableScale>
              <PressableScale
                onPress={personImageUri ? handleTryOn : handlePickPhoto}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {personImageUri ? 'Tekrar Dene' : 'Fotoğraf Seç'}
                </Text>
              </PressableScale>
            </View>
          ) : null}
        </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 54,
    paddingBottom: 28,
  },
  consentFill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    marginRight: spacing.md,
  },
  kicker: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.chip,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    height: 196,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  garmentCopy: {
    flex: 1,
  },
  garmentKicker: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  garmentTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  previewBlock: {
    flex: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  placeholderHint: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  resultBlock: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.bgSoft,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  consentBody: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  consentTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  consentLead: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 25,
    marginBottom: 18,
  },
  consentItem: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: spacing.md,
  },
  consentLink: {
    color: colors.accentDark,
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginTop: spacing.sm,
  },
  loadingOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: 18,
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  loadingText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: spacing.sm,
  },
  hint: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontSize: 14,
  },
  slowHint: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  errorMessage: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: 18,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.inverseText,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: radius.button,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
