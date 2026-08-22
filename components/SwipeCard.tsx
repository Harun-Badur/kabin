import { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Heart, ShoppingBag, Sparkles, X } from 'lucide-react-native';
import PressableScale from './PressableScale';
import { hapticPurchaseIntent, hapticSwipeDecision } from '../lib/haptics';
import { logger } from '../lib/logger';
import {
  CARD_EXIT_DURATION_MS,
  CARD_EXIT_LIFT_PX,
  CARD_MAX_ROTATION_DEG,
  CARD_SNAP_DURATION_MS,
  CARD_SNAP_SCALE,
  PRESS_DURATION_MS,
  PRESS_SCALE,
} from '../lib/motion';
import { colors, radius, shadows, spacing } from '../lib/theme';
import {
  formatTryPrice,
  GARMENT_CATEGORY_LABEL,
  getDisplayPrice,
  getDropPercent,
  hasCatalogPriceDrop,
  type Product,
} from '../types/product';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SWIPE_THRESHOLD_PX = 100;
const SWIPE_UP_THRESHOLD_PX = 100;
const EXIT_DISTANCE_PX = SCREEN_WIDTH * 1.35;
const EXIT_UP_DISTANCE_PX = SCREEN_HEIGHT * 1.15;
const PAN_MIN_DISTANCE_PX = 18;
const EXIT_TIMING = { duration: CARD_EXIT_DURATION_MS } as const;
const ACTION_ICON_SIZE = 16;
/** object-position: top-center — tam boy kadraj (hedef oran ~0.68). */
const IMAGE_CONTENT_POSITION = { top: 0, left: '50%' } as const;
const CARD_HEIGHT_RATIO = 0.83;

export type { Product };

export interface SwipeCardProps {
  product: Product;
  onSwipeRight: (product: Product) => void;
  onSwipeLeft: (product: Product) => void;
  onVirtualTryOn: (product: Product) => void;
  onBuy: (product: Product) => void;
  onRequireAuth?: () => void;
  isInteractive?: boolean;
  canLike?: boolean;
}

const formatPrice = (product: Product): string =>
  formatTryPrice(getDisplayPrice(product));

