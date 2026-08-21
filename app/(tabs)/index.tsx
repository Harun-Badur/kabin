import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
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
import SkeletonShimmer from '../../components/SkeletonShimmer';
import VirtualTryOnModal from '../../components/VirtualTryOnModal';
import { useAuthContext } from '../../hooks/useAuthContext';
import { logger } from '../../lib/logger';
import {
  getRedirectLabel,
  openProductPage,
} from '../../services/deeplinkService';
import { useAppStore } from '../../store/useAppStore';
import type { Product } from '../../types/product';

const VISIBLE_STACK_SIZE = 3;
const STACK_SCALE_STEP = 0.05;
const STACK_TRANSLATE_Y_STEP = 14;
const STACK_SPRING = { damping: 16, stiffness: 160 } as const;
const TOAST_DURATION_MS = 1600;

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
        borderRadius={24}
      />
      <Text style={styles.loadingTitle}>Ürünler yükleniyor...</Text>
      <Text style={styles.emptySubtitle}>
        Kabin feedi hazırlanıyor. Birazdan kaydırmaya başlayabilirsin.
      </Text>
    </View>
  );
}

function EmptyFeed() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🎉</Text>
      <Text style={styles.emptyTitle}>Şimdilik bu kadar!</Text>
      <Text style={styles.emptySubtitle}>
        Beğendiğin parçalar dolabına eklendi. Yeni öneriler yakında.
      </Text>
    </View>
  );
}

interface ExhaustedFeedProps {
  onRefresh: () => void;
}

function ExhaustedFeed({ onRefresh }: ExhaustedFeedProps) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>👀</Text>
      <Text style={styles.emptyTitle}>Katalogdaki her şeyi gördün</Text>
      <Text style={styles.emptySubtitle}>
        Yeni ürünler eklendikçe haberdar ol: beğendiğin parçalarda fiyat alarmını
        açık bırak, dolabına yeni öneriler düştüğünde bildirim gönderiyoruz.
      </Text>
      <PressableScale
        onPress={onRefresh}
        style={styles.refreshButton}
        accessibilityRole="button"
        accessibilityLabel="Yeni ürünleri kontrol et"
      >
        <Text style={styles.refreshButtonText}>Yeni ürünleri kontrol et</Text>
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
  const scale = useSharedValue(isTop ? 1 : 1 - depth * STACK_SCALE_STEP);
  const translateY = useSharedValue(
    isTop ? 0 : depth * STACK_TRANSLATE_Y_STEP,
  );

  useEffect(() => {
    scale.value = withSpring(
      isTop ? 1 : 1 - depth * STACK_SCALE_STEP,
      STACK_SPRING,
    );
    translateY.value = withSpring(
      isTop ? 0 : depth * STACK_TRANSLATE_Y_STEP,
      STACK_SPRING,
    );
  }, [depth, isTop, scale, translateY]);

  const animatedSlotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents={isTop ? 'auto' : 'none'}
      style={[
        styles.stackSlot,
        { zIndex: VISIBLE_STACK_SIZE - depth },
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
  const feedIsPersonalized = useAppStore((state) => state.feedIsPersonalized);
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
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        .slice(0, VISIBLE_STACK_SIZE)
        .map((product, depth) => ({ product, depth }))
        .reverse(),
    [currentProducts],
  );

  // Katalogda ürün var ama hepsi beğenildi/geçildi: tekrar yüklemek işe yaramaz,
  // kullanıcıya yeni ürünlerden haberdar olma yolunu göster.
  const isCatalogExhausted = visibleSlots.length === 0 && seenCount > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Kabin</Text>
      {feedIsPersonalized && visibleSlots.length > 0 ? (
        <View style={styles.personalizedBadge} pointerEvents="none">
          <Sparkles color="#0F172A" size={12} />
          <Text style={styles.personalizedBadgeText}>Sana özel sıralandı</Text>
        </View>
      ) : null}
      {feedStatus === 'loading' || feedStatus === 'idle' ? (
        <LoadingFeed />
      ) : isCatalogExhausted ? (
        <ExhaustedFeed onRefresh={reloadFeed} />
      ) : visibleSlots.length === 0 ? (
        <EmptyFeed />
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
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 28,
  },
  header: {
    position: 'absolute',
    top: 56,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#0F172A',
  },
  personalizedBadge: {
    position: 'absolute',
    top: 62,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  personalizedBadgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  deck: {
    width: SWIPE_CARD_WIDTH,
    height: SWIPE_CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackSlot: {
    position: 'absolute',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#64748B',
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 22,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  refreshButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
