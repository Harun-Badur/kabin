import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';
import PressableScale from '../../components/PressableScale';
import RefreshSpinner from '../../components/RefreshSpinner';
import SkeletonShimmer from '../../components/SkeletonShimmer';
import VirtualTryOnModal from '../../components/VirtualTryOnModal';
import { logger } from '../../lib/logger';
import { colors, radius, shadows, spacing } from '../../lib/theme';
import { openProductPage } from '../../services/deeplinkService';
import { useAppStore } from '../../store/useAppStore';
import {
  formatTryPrice,
  getDisplayPrice,
  getDropPercent,
  hasCatalogPriceDrop,
  type LikedProduct,
  type Product,
} from '../../types/product';

/** Sekmeye her dönüşte sorgu atmamak için taze sayılan süre. */
const REFRESH_TTL_MS = 30_000;
const LIKED_SKELETON_KEYS = ['s1', 's2', 's3'] as const;
const THUMBNAIL_WIDTH = 112;
const THUMBNAIL_MIN_HEIGHT = 148;
const SWIPE_DELETE_THRESHOLD_PX = 72;
const UNDO_TOAST_MS = 5000;

interface LikedItemProps {
  item: LikedProduct;
  onTryOn: (product: Product) => void;
  onOpenStore: (product: Product) => void;
  onSwipeDelete: (product: Product) => void;
}