export default function SwipeCard({
  product,
  onSwipeRight,
  onSwipeLeft,
  onVirtualTryOn,
  onBuy,
  onRequireAuth,
  isInteractive = true,
  canLike = true,
}: SwipeCardProps) {
  const [hasImageError, setHasImageError] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const buyScale = useSharedValue(1);
  const hasExited = useSharedValue(false);

  useEffect(
    () => () => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(cardScale);
      cancelAnimation(cardOpacity);
      cancelAnimation(buyScale);
    },
    [buyScale, cardOpacity, cardScale, translateX, translateY],
  );

  const handleSwipeRight = useCallback((): void => {
    try {
      onSwipeRight(product);
    } catch (error) {
      logger.error('Beğeni işlenemedi', { error, productId: product.id });
    }
  }, [onSwipeRight, product]);

  const handleSwipeLeft = useCallback((): void => {
    try {
      onSwipeLeft(product);
    } catch (error) {
      logger.error('Geçme işlenemedi', { error, productId: product.id });
    }
  }, [onSwipeLeft, product]);

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

  const finishBuyExit = useCallback((): void => {
    handleBuy();
    if (canLike) {
      handleSwipeRight();
    } else {
      handleSwipeLeft();
    }
  }, [canLike, handleBuy, handleSwipeLeft, handleSwipeRight]);

  const buyTapGesture = Gesture.Tap()
    .enabled(isInteractive)
    .maxDistance(12)
    .onBegin(() => {
      buyScale.value = withTiming(PRESS_SCALE, { duration: PRESS_DURATION_MS });
    })
    .onFinalize(() => {
      buyScale.value = withTiming(1, { duration: PRESS_DURATION_MS });
    })
    .onEnd(() => {
      runOnJS(hapticPurchaseIntent)();
      runOnJS(handleBuy)();
    });

  const snapHome = (): void => {
    'worklet';
    translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    cardScale.value = withSequence(
      withTiming(CARD_SNAP_SCALE, { duration: 0 }),
      withTiming(1, {
        duration: CARD_SNAP_DURATION_MS,
        easing: Easing.out(Easing.back(1.8)),
      }),
    );
  };

  const flyOut = (toX: number, toY: number, onDone: () => void): void => {
    'worklet';
    hasExited.value = true;
    cardOpacity.value = withTiming(0, EXIT_TIMING);
    cardScale.value = withTiming(0.92, EXIT_TIMING);
    translateY.value = withTiming(toY, EXIT_TIMING);
    translateX.value = withTiming(toX, EXIT_TIMING, (finished) => {
      if (finished) {
        runOnJS(onDone)();
      }
    });
  };

  const panGesture = Gesture.Pan()
    .enabled(isInteractive)
    .minDistance(PAN_MIN_DISTANCE_PX)
    .onUpdate((event) => {
      if (hasExited.value) {
        return;
      }

      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (hasExited.value) {
        return;
      }

      if (event.translationY < -SWIPE_UP_THRESHOLD_PX) {
        runOnJS(hapticPurchaseIntent)();
        flyOut(event.translationX, -EXIT_UP_DISTANCE_PX, finishBuyExit);
        return;
      }

      if (event.translationX > SWIPE_THRESHOLD_PX) {
        if (!canLike) {
          snapHome();
          runOnJS(handleRequireAuth)();
          return;
        }
        runOnJS(hapticSwipeDecision)();
        flyOut(
          EXIT_DISTANCE_PX,
          event.translationY - CARD_EXIT_LIFT_PX,
          handleSwipeRight,
        );
        return;
      }

      if (event.translationX < -SWIPE_THRESHOLD_PX) {
        runOnJS(hapticSwipeDecision)();
        flyOut(
          -EXIT_DISTANCE_PX,
          event.translationY - CARD_EXIT_LIFT_PX,
          handleSwipeLeft,
        );
        return;
      }

      snapHome();
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-CARD_MAX_ROTATION_DEG, 0, CARD_MAX_ROTATION_DEG],
      Extrapolation.CLAMP,
    );

    return {
      opacity: cardOpacity.value,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ: `${rotate}deg` },
        { scale: cardScale.value },
      ],
    };
  });

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD_PX],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, SWIPE_THRESHOLD_PX],
          [0.86, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, -SWIPE_THRESHOLD_PX],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, -SWIPE_THRESHOLD_PX],
          [0.86, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const likeWashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD_PX],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const passWashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, -SWIPE_THRESHOLD_PX],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const buyOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, -SWIPE_UP_THRESHOLD_PX],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const buyButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buyScale.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.shadowWrap, animatedCardStyle]}
        accessibilityRole="image"
        accessibilityLabel={`${product.brand} ${product.title}, ${formatPrice(product)}`}
      >
        <View style={styles.card}>
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
                transition={160}
                onError={() => setHasImageError(true)}
              />
            )}

            <Animated.View
              pointerEvents="none"
              style={[styles.wash, styles.likeWash, likeWashStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.wash, styles.passWash, passWashStyle]}
            />

            <Animated.View
              pointerEvents="none"
              style={[styles.stamp, styles.likeStamp, likeOverlayStyle]}
            >
              <Heart color={colors.stampAdd} fill={colors.stampAdd} size={28} />
              <Text style={styles.likeStampText}>EKLE</Text>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[styles.stamp, styles.passStamp, passOverlayStyle]}
            >
              <X color={colors.stampPass} size={28} strokeWidth={3} />
              <Text style={styles.passStampText}>GEÇ</Text>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[styles.stamp, styles.buyStamp, buyOverlayStyle]}
            >
              <ShoppingBag color={colors.accent} size={26} />
              <Text style={styles.buyStampText}>MAĞAZAYA</Text>
            </Animated.View>

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
              <View style={styles.actions}>
                <PressableScale
                  onPress={handleVirtualTryOn}
                  style={styles.primaryAction}
                  accessibilityRole="button"
                  accessibilityLabel="Dene"
                >
                  <Sparkles color={colors.inverseText} size={ACTION_ICON_SIZE} />
                  <Text style={styles.primaryActionText}>Dene</Text>
                </PressableScale>
                <GestureDetector gesture={buyTapGesture}>
                  <Animated.View
                    style={[styles.secondaryAction, buyButtonStyle]}
                    accessibilityRole="button"
                    accessibilityLabel="Mağazaya git"
                  >
                    <ShoppingBag color={colors.text} size={ACTION_ICON_SIZE} />
                    <Text style={styles.secondaryActionText}>Mağazaya Git</Text>
                  </Animated.View>
                </GestureDetector>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Ekran kökünün 16px yatay padding’iyle aynı grid; ekstra inset yok. */
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg * 2;
const CARD_HEIGHT = SCREEN_HEIGHT * CARD_HEIGHT_RATIO;

export const SWIPE_CARD_WIDTH = CARD_WIDTH;
export const SWIPE_CARD_HEIGHT = CARD_HEIGHT;

const styles = StyleSheet.create({
  shadowWrap: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  card: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
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
  likeWash: {
    backgroundColor: colors.likeWash,
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
  likeStamp: {
    left: spacing.xl,
    borderColor: colors.stampAdd,
    transform: [{ rotate: '-12deg' }],
  },
  passStamp: {
    right: spacing.xl,
    borderColor: colors.stampPass,
    transform: [{ rotate: '12deg' }],
  },
  buyStamp: {
    top: 88,
    left: 72,
    right: 72,
    justifyContent: 'center',
    borderColor: colors.accent,
  },
  likeStampText: {
    color: colors.stampAdd,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  passStampText: {
    color: colors.stampPass,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  buyStampText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
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
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
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
    marginTop: spacing.md,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
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
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
