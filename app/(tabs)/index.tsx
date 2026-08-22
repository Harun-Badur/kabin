import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import SwipeCard, {
  SWIPE_CARD_HEIGHT,
  SWIPE_CARD_WIDTH,
} from '../../components/SwipeCard';
import PressableScale from '../../components/PressableScale';
import FilterSheet from '../../components/FilterSheet';
import SearchResults from '../../components/SearchResults';
import SkeletonShimmer from '../../components/SkeletonShimmer';
import SwipeHintOverlay from '../../components/SwipeHintOverlay';
import VirtualTryOnModal from '../../components/VirtualTryOnModal';
import { useAuthContext } from '../../hooks/useAuthContext';
import { logger } from '../../lib/logger';
import {
  DECK_OPACITY_BY_DEPTH,
  DECK_SCALE_BY_DEPTH,
  DECK_SPRING,
  DECK_TRANSLATE_Y_BY_DEPTH,
  DECK_VISIBLE_COUNT,
} from '../../lib/motion';
import { hasSeenSwipeHint, markSwipeHintSeen } from '../../lib/onboarding';
import { colors, layout, radius, shadows, spacing } from '../../lib/theme';
import {
  getRedirectLabel,
  openProductPage,
} from '../../services/deeplinkService';
import {
  filterProducts,
  type ProductFilters,
} from '../../services/productService';
import { useAppStore } from '../../store/useAppStore';
import type { Product } from '../../types/product';

const TOAST_DURATION_MS = 1600;
const FILTER_HIT_SIZE = 40;
const SEARCH_DIVIDER_HEIGHT = 24;
/** Arama→kart ve kart→alt bar boşluğu; aktif kartın üst/alt kenarı referans. */
const DECK_VERTICAL_PADDING = 12;

type HintStatus = 'checking' | 'visible' | 'hidden';

/** Derinlik dizilerinin son basamağı, taşan kartlar için tavan değeri verir. */
const atDepth = (steps: readonly number[], depth: number): number =>
  steps[Math.min(depth, steps.length - 1)] ?? steps[steps.length - 1] ?? 1;

interface StackSlotProps {
  product: Product;
  depth: number;
  isTop: boolean;
  canLike: boolean;
  onSwipeRight: (product: Product) => void;
  onSwipeLeft: (product: Product) => void;
  onVirtualTryOn: (product: Product) => void;
  onBuy: (product: Product) => void;
  onRequireAuth: () => void;
}

function LoadingFeed() {
  return (
    <View style={styles.emptyState}>
      <SkeletonShimmer
        width={SWIPE_CARD_WIDTH}
        height={SWIPE_CARD_HEIGHT}
        borderRadius={radius.card}
      />
      <Text style={styles.loadingTitle}>Ürünler yükleniyor...</Text>
      <Text style={styles.emptySubtitle}>
        Kabin feedi hazırlanıyor. Birazdan kaydırmaya başlayabilirsin.
      </Text>
    </View>
  );
}

interface DeckFinishedCardProps {
  subtitle: string;
  onRefresh: () => void;
  onOpenLiked: () => void;
}

function DeckFinishedCard({
  subtitle,
  onRefresh,
  onOpenLiked,
}: DeckFinishedCardProps) {
  return (
    <View style={styles.finishedCard}>
      <Text style={styles.finishedTitle}>Deste bitti! 🎉</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      <PressableScale
        onPress={onOpenLiked}
        style={styles.primaryCta}
        accessibilityRole="button"
        accessibilityLabel="Dolabı gör"
      >
        <Text style={styles.primaryCtaText}>Dolabı Gör</Text>
      </PressableScale>
      <PressableScale
        onPress={onRefresh}
        style={styles.secondaryCta}
        accessibilityRole="button"
        accessibilityLabel="Yenile"
      >
        <Text style={styles.secondaryCtaText}>Yenile</Text>
      </PressableScale>
    </View>
  );
}