function LikedItem({
  item,
  onTryOn,
  onOpenStore,
  onSwipeDelete,
}: LikedItemProps) {
  const { product } = item;
  const [hasImageError, setHasImageError] = useState(false);
  const translateX = useSharedValue(0);

  const livePrice = getDisplayPrice(product);
  const previousPrice = product.previousPrice;
  const hasDrop = hasCatalogPriceDrop(product);
  const dropPercent =
    hasDrop && typeof previousPrice === 'number'
      ? getDropPercent(previousPrice, livePrice)
      : 0;

  useEffect(
    () => () => {
      cancelAnimation(translateX);
    },
    [translateX],
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      translateX.value = Math.min(0, event.translationX);
    })
    .onEnd(() => {
      if (translateX.value <= -SWIPE_DELETE_THRESHOLD_PX) {
        translateX.value = withTiming(-280, { duration: 160 }, (finished) => {
          if (finished) {
            runOnJS(onSwipeDelete)(product);
          }
        });
        return;
      }
      translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_DELETE_THRESHOLD_PX, -12],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.swipeWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.deleteReveal, revealStyle]}
      >
        <Trash2 color={colors.inverseText} size={22} />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, cardStyle]}>
          {hasImageError ? (
            <View style={styles.imageFallback}>
              <Text style={styles.imageFallbackText}>Görsel yok</Text>
            </View>
          ) : (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={product.id}
              onError={() => setHasImageError(true)}
            />
          )}
          <View style={styles.meta}>
            <View style={styles.metaCopy}>
              <Text style={styles.brand} numberOfLines={1}>
                {product.brand}
              </Text>
              <Text style={styles.title} numberOfLines={2}>
                {product.title}
              </Text>
            </View>
            <View style={styles.priceRow}>
              {hasDrop && typeof previousPrice === 'number' ? (
                <Text style={styles.previousPrice}>
                  {formatTryPrice(previousPrice)}
                </Text>
              ) : null}
              <Text
                style={[styles.price, hasDrop ? styles.livePriceDrop : null]}
              >
                {formatTryPrice(livePrice)}
              </Text>
              {hasDrop ? (
                <View style={styles.dropBadge}>
                  <Text style={styles.dropBadgeText}>{`↓ %${dropPercent}`}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actions}>
              <PressableScale
                onPress={() => onTryOn(product)}
                style={styles.tryButton}
                accessibilityRole="button"
                accessibilityLabel="Tekrar dene"
              >
                <Text style={styles.tryButtonText}>Tekrar Dene</Text>
              </PressableScale>
              <PressableScale
                onPress={() => onOpenStore(product)}
                style={styles.shopButton}
                accessibilityRole="button"
                accessibilityLabel="Mağazaya git"
              >
                <Text style={styles.shopButtonText}>Mağazaya Git</Text>
              </PressableScale>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function LikedScreen() {
  const likedProducts = useAppStore((state) => state.likedProducts);
  const sessionSyncStatus = useAppStore((state) => state.sessionSyncStatus);
  const unlikeProduct = useAppStore((state) => state.unlikeProduct);
  const swipeRight = useAppStore((state) => state.swipeRight);
  const refreshLikedProducts = useAppStore(
    (state) => state.refreshLikedProducts,
  );
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [undoProduct, setUndoProduct] = useState<Product | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasFreshLoad, setHasFreshLoad] = useState(false);
  const lastLoadedAtRef = useRef(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimer = useCallback((): void => {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearUndoTimer();
    },
    [clearUndoTimer],
  );

  const reloadLikes = useCallback(
    async (force: boolean): Promise<void> => {
      if (!force && Date.now() - lastLoadedAtRef.current < REFRESH_TTL_MS) {
        return;
      }

      setIsRefreshing(true);
      try {
        await refreshLikedProducts();
        lastLoadedAtRef.current = Date.now();
      } catch {
        // Zaman damgası güncellenmedi; sonraki odakta tekrar denenir.
        Alert.alert(
          'Yenilenemedi',
          'Güncel fiyatlar alınamadı. Aşağı çekip tekrar dene.',
        );
      } finally {
        setIsRefreshing(false);
        setHasFreshLoad(true);
      }
    },
    [refreshLikedProducts],
  );

  useFocusEffect(
    useCallback(() => {
      void reloadLikes(false);
    }, [reloadLikes]),
  );

  const handleSwipeDelete = useCallback(
    (product: Product): void => {
      clearUndoTimer();
      void unlikeProduct(product.id)
        .then(() => {
          setUndoProduct(product);
          undoTimerRef.current = setTimeout(() => {
            setUndoProduct(null);
            undoTimerRef.current = null;
          }, UNDO_TOAST_MS);
        })
        .catch((error: unknown) => {
          logger.error('Beğeni silinemedi', { error });
          setUndoProduct(null);
          Alert.alert(
            'Silinemedi',
            'Beğeni kaldırılırken bir sorun oluştu. Tekrar dene.',
          );
        });
    },
    [clearUndoTimer, unlikeProduct],
  );

  const handleUndoDelete = useCallback((): void => {
    if (undoProduct === null) {
      return;
    }
    clearUndoTimer();
    swipeRight(undoProduct);
    setUndoProduct(null);
  }, [clearUndoTimer, swipeRight, undoProduct]);

  const handleOpenStore = useCallback((product: Product): void => {
    void openProductPage(product);
  }, []);

  if (sessionSyncStatus === 'loading' || !hasFreshLoad) {
    return (
      <View style={styles.root}>
        <Text style={styles.header}>Dolabım</Text>
        <View style={styles.list}>
          {LIKED_SKELETON_KEYS.map((key) => (
            <View key={key} style={styles.card}>
              <SkeletonShimmer
                width={THUMBNAIL_WIDTH}
                height={THUMBNAIL_MIN_HEIGHT}
                borderRadius={0}
              />
              <View style={styles.skeletonMeta}>
                <SkeletonShimmer width={88} height={10} borderRadius={6} />
                <SkeletonShimmer width={160} height={14} borderRadius={6} />
                <SkeletonShimmer width={72} height={16} borderRadius={6} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.header}>Dolabım</Text>
      {likedProducts.length === 0 ? (
        <View style={styles.flex}>
          <RefreshSpinner visible={isRefreshing} />
          <ScrollView
            contentContainerStyle={styles.centered}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => {
                  void reloadLikes(true);
                }}
                tintColor="transparent"
                colors={['transparent']}
              />
            }
          >
            <Text style={styles.emptyEmoji}>♡</Text>
            <Text style={styles.emptyTitle}>
              Dolabın henüz boş. Keşfetmeye başla!
            </Text>
          </ScrollView>
        </View>
      ) : (
        <View style={styles.flex}>
          <RefreshSpinner visible={isRefreshing} />
          <FlatList
            data={likedProducts}
            keyExtractor={(item) => item.product.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => {
                  void reloadLikes(true);
                }}
                tintColor="transparent"
                colors={['transparent']}
              />
            }
            renderItem={({ item }) => (
              <LikedItem
                item={item}
                onTryOn={setTryOnProduct}
                onOpenStore={handleOpenStore}
                onSwipeDelete={handleSwipeDelete}
              />
            )}
          />
        </View>
      )}
      <VirtualTryOnModal
        visible={tryOnProduct !== null}
        product={tryOnProduct}
        onClose={() => setTryOnProduct(null)}
      />
      {undoProduct !== null ? (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>Silindi</Text>
          <PressableScale
            onPress={handleUndoDelete}
            accessibilityRole="button"
            accessibilityLabel="Geri al"
          >
            <Text style={styles.toastAction}>Geri Al</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    paddingTop: 56,
  },
  flex: {
    flex: 1,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  swipeWrap: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.destructive,
  },
  deleteReveal: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: spacing.xl,
    backgroundColor: colors.destructive,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    ...shadows.card,
  },
  image: {
    width: THUMBNAIL_WIDTH,
    minHeight: THUMBNAIL_MIN_HEIGHT,
    backgroundColor: colors.bgSoft,
  },
  imageFallback: {
    width: THUMBNAIL_WIDTH,
    minHeight: THUMBNAIL_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSoft,
  },
  imageFallbackText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  meta: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
  },
  metaCopy: {
    marginBottom: spacing.sm,
  },
  skeletonMeta: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  previousPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  livePriceDrop: {
    color: colors.accentDark,
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
  },
  tryButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tryButtonText: {
    color: colors.inverseText,
    fontSize: 13,
    fontWeight: '800',
  },
  shopButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  shopButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inverseSurface,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toastText: {
    color: colors.inverseText,
    fontSize: 15,
    fontWeight: '700',
  },
  toastAction: {
    color: colors.inverseText,
    fontSize: 15,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: spacing.md,
    color: colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
});
