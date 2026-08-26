import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import FeedModeSegment from '../../components/FeedModeSegment';
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
import { track, trackFeedImpression } from '../../lib/analytics';
import { setSessionFilters, setSessionQuery } from '../../lib/sessionIntent';
import {
  DECK_PROMOTE_SPRING,
  DECK_VISIBLE_COUNT,
  deckClearTravelPx,
  getStackPose,
  getUndoParkY,
  lerp,
  passProgress,
  undoReturnProgress,
} from '../../lib/motion';
import { hasSeenSwipeHint, markSwipeHintSeen } from '../../lib/onboarding';
import { colors, headerToDeckForHeight, layout, radius, shadows, spacing } from '../../lib/theme';
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
import type { FeedMode } from '../../types/recommendation';

const TOAST_DURATION_MS = 1600;
const UNDO_TOAST_DURATION_MS = 1200;
const FILTER_HIT_SIZE = 40;
const SEARCH_DIVIDER_HEIGHT = 24;
const SEARCH_TRACK_DEBOUNCE_MS = 500;
/** Header, clip sınırında kesilen kartın üstünde kalır. */
const HEADER_Z_INDEX = 7;

type HintStatus = 'checking' | 'visible' | 'hidden';

/** Aynı fizik: kart ya destede, ya clip üstünde park etmiş, ya da uçmakta. */
type DeckRole = 'stack' | 'peek' | 'exiting';

interface DeckSlot {
  product: Product;
  depth: number;
  role: DeckRole;
}

/** Tüm slotlar aynı kart çerçevesini paylaşır; poz merkezi fonksiyondan gelir. */
const FRONT_POSE = getStackPose(0, SWIPE_CARD_HEIGHT);
const BEHIND_POSE = getStackPose(1, SWIPE_CARD_HEIGHT);
const UNDO_PARK_Y = getUndoParkY(SWIPE_CARD_HEIGHT);
const UNDO_RETURN_TRAVEL_PX = deckClearTravelPx(SWIPE_CARD_HEIGHT);

