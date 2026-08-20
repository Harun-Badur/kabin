import { useCallback, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Heart, ShoppingBag, Sparkles, X } from 'lucide-react-native';
import { GARMENT_CATEGORY_LABEL, type Product } from '../types/product';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SWIPE_THRESHOLD_PX = 100;
const SWIPE_UP_THRESHOLD_PX = 100;
const EXIT_DISTANCE_PX = SCREEN_WIDTH * 1.35;
const EXIT_UP_DISTANCE_PX = SCREEN_HEIGHT * 1.15;
const EXIT_DURATION_MS = 280;
const CARD_MAX_ROTATION_DEG = 14;
const PAN_MIN_DISTANCE_PX = 18;

export type { Product };

export interface SwipeCardProps {
  product: Product;
  onSwipeRight: (product: Product) => void;
  onSwipeLeft: (product: Product) => void;
  onVirtualTryOn: (product: Product) => void;
  onBuy: (product: Product) => void;
  isInteractive?: boolean;
}

const formatPrice = (price: number): string => `₺${price.toFixed(2)}`;

export default function SwipeCard({
  product,
  onSwipeRight,
  onSwipeLeft,
  onVirtualTryOn,
  onBuy,
  isInteractive = true,
}: SwipeCardProps) {
  const [hasImageError, setHasImageError] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const hasExited = useSharedValue(false);

  const handleSwipeRight = useCallback((): void => {
    onSwipeRight(product);
  }, [onSwipeRight, product]);

  const handleSwipeLeft = useCallback((): void => {
    onSwipeLeft(product);
  }, [onSwipeLeft, product]);

  const handleVirtualTryOn = useCallback((): void => {
    try {
      onVirtualTryOn(product);
    } catch (error) {
      console.error('Failed to start virtual try-on', {
        error,
        productId: product.id,
      });
    }
  }, [onVirtualTryOn, product]);

  const handleBuy = useCallback((): void => {
    try {
      onBuy(product);
    } catch (error) {
      console.error('Failed to open marketplace page', {
        error,
        productId: product.id,
      });
    }
  }, [onBuy, product]);

  const buyTapGesture = Gesture.Tap()
    .enabled(isInteractive)
    .maxDistance(12)
    .onEnd(() => {
      runOnJS(handleBuy)();
    });

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
        hasExited.value = true;
        translateY.value = withTiming(
          -EXIT_UP_DISTANCE_PX,
          { duration: EXIT_DURATION_MS },
          (finished) => {
            if (finished) {
              runOnJS(handleBuy)();
              runOnJS(handleSwipeRight)();
            }
          },
        );
        return;
      }

      if (event.translationX > SWIPE_THRESHOLD_PX) {
        hasExited.value = true;
        translateX.value = withTiming(
          EXIT_DISTANCE_PX,
          { duration: EXIT_DURATION_MS },
          (finished) => {
            if (finished) {
              runOnJS(handleSwipeRight)();
            }
          },
        );
        return;
      }

      if (event.translationX < -SWIPE_THRESHOLD_PX) {
        hasExited.value = true;
        translateX.value = withTiming(
          -EXIT_DISTANCE_PX,
          { duration: EXIT_DURATION_MS },
          (finished) => {
            if (finished) {
              runOnJS(handleSwipeLeft)();
            }
          },
        );
        return;
      }

      translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-CARD_MAX_ROTATION_DEG, 0, CARD_MAX_ROTATION_DEG],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
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
  }));

  const nopeOverlayStyle = useAnimatedStyle(() => ({
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

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[styles.shadowWrap, animatedCardStyle]}
        accessibilityRole="image"
        accessibilityLabel={`${product.brand} ${product.title}, ${formatPrice(product.price)}`}
      >
        <View style={styles.card}>
          {hasImageError ? (
            <View style={styles.imageFallback}>
              <Text style={styles.imageFallbackText}>Görsel yüklenemedi</Text>
            </View>
          ) : (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setHasImageError(true)}
            />
          )}

          <View style={styles.gradientScrim} />

          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.likeStamp, likeOverlayStyle]}
          >
            <Heart color="#16A34A" fill="#16A34A" size={28} />
            <Text style={styles.likeStampText}>BEĞEN</Text>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.nopeStamp, nopeOverlayStyle]}
          >
            <X color="#DC2626" size={28} strokeWidth={3} />
            <Text style={styles.nopeStampText}>GEÇ</Text>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[styles.stamp, styles.buyStamp, buyOverlayStyle]}
          >
            <ShoppingBag color="#0F172A" size={26} />
            <Text style={styles.buyStampText}>SATIN AL</Text>
          </Animated.View>

          {isInteractive ? (
            <GestureDetector gesture={buyTapGesture}>
              <Pressable
                style={({ pressed }) => [
                  styles.buyButton,
                  pressed ? styles.buyButtonPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Satın al"
              >
                <ShoppingBag color="#0F172A" size={18} />
                <Text style={styles.buyButtonText}>Satın Al</Text>
              </Pressable>
            </GestureDetector>
          ) : null}

          <View style={styles.info}>
            {isInteractive ? (
              <Pressable
                onPress={handleVirtualTryOn}
                style={({ pressed }) => [
                  styles.tryOnButton,
                  pressed ? styles.tryOnButtonPressed : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sanal dene"
              >
                <Sparkles color="#0F172A" size={16} />
                <Text style={styles.tryOnButtonText}>✨ Sanal Dene</Text>
              </Pressable>
            ) : null}
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
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const CARD_WIDTH = SCREEN_WIDTH * 0.88;
const CARD_HEIGHT = Math.min(SCREEN_HEIGHT * 0.68, CARD_WIDTH * 1.42);

export const SWIPE_CARD_WIDTH = CARD_WIDTH;
export const SWIPE_CARD_HEIGHT = CARD_HEIGHT;

const styles = StyleSheet.create({
  shadowWrap: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  imageFallbackText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  gradientScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38%',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  stamp: {
    position: 'absolute',
    top: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  likeStamp: {
    left: 20,
    borderColor: '#16A34A',
    transform: [{ rotate: '-12deg' }],
  },
  nopeStamp: {
    right: 20,
    borderColor: '#DC2626',
    transform: [{ rotate: '12deg' }],
  },
  buyStamp: {
    top: 88,
    left: 72,
    right: 72,
    justifyContent: 'center',
    borderColor: '#0F172A',
  },
  likeStampText: {
    color: '#16A34A',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  nopeStampText: {
    color: '#DC2626',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  buyStampText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  buyButton: {
    position: 'absolute',
    right: 16,
    bottom: 22,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 6,
  },
  buyButtonPressed: {
    opacity: 0.82,
  },
  buyButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  info: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 12,
  },
  tryOnButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 14,
  },
  tryOnButtonPressed: {
    opacity: 0.82,
  },
  tryOnButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(248, 250, 252, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248, 250, 252, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  categoryBadgeText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  brand: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 8,
  },
  price: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
});
