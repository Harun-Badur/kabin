import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Heart, ShoppingBag, Sparkles, X } from 'lucide-react-native';
import PressableScale from './PressableScale';
import { hapticPurchaseIntent, hapticSwipeDecision } from '../lib/haptics';
import { logger } from '../lib/logger';
import {
  CARD_SPRING_BACK,
  CARD_THROW_SPRING,
  PAN_ACTIVE_OFFSET_Y_PX,
  PAN_FAIL_OFFSET_X_PX,
  UNDO_SETTLE_SPRING,
  deckClearTravelPx,
  passProgress,
  shouldCommitPass,
  shouldCommitUndo,
} from '../lib/motion';
import { IMPRESSION_MIN_DWELL_MS } from '../types/analytics';
import {
  colors,
  estimateDiscoverCardHeight,
  layout,
  radius,
  shadows,
  spacing,
} from '../lib/theme';
import {
  formatTryPrice,
  GARMENT_CATEGORY_LABEL,
  getDisplayPrice,
  getDropPercent,
  hasCatalogPriceDrop,
  type Product,
} from '../types/product';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DOUBLE_TAP_MAX_DISTANCE_PX = 16;
const DOUBLE_TAP_MAX_DURATION_MS = 280;
const HEART_BURST_IN_MS = 160;
const HEART_BURST_OUT_MS = 260;
const HEART_BURST_PEAK_SCALE = 1.18;
/** 0: slot reuse/reconcile sırasında expo-image crossfade flash'ini engeller. */
const IMAGE_CROSSFADE_MS = 0;
const ACTION_ICON_SIZE = 16;
const REASON_ICON_SIZE = 12;
/** object-position: top-center — tam boy kadraj (hedef oran ~0.68). */
const IMAGE_CONTENT_POSITION = { top: 0, left: '50%' } as const;

export type { Product };

export interface SwipeCardProps {
  product: Product;
  onAddToCloset: (product: Product) => void;
  onPass: (product: Product) => void;
  onPassExitSettled?: (product: Product) => void;
  onVirtualTryOn: (product: Product) => void;
  onBuy: (product: Product) => void;
  onUndoPass?: () => void;
  onRequireAuth?: () => void;
  onImpression?: (product: Product, dwellMs: number) => void;
  isInteractive?: boolean;
  isExiting?: boolean;
  canLike?: boolean;
  canUndo?: boolean;
  /** Park/çıkış kartında elevation clip dışına taşmasın. */
  castShadow?: boolean;
  deckPullY?: SharedValue<number>;
}

const formatPrice = (product: Product): string =>
  formatTryPrice(getDisplayPrice(product));