interface StackSlotProps {
  product: Product;
  depth: number;
  role: DeckRole;
  isTop: boolean;
  canLike: boolean;
  canUndo: boolean;
  deckPullY: SharedValue<number>;
  onAddToCloset: (product: Product) => void;
  onPass: (product: Product) => void;
  onPassExitSettled: (product: Product) => void;
  onVirtualTryOn: (product: Product) => void;
  onBuy: (product: Product) => void;
  onUndoPass: () => void;
  onRequireAuth: () => void;
  onImpression: (product: Product, dwellMs: number) => void;
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
  role,
  isTop,
  canLike,
  canUndo,
  deckPullY,
  onAddToCloset,
  onPass,
  onPassExitSettled,
  onVirtualTryOn,
  onBuy,
  onUndoPass,
  onRequireAuth,
  onImpression,
}: StackSlotProps) {
  const isPeek = role === 'peek';
  const isExiting = role === 'exiting';
  const initialPose = getStackPose(depth, SWIPE_CARD_HEIGHT);
  const scale = useSharedValue(initialPose.scale);
  const translateY = useSharedValue(initialPose.translateY);
  const opacity = useSharedValue(initialPose.opacity);
  /** Park → ön kart devri: kartın bıraktığı yerden desteye iniş. */
  const returnY = useSharedValue(0);
  const wasPeek = useRef(isPeek);
  const previousDepth = useRef(depth);
  const frontScale = FRONT_POSE.scale;
  const frontTranslateY = FRONT_POSE.translateY;
  const frontOpacity = FRONT_POSE.opacity;
  const behindScale = BEHIND_POSE.scale;
  const behindTranslateY = BEHIND_POSE.translateY;
  const undoParkY = UNDO_PARK_Y;

  useLayoutEffect(() => {
    if (isPeek || isExiting) {
      wasPeek.current = isPeek;
      previousDepth.current = depth;
      return;
    }
    const pose = getStackPose(depth, SWIPE_CARD_HEIGHT);
    if (wasPeek.current) {
      // Undo settle'da kart zaten ön pozda. Park Y'den spring-in, clip üstünden
      // bir kare flash olarak düşer.
      returnY.value = 0;
      scale.value = frontScale;
      translateY.value = frontTranslateY;
      opacity.value = frontOpacity;
    }
    if (depth === 0 && previousDepth.current === 1) {
      // Pass sırasında bu kart zaten öne doğru interpolate edilmişti.
      const lift = passProgress(deckPullY.value);
      if (lift > 0) {
        scale.value = lerp(behindScale, frontScale, lift);
        translateY.value = lerp(behindTranslateY, frontTranslateY, lift);
        opacity.value = frontOpacity;
      }
    }
    if (depth === 1 && previousDepth.current === 0) {
      // Undo commit'inde iniş tamamlanmıştı; spring hedefi zaten burası.
      scale.value = behindScale;
      translateY.value = behindTranslateY;
    }
    wasPeek.current = false;
    previousDepth.current = depth;
    scale.value = withSpring(pose.scale, DECK_PROMOTE_SPRING);
    translateY.value = withSpring(pose.translateY, DECK_PROMOTE_SPRING);
    opacity.value = withSpring(pose.opacity, DECK_PROMOTE_SPRING);
  }, [
    behindScale,
    behindTranslateY,
    deckPullY,
    depth,
    frontOpacity,
    frontScale,
    frontTranslateY,
    isExiting,
    isPeek,
    opacity,
    returnY,
    scale,
    translateY,
  ]);

  /**
   * deckPullY işareti rolleri ayırır: negatif (yukarı) yalnız arka kartı öne
   * çeker, pozitif (aşağı) yalnız ön kartı arka slota indirir. Böylece rol
   * devrinde iki interpolasyon birbirine karışmaz.
   */
  const stackOuterStyle = useAnimatedStyle(() => {
    if (isExiting) {
      return {
        opacity: frontOpacity,
        transform: [{ translateY: 0 }, { scale: frontScale }],
      };
    }
    if (isPeek) {
      return {
        opacity: frontOpacity,
        transform: [
          { translateY: undoParkY + Math.max(deckPullY.value, 0) },
          { scale: frontScale },
        ],
      };
    }
    if (depth === 0) {
      const sink = undoReturnProgress(deckPullY.value, UNDO_RETURN_TRAVEL_PX);
      return {
        opacity: opacity.value,
        transform: [
          {
            translateY:
              returnY.value +
              interpolate(sink, [0, 1], [translateY.value, behindTranslateY]),
          },
          { scale: interpolate(sink, [0, 1], [scale.value, behindScale]) },
        ],
      };
    }
    if (depth === 1) {
      const lift = passProgress(deckPullY.value);
      return {
        opacity: opacity.value,
        transform: [
          {
            translateY:
              returnY.value +
              interpolate(lift, [0, 1], [translateY.value, frontTranslateY]),
          },
          { scale: interpolate(lift, [0, 1], [scale.value, frontScale]) },
        ],
      };
    }
    return {
      opacity: opacity.value,
      transform: [
        { translateY: returnY.value + translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <View
      pointerEvents={isTop ? 'auto' : 'none'}
      style={[
        styles.stackSlot,
        {
          zIndex: isExiting
            ? DECK_VISIBLE_COUNT + 2
            : isPeek
              ? DECK_VISIBLE_COUNT + 1
              : DECK_VISIBLE_COUNT - depth,
        },
      ]}
    >
      <Animated.View style={[styles.cardFill, stackOuterStyle]}>
        <SwipeCard
          product={product}
          isInteractive={isTop}
          isExiting={isExiting}
          canLike={canLike}
          canUndo={canUndo}
          castShadow={!isPeek && !isExiting}
          deckPullY={isTop ? deckPullY : undefined}
          onAddToCloset={onAddToCloset}
          onPass={onPass}
          onPassExitSettled={onPassExitSettled}
          onVirtualTryOn={onVirtualTryOn}
          onBuy={onBuy}
          onUndoPass={onUndoPass}
          onRequireAuth={onRequireAuth}
          onImpression={isTop ? onImpression : undefined}
        />
      </Animated.View>
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const headerToDeckPx = headerToDeckForHeight(windowHeight);
  const { user } = useAuthContext();
  const currentProducts = useAppStore((state) => state.currentProducts);
  const feedStatus = useAppStore((state) => state.feedStatus);
  const seenCount = useAppStore(
    (state) => state.likedProducts.length + state.passedProductIds.length,
  );
  const loadFeed = useAppStore((state) => state.loadFeed);
  const setFeedMode = useAppStore((state) => state.setFeedMode);
  const feedMode = useAppStore((state) => state.feedMode);
  const swipeRight = useAppStore((state) => state.swipeRight);
  const swipeLeft = useAppStore((state) => state.swipeLeft);
  const undoPass = useAppStore((state) => state.undoPass);
  const lastPassed = useAppStore((state) => {
    const stack = state.passedStack;
    return stack[stack.length - 1] ?? null;
  });
  const [exitingProducts, setExitingProducts] = useState<Product[]>([]);
  const deckPullY = useSharedValue(0);
  const topProductId = currentProducts[0]?.id ?? null;

  useLayoutEffect(() => {
    deckPullY.value = 0;
  }, [deckPullY, topProductId]);

  const userId = user?.id ?? null;
  const canLike = user !== null;

  const reloadFeed = useCallback((): void => {
    void loadFeed(userId);
  }, [loadFeed, userId]);

  const handleFeedModeChange = useCallback(
    (mode: FeedMode): void => {
      if (mode === feedMode) {
        return;
      }
      setFeedMode(mode);
      void loadFeed(userId);
    },
    [feedMode, loadFeed, setFeedMode, userId],
  );

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
        setExitingProducts((prev) =>
          prev.some((item) => item.id === product.id)
            ? prev
            : [...prev, product],
        );
        swipeLeft(product);
      } catch (error) {
        logger.error('Geçme işlenemedi', { error, productId: product.id });
        setExitingProducts((prev) =>
          prev.filter((item) => item.id !== product.id),
        );
      }
    },
    [swipeLeft],
  );

  const handlePassExitSettled = useCallback((product: Product): void => {
    setExitingProducts((prev) =>
      prev.some((item) => item.id === product.id)
        ? prev.filter((item) => item.id !== product.id)
        : prev,
    );
  }, []);

  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hintStatus, setHintStatus] = useState<HintStatus>('checking');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({});
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleImpression = useCallback(
    (product: Product, dwellMs: number): void => {
      const position = currentProducts.findIndex((item) => item.id === product.id);
      trackFeedImpression(product.id, Math.max(position, 0), dwellMs);
    },
    [currentProducts],
  );

  const handleApplyFilters = useCallback(
    (next: ProductFilters): void => {
      setFilters(next);
      setSessionFilters({
        category: next.category ?? null,
        gender: next.gender ?? null,
        size: next.size ?? null,
      });
      track('filter', null, {
        category: next.category ?? null,
        gender: next.gender ?? null,
        size: next.size ?? null,
      });
      void loadFeed(userId);
    },
    [loadFeed, userId],
  );

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

  const showToast = useCallback(
    (message: string, durationMs: number = TOAST_DURATION_MS): void => {
      if (toastTimeoutRef.current !== null) {
        clearTimeout(toastTimeoutRef.current);
      }
      setToastMessage(message);
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage(null);
        toastTimeoutRef.current = null;
      }, durationMs);
    },
    [],
  );

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

  const handleUndoPass = useCallback((): void => {
    const restoring = lastPassed;
    // Park eden kart yerine oturdu: rol devrinden önce çekiş sıfırlanır, böylece
    // öne geçen kart tek kare bile arka poza düşmez.
    deckPullY.value = 0;
    const restored = undoPass();
    if (!restored || restoring === null) {
      return;
    }
    setExitingProducts((prev) =>
      prev.filter((item) => item.id !== restoring.id),
    );
    showToast('Geri alındı', UNDO_TOAST_DURATION_MS);
  }, [deckPullY, lastPassed, showToast, undoPass]);

  const peekProduct =
    lastPassed !== null &&
    lastPassed.id !== currentProducts[0]?.id &&
    !exitingProducts.some((item) => item.id === lastPassed.id)
      ? lastPassed
      : null;
  const visibleSlots = useMemo(
    () =>
      currentProducts
        .slice(0, DECK_VISIBLE_COUNT)
        .map((product, depth) => ({ product, depth }))
        .reverse(),
    [currentProducts],
  );

  /**
   * Deste, uçan ve peek kartlar dahil TEK keyed liste: rol değişimi (top → exiting,
   * peek → top) React'te remount değil, prop güncellemesi olur. Ayrı children
   * dizileri kullanılırsa aynı key eşleşmez ve süren çıkış animasyonu kaybolur.
   */
  const deckSlots = useMemo<DeckSlot[]>(() => {
    const slots: DeckSlot[] = visibleSlots.map(({ product, depth }) => ({
      product,
      depth,
      role: 'stack',
    }));
    if (peekProduct !== null) {
      slots.push({ product: peekProduct, depth: 0, role: 'peek' });
    }
    for (const product of exitingProducts) {
      if (slots.some((slot) => slot.product.id === product.id)) {
        continue;
      }
      slots.push({ product, depth: 0, role: 'exiting' });
    }
    return slots;
  }, [exitingProducts, peekProduct, visibleSlots]);

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

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length === 0) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setSessionQuery(query);
      track('search', null, {
        query,
        result_count: filterProducts(currentProducts, {
          ...filters,
          query,
        }).length,
      });
    }, SEARCH_TRACK_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentProducts, filters, searchQuery]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop:
            (insets.top > 0 ? insets.top : layout.statusBarFallback) +
            layout.headerPaddingTop,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          { paddingBottom: headerToDeckPx },
        ]}
      >
        <View style={styles.searchBar}>
          <Search color={colors.icon} size={18} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Ne arıyorsun?"
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
        <View style={styles.segmentWrap}>
          <FeedModeSegment value={feedMode} onChange={handleFeedModeChange} />
        </View>
      </View>
      <View
        style={[
          styles.body,
          { paddingBottom: layout.deckPadding },
        ]}
      >
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
        ) : isCatalogExhausted && exitingProducts.length === 0 ? (
          <DeckFinishedCard
            subtitle="Katalogdaki her şeyi gördün. Yeni ürünler eklendikçe burada belirir."
            onRefresh={reloadFeed}
            onOpenLiked={handleOpenLiked}
          />
        ) : visibleSlots.length === 0 && exitingProducts.length === 0 ? (
          <DeckFinishedCard
            subtitle="Beğendiğin parçalar dolabına eklendi. Yeni öneriler yakında."
            onRefresh={reloadFeed}
            onOpenLiked={handleOpenLiked}
          />
        ) : (
          <View style={styles.deckClip} collapsable={false}>
            <View style={styles.deck}>
              {deckSlots.map(({ product, depth, role }) => (
                <StackSlot
                  key={product.id}
                  product={product}
                  depth={depth}
                  role={role}
                  isTop={role === 'stack' && depth === 0}
                  canLike={canLike}
                  canUndo={lastPassed !== null}
                  deckPullY={deckPullY}
                  onAddToCloset={handleSwipeRight}
                  onPass={handleSwipeLeft}
                  onPassExitSettled={handlePassExitSettled}
                  onVirtualTryOn={handleVirtualTryOn}
                  onBuy={handleBuy}
                  onUndoPass={handleUndoPass}
                  onRequireAuth={handleRequireAuth}
                  onImpression={handleImpression}
                />
              ))}
            </View>
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
        onApply={handleApplyFilters}
      />
      <VirtualTryOnModal
        visible={tryOnProduct !== null}
        product={tryOnProduct}
        onClose={handleCloseTryOn}
      />
      {toastMessage ? (
        <View
          style={[
            styles.toast,
            {
              top:
                (insets.top > 0 ? insets.top : layout.statusBarFallback) +
                layout.headerPaddingTop +
                layout.headerControl +
                layout.searchToSegment +
                layout.segmentHeight +
                spacing.sm,
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
    zIndex: HEADER_Z_INDEX,
  },
  searchBar: {
    width: '100%',
    height: layout.headerControl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.input,
    borderRadius: radius.card,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    marginBottom: 0,
    zIndex: 6,
    ...shadows.input,
  },
  segmentWrap: {
    marginTop: layout.searchToSegment,
    alignItems: 'flex-start',
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
    justifyContent: 'center',
  },
  searchResults: {
    flex: 1,
    alignSelf: 'stretch',
  },
  /**
   * Clip üst kenarı = deck top. Padding/negatif margin yok; park kartı
   * header/segment aralığına sızamaz.
   */
  deckClip: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: -layout.deckPadding,
    paddingBottom: layout.deckPadding,
  },
  deck: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  stackSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  cardFill: {
    ...StyleSheet.absoluteFillObject,
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
    left: spacing.xxl,
    right: spacing.xxl,
    zIndex: 10,
    backgroundColor: colors.inverseSurface,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  toastText: {
    color: colors.inverseText,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