function StackSlot({
  product,
  depth,
  isTop,
  canLike,
  onSwipeRight,
  onSwipeLeft,
  onVirtualTryOn,
  onBuy,
  onRequireAuth,
}: StackSlotProps) {
  const scale = useSharedValue(atDepth(DECK_SCALE_BY_DEPTH, depth));
  const translateY = useSharedValue(atDepth(DECK_TRANSLATE_Y_BY_DEPTH, depth));
  const opacity = useSharedValue(atDepth(DECK_OPACITY_BY_DEPTH, depth));

  useEffect(() => {
    scale.value = withSpring(atDepth(DECK_SCALE_BY_DEPTH, depth), DECK_SPRING);
    translateY.value = withSpring(
      atDepth(DECK_TRANSLATE_Y_BY_DEPTH, depth),
      DECK_SPRING,
    );
    opacity.value = withSpring(
      atDepth(DECK_OPACITY_BY_DEPTH, depth),
      DECK_SPRING,
    );
  }, [depth, opacity, scale, translateY]);

  const animatedSlotStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents={isTop ? 'auto' : 'none'}
      style={[
        styles.stackSlot,
        { zIndex: DECK_VISIBLE_COUNT - depth, width: '100%' },
        animatedSlotStyle,
      ]}
    >
      <SwipeCard
        product={product}
        isInteractive={isTop}
        canLike={canLike}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
        onVirtualTryOn={onVirtualTryOn}
        onBuy={onBuy}
        onRequireAuth={onRequireAuth}
      />
    </Animated.View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const currentProducts = useAppStore((state) => state.currentProducts);
  const feedStatus = useAppStore((state) => state.feedStatus);
  const seenCount = useAppStore(
    (state) => state.likedProducts.length + state.passedProductIds.length,
  );
  const loadFeed = useAppStore((state) => state.loadFeed);
  const swipeRight = useAppStore((state) => state.swipeRight);
  const swipeLeft = useAppStore((state) => state.swipeLeft);

  const userId = user?.id ?? null;
  const canLike = user !== null;

  const reloadFeed = useCallback((): void => {
    void loadFeed(userId);
  }, [loadFeed, userId]);

  useEffect(() => {
    reloadFeed();
  }, [reloadFeed]);

  const handleRequireAuth = useCallback((): void => {
    router.push('/profile');
  }, [router]);

  const handleOpenLiked = useCallback((): void => {
    router.push('/liked');
  }, [router]);

  const handleSwipeRight = useCallback(
    (product: Product): void => {
      if (!canLike) {
        handleRequireAuth();
        return;
      }
      try {
        swipeRight(product);
      } catch (error) {
        logger.error('Beğeni işlenemedi', { error, productId: product.id });
      }
    },
    [canLike, handleRequireAuth, swipeRight],
  );

  const handleSwipeLeft = useCallback(
    (product: Product): void => {
      try {
        swipeLeft(product);
      } catch (error) {
        logger.error('Geçme işlenemedi', { error, productId: product.id });
      }
    },
    [swipeLeft],
  );

  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hintStatus, setHintStatus] = useState<HintStatus>('checking');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({});
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    void hasSeenSwipeHint().then((seen) => {
      if (isMounted) {
        setHintStatus(seen ? 'hidden' : 'visible');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismissHint = useCallback((): void => {
    setHintStatus('hidden');
    void markSwipeHintSeen();
  }, []);

  const showToast = useCallback((message: string): void => {
    if (toastTimeoutRef.current !== null) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleVirtualTryOn = useCallback((product: Product): void => {
    setTryOnProduct(product);
  }, []);

  const handleCloseTryOn = useCallback((): void => {
    setTryOnProduct(null);
  }, []);

  const handleBuy = useCallback(
    (product: Product): void => {
      showToast(`${getRedirectLabel(product)} yönlendiriliyorsun...`);
      void openProductPage(product);
    },
    [showToast],
  );

  // En arkadaki kart ilk render edilir; zIndex sıralaması bu ters diziye dayanır.
  const visibleSlots = useMemo(
    () =>
      currentProducts
        .slice(0, DECK_VISIBLE_COUNT)
        .map((product, depth) => ({ product, depth }))
        .reverse(),
    [currentProducts],
  );

  // Katalogda ürün var ama hepsi beğenildi/geçildi: tekrar yüklemek işe yaramaz,
  // kullanıcıya yeni ürünlerden haberdar olma yolunu göster.
  const isCatalogExhausted = visibleSlots.length === 0 && seenCount > 0;
  const isLoading = feedStatus === 'loading' || feedStatus === 'idle';
  const isSearching = searchQuery.trim().length > 0;
  const activeFilterCount = [filters.category, filters.gender, filters.size]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .length;
  const searchResults = useMemo(
    () =>
      filterProducts(currentProducts, {
        ...filters,
        query: searchQuery,
      }),
    [currentProducts, filters, searchQuery],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Search color={colors.icon} size={18} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Marka, ürün veya stil ara..."
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Ürün ara"
          />
          <View style={styles.searchDivider} />
          <PressableScale
            onPress={() => setIsFilterOpen(true)}
            style={styles.filterHit}
            accessibilityRole="button"
            accessibilityLabel="Filtreler"
          >
            <SlidersHorizontal color={colors.icon} size={18} />
            {activeFilterCount > 0 ? <View style={styles.filterDot} /> : null}
          </PressableScale>
        </View>
      </View>
      <View style={styles.body}>
        {isSearching ? (
          <View style={styles.searchResults}>
            <SearchResults
              products={searchResults}
              onAdd={handleSwipeRight}
              onOpenStore={handleBuy}
            />
          </View>
        ) : isLoading ? (
          <LoadingFeed />
        ) : isCatalogExhausted ? (
          <DeckFinishedCard
            subtitle="Katalogdaki her şeyi gördün. Yeni ürünler eklendikçe burada belirir."
            onRefresh={reloadFeed}
            onOpenLiked={handleOpenLiked}
          />
        ) : visibleSlots.length === 0 ? (
          <DeckFinishedCard
            subtitle="Beğendiğin parçalar dolabına eklendi. Yeni öneriler yakında."
            onRefresh={reloadFeed}
            onOpenLiked={handleOpenLiked}
          />
        ) : (
          <View style={styles.deck}>
            {visibleSlots.map(({ product, depth }) => (
              <StackSlot
                key={product.id}
                product={product}
                depth={depth}
                isTop={depth === 0}
                canLike={canLike}
                onSwipeRight={handleSwipeRight}
                onSwipeLeft={handleSwipeLeft}
                onVirtualTryOn={handleVirtualTryOn}
                onBuy={handleBuy}
                onRequireAuth={handleRequireAuth}
              />
            ))}
          </View>
        )}
      </View>
      {hintStatus === 'visible' &&
      !isLoading &&
      !isSearching &&
      visibleSlots.length > 0 ? (
        <SwipeHintOverlay onDismiss={handleDismissHint} />
      ) : null}
      <FilterSheet
        visible={isFilterOpen}
        filters={filters}
        onClose={() => setIsFilterOpen(false)}
        onApply={setFilters}
      />
      <VirtualTryOnModal
        visible={tryOnProduct !== null}
        product={tryOnProduct}
        onClose={handleCloseTryOn}
      />
      {toastMessage ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    paddingTop: 52,
  },
  header: {
    paddingHorizontal: spacing.lg,
  },
  searchBar: {
    width: '100%',
    height: layout.headerControl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.input,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    marginBottom: 0,
    zIndex: 6,
    ...shadows.input,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchDivider: {
    width: 1,
    height: SEARCH_DIVIDER_HEIGHT,
    backgroundColor: colors.border,
  },
  filterHit: {
    width: FILTER_HIT_SIZE,
    height: FILTER_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: layout.filterDot,
    height: layout.filterDot,
    borderRadius: layout.filterDot / 2,
    backgroundColor: colors.accent,
  },
  body: {
    flex: 1,
    width: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: DECK_VERTICAL_PADDING,
    justifyContent: 'center',
  },
  searchResults: {
    flex: 1,
    alignSelf: 'stretch',
  },
  deck: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  stackSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  finishedCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    ...shadows.card,
  },
  finishedTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  primaryCta: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  primaryCtaText: {
    color: colors.inverseText,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryCta: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  secondaryCtaText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    zIndex: 10,
    backgroundColor: colors.inverseSurface,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  toastText: {
    color: colors.inverseText,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