export default function SwipeCard({
  product,
  onAddToCloset,
  onPass,
  onPassExitSettled,
  onVirtualTryOn,
  onBuy,
  onUndoPass,
  onRequireAuth,
  onImpression,
  isInteractive = true,
  isExiting = false,
  canLike = true,
  canUndo = false,
  castShadow = true,
  deckPullY,
}: SwipeCardProps) {
  const [hasImageError, setHasImageError] = useState(false);

  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const hasExited = useSharedValue(false);
  const heartBurst = useSharedValue(0);

  useEffect(
    () => () => {
      cancelAnimation(translateY);
      cancelAnimation(cardScale);
      cancelAnimation(heartBurst);
    },
    [cardScale, heartBurst, translateY],
  );

  useLayoutEffect(() => {
    if (isExiting) {
      return;
    }
    if (isInteractive) {
      if (hasExited.value) {
        hasExited.value = false;
        translateY.value = withSpring(0, CARD_SPRING_BACK);
      }
      return;
    }
    // Peek/arka slot: çıkış yolunu dış sargı taşır; iç offset boyayıp double-park yapmasın.
    translateY.value = 0;
  }, [hasExited, isExiting, isInteractive, translateY]);

  useEffect(() => {
    if (!isInteractive || !onImpression) {
      return;
    }

    const startedAt = Date.now();
    let fired = false;
    const fire = (): void => {
      if (fired) {
        return;
      }
      const dwellMs = Date.now() - startedAt;
      if (dwellMs < IMPRESSION_MIN_DWELL_MS) {
        return;
      }
      fired = true;
      onImpression(product, dwellMs);
    };

    const timeoutId = setTimeout(fire, IMPRESSION_MIN_DWELL_MS);
    return () => {
      clearTimeout(timeoutId);
      fire();
    };
  }, [isInteractive, onImpression, product]);

  const handleAddToCloset = useCallback((): void => {
    try {
      onAddToCloset(product);
    } catch (error) {
      logger.error('Beğeni işlenemedi', { error, productId: product.id });
    }
  }, [onAddToCloset, product]);

  const handlePass = useCallback((): void => {
    try {
      onPass(product);
    } catch (error) {
      logger.error('Geçme işlenemedi', { error, productId: product.id });
    }
  }, [onPass, product]);

  const handleVirtualTryOn = useCallback((): void => {
    try {
      onVirtualTryOn(product);
    } catch (error) {
      logger.error('Sanal deneme başlatılamadı', {
        error,
        productId: product.id,
      });
    }
  }, [onVirtualTryOn, product]);

  const handleRequireAuth = useCallback((): void => {
    try {
      onRequireAuth?.();
    } catch (error) {
      logger.error('Auth yönlendirmesi başarısız', { error });
    }
  }, [onRequireAuth]);

  const handleBuy = useCallback((): void => {
    try {
      onBuy(product);
    } catch (error) {
      logger.error('Pazaryeri sayfası açılamadı', {
        error,
        productId: product.id,
      });
    }
  }, [onBuy, product]);

  const handleUndoPass = useCallback((): void => {
    try {
      onUndoPass?.();
    } catch (error) {
      logger.error('Geçme geri alınamadı', { error });
    }
  }, [onUndoPass]);

  const handleStorePress = useCallback((): void => {
    hapticPurchaseIntent();
    handleBuy();
  }, [handleBuy]);

  const finishDoubleTapLike = useCallback((): void => {
    if (!canLike) {
      handleRequireAuth();
      return;
    }
    handleAddToCloset();
  }, [canLike, handleAddToCloset, handleRequireAuth]);

  const notifyEmptyUndo = useCallback((): void => {
    hapticSwipeDecision();
  }, []);

  const snapHome = (): void => {
    'worklet';
    translateY.value = withSpring(0, CARD_SPRING_BACK);
    if (deckPullY) {
      deckPullY.value = withSpring(0, CARD_SPRING_BACK);
    }
  };

  const commitPass = useCallback((): void => {
    handlePass();
  }, [handlePass]);

  const notifyPassExitSettled = useCallback((): void => {
    onPassExitSettled?.(product);
  }, [onPassExitSettled, product]);

  const commitUndo = useCallback((): void => {
    handleUndoPass();
    translateY.value = 0;
  }, [handleUndoPass, translateY]);

  /**
   * Y eksenine kilitli: yatay/çapraz sürüklemede pan hiç aktive olmaz, kart
   * kıpırdamaz. Aşağı çekişte ön kart yerinde durur; parmağı takip eden kart
   * clip üstünde park eden geçilmiş karttır (deckPullY üzerinden).
   */
  const panGesture = Gesture.Pan()
    .enabled(isInteractive)
    .activeOffsetY([-PAN_ACTIVE_OFFSET_Y_PX, PAN_ACTIVE_OFFSET_Y_PX])
    .failOffsetX([-PAN_FAIL_OFFSET_X_PX, PAN_FAIL_OFFSET_X_PX])
    .onUpdate((event) => {
      if (hasExited.value) {
        return;
      }
      const y = event.translationY;
      if (deckPullY) {
        deckPullY.value = y < 0 || canUndo ? y : 0;
      }
      translateY.value = Math.min(y, 0);
    })
    .onEnd((event) => {
      if (hasExited.value) {
        return;
      }

      const y = event.translationY;
      const vy = event.velocityY;

      if (shouldCommitPass(y, vy)) {
        hasExited.value = true;
        runOnJS(hapticSwipeDecision)();
        runOnJS(commitPass)();
        translateY.value = withSpring(
          -DECK_CLEAR_TRAVEL_PX,
          { ...CARD_THROW_SPRING, velocity: vy },
          () => {
            runOnJS(notifyPassExitSettled)();
          },
        );
        return;
      }

      if (shouldCommitUndo(y, vy)) {
        if (!canUndo) {
          snapHome();
          runOnJS(notifyEmptyUndo)();
          return;
        }
        runOnJS(hapticSwipeDecision)();
        translateY.value = withSpring(0, UNDO_SETTLE_SPRING);
        if (deckPullY) {
          // Park eden kart tam dinlenme pozisyonuna oturunca rol devri görünmez olur.
          deckPullY.value = withSpring(
            DECK_CLEAR_TRAVEL_PX,
            { ...UNDO_SETTLE_SPRING, velocity: vy },
            (finished) => {
              if (finished) {
                runOnJS(commitUndo)();
              }
            },
          );
        } else {
          runOnJS(commitUndo)();
        }
        return;
      }

      snapHome();
    });

  const playHeartThenLike = (): void => {
    'worklet';
    if (hasExited.value) {
      return;
    }
    hasExited.value = true;
    heartBurst.value = withSequence(
      withTiming(1, { duration: HEART_BURST_IN_MS }),
      withTiming(0, { duration: HEART_BURST_OUT_MS }, (finished) => {
        if (finished) {
          runOnJS(finishDoubleTapLike)();
        }
      }),
    );
  };

  const doubleTapGesture = Gesture.Tap()
    .enabled(isInteractive)
    .numberOfTaps(2)
    .maxDuration(DOUBLE_TAP_MAX_DURATION_MS)
    .maxDistance(DOUBLE_TAP_MAX_DISTANCE_PX)
    .onEnd(() => {
      if (hasExited.value) {
        return;
      }
      runOnJS(hapticSwipeDecision)();
      if (!canLike) {
        runOnJS(handleRequireAuth)();
        return;
      }
      playHeartThenLike();
    });

  const cardGesture = Gesture.Exclusive(doubleTapGesture, panGesture);
  const ctaNativeGesture = Gesture.Native().blocksExternalGesture(
    doubleTapGesture,
    panGesture,
  );

  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: 1,
    transform: [
      { translateY: translateY.value },
      { scale: cardScale.value },
    ],
  }));

  const passOverlayStyle = useAnimatedStyle(() => {
    const progress = passProgress(translateY.value);
    return {
      opacity: progress,
      transform: [{ scale: 0.86 + 0.14 * progress }],
    };
  });

  const passWashStyle = useAnimatedStyle(() => ({
    opacity: passProgress(translateY.value),
  }));

  const heartBurstStyle = useAnimatedStyle(() => ({
    opacity: heartBurst.value,
    transform: [
      {
        scale: interpolate(
          heartBurst.value,
          [0, 1],
          [0.72, HEART_BURST_PEAK_SCALE],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const reasonLabel = product.reason?.trim() ?? '';

  return (
    <GestureDetector gesture={cardGesture}>
      <Animated.View
        style={[
          styles.shadowWrap,
          castShadow ? styles.shadowWrapFront : styles.shadowWrapParked,
          animatedCardStyle,
        ]}
        accessibilityRole="image"
        accessibilityLabel={`${product.brand} ${product.title}, ${formatPrice(product)}`}
      >
        <View style={[styles.card, !isInteractive ? styles.cardBehind : null]}>
          <View style={styles.imageWrap}>
            {hasImageError ? (
              <View style={styles.imageFallback}>
                <Text style={styles.imageFallbackText}>Görsel yüklenemedi</Text>
              </View>
            ) : (
              <Image
                source={{ uri: product.imageUrl }}
                style={styles.image}
                contentFit="cover"
                contentPosition={IMAGE_CONTENT_POSITION}
                cachePolicy="memory-disk"
                recyclingKey={product.id}
                transition={IMAGE_CROSSFADE_MS}
                onError={() => setHasImageError(true)}
              />
            )}

            <Animated.View
              pointerEvents="none"
              style={[styles.wash, styles.passWash, passWashStyle]}
            />

            <Animated.View
              pointerEvents="none"
              style={[styles.stamp, styles.passStamp, passOverlayStyle]}
            >
              <X color={colors.stampPass} size={28} strokeWidth={3} />
              <Text style={styles.passStampText}>GEÇ</Text>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[styles.heartBurst, heartBurstStyle]}
            >
              <Heart color={colors.accent} fill={colors.accent} size={64} />
            </Animated.View>

            {reasonLabel.length > 0 ? (
              <View style={styles.reasonChip} pointerEvents="none">
                <Sparkles color={colors.accent} size={REASON_ICON_SIZE} />
                <Text style={styles.reasonChipText} numberOfLines={1}>
                  {reasonLabel}
                </Text>
              </View>
            ) : null}

            {isInteractive && !canLike ? (
              <PressableScale
                onPress={handleRequireAuth}
                style={styles.authButton}
                accessibilityRole="button"
                accessibilityLabel="Beğenmek için giriş yap"
              >
                <Heart color={colors.accent} size={ACTION_ICON_SIZE} />
                <Text style={styles.authButtonText}>
                  Beğenmek için giriş yap
                </Text>
              </PressableScale>
            ) : null}
          </View>

          <View style={styles.info}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {GARMENT_CATEGORY_LABEL[product.category]}
              </Text>
            </View>
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {product.title}
            </Text>
            {(product.colors && product.colors.length > 0) ||
            (product.sizes && product.sizes.length > 0) ? (
              <View style={styles.variationRow}>
                {product.colors && product.colors.length > 0
                  ? product.colors.slice(0, 4).map((swatch) => (
                      <View
                        key={`${swatch.name}-${swatch.hex}`}
                        style={[
                          styles.swatch,
                          { backgroundColor: swatch.hex },
                        ]}
                      />
                    ))
                  : null}
                {product.sizes && product.sizes.length > 0 ? (
                  <Text style={styles.sizeHint}>
                    {`· ${product.sizes.length} beden`}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.priceRow}>
              {hasCatalogPriceDrop(product) &&
              typeof product.previousPrice === 'number' ? (
                <Text style={styles.previousPrice}>
                  {formatTryPrice(product.previousPrice)}
                </Text>
              ) : null}
              <Text style={styles.price}>{formatPrice(product)}</Text>
              {hasCatalogPriceDrop(product) &&
              typeof product.previousPrice === 'number' ? (
                <View style={styles.dropBadge}>
                  <Text style={styles.dropBadgeText}>
                    {`↓ %${getDropPercent(product.previousPrice, getDisplayPrice(product))}`}
                  </Text>
                </View>
              ) : null}
            </View>

            {isInteractive ? (
              <GestureDetector gesture={ctaNativeGesture}>
                <View style={styles.actions} collapsable={false}>
                  <PressableScale
                    onPress={handleVirtualTryOn}
                    style={styles.primaryAction}
                    accessibilityRole="button"
                    accessibilityLabel="Dene"
                  >
                    <Sparkles color={colors.inverseText} size={ACTION_ICON_SIZE} />
                    <Text style={styles.primaryActionText}>Dene</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={handleStorePress}
                    style={styles.secondaryAction}
                    accessibilityRole="button"
                    accessibilityLabel="Mağazaya git"
                  >
                    <ShoppingBag color={colors.text} size={ACTION_ICON_SIZE} />
                    <Text style={styles.secondaryActionText}>Mağazaya Git</Text>
                  </PressableScale>
                </View>
              </GestureDetector>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Ekran kökünün 16px yatay padding’iyle aynı grid; ekstra inset yok. */
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const CARD_HEIGHT = estimateDiscoverCardHeight(SCREEN_HEIGHT);
/**
 * Çıkış hedefi = undo park Y. Clip dışında bitsin diye kart + 24px + gölge.
 * Aynı uzunluk hem yukarı çıkış hem park dönüşü için geçerlidir.
 */
const DECK_CLEAR_TRAVEL_PX = deckClearTravelPx(CARD_HEIGHT);

export const SWIPE_CARD_WIDTH = CARD_WIDTH;
export const SWIPE_CARD_HEIGHT = CARD_HEIGHT;

const styles = StyleSheet.create({
  shadowWrap: {
    width: '100%',
    height: '100%',
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  shadowWrapFront: {
    ...shadows.stackSoft,
  },
  shadowWrapParked: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  card: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  cardBehind: {
    borderWidth: 0,
  },
  imageWrap: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.bgSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSoft,
  },
  imageFallbackText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
  },
  passWash: {
    backgroundColor: colors.passWash,
  },
  stamp: {
    position: 'absolute',
    top: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 3,
    backgroundColor: colors.glass,
  },
  passStamp: {
    left: spacing.xl,
    right: spacing.xl,
    justifyContent: 'center',
    borderColor: colors.stampPass,
  },
  passStampText: {
    color: colors.stampPass,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heartBurst: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonChip: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    maxWidth: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  reasonChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  authButton: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.md,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
    ...shadows.chip,
  },
  authButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  info: {
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.chip,
    marginBottom: spacing.sm,
  },
  categoryBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  brand: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  variationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeHint: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  previousPrice: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  price: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  dropBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  dropBadgeText: {
    color: colors.accentDark,
    fontSize: 12,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: layout.ctaPaddingVertical,
  },
  primaryActionText: {
    color: colors.inverseText,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: layout.ctaPaddingVertical,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
