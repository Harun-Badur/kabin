import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import PressableScale from '../../components/PressableScale';
import RefreshSpinner from '../../components/RefreshSpinner';
import SkeletonShimmer from '../../components/SkeletonShimmer';
import VirtualTryOnModal from '../../components/VirtualTryOnModal';
import { logger } from '../../lib/logger';
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

interface LikedItemProps {
  item: LikedProduct;
  onTryOn: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleNotify: (productId: string, value: boolean) => void;
  isDeleting: boolean;
}

function LikedItem({
  item,
  onTryOn,
  onDelete,
  onToggleNotify,
  isDeleting,
}: LikedItemProps) {
  const { product } = item;
  const [hasImageError, setHasImageError] = useState(false);

  const livePrice = getDisplayPrice(product);
  const previousPrice = product.previousPrice;
  const hasDrop = hasCatalogPriceDrop(product);
  const dropPercent =
    hasDrop && typeof previousPrice === 'number'
      ? getDropPercent(previousPrice, livePrice)
      : 0;

  return (
    <View style={styles.card}>
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
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={styles.priceRow}>
          {hasDrop && typeof previousPrice === 'number' ? (
            <Text style={styles.previousPrice}>
              {formatTryPrice(previousPrice)}
            </Text>
          ) : null}
          <Text style={[styles.price, hasDrop ? styles.livePriceDrop : null]}>
            {formatTryPrice(livePrice)}
          </Text>
          {hasDrop ? (
            <View style={styles.dropBadge}>
              <Text style={styles.dropBadgeText}>{`↓ %${dropPercent}`}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.alertRow}>
          <Text style={styles.alertLabel}>
            {item.notifyOnPriceDrop ? 'Fiyat alarmı açık' : 'Fiyat alarmı kapalı'}
          </Text>
          <Switch
            value={item.notifyOnPriceDrop}
            onValueChange={(value) => onToggleNotify(product.id, value)}
            trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
            thumbColor={item.notifyOnPriceDrop ? '#16A34A' : '#F8FAFC'}
            accessibilityLabel="Fiyat alarmı"
          />
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
            onPress={() => onDelete(product)}
            disabled={isDeleting}
            style={styles.deleteButton}
            accessibilityRole="button"
            accessibilityLabel="Sil"
          >
            {isDeleting ? (
              <ActivityIndicator color="#DC2626" size="small" />
            ) : (
              <Text style={styles.deleteButtonText}>Sil</Text>
            )}
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

export default function LikedScreen() {
  const likedProducts = useAppStore((state) => state.likedProducts);
  const sessionSyncStatus = useAppStore((state) => state.sessionSyncStatus);
  const unlikeProduct = useAppStore((state) => state.unlikeProduct);
  const updateLikeAlert = useAppStore((state) => state.updateLikeAlert);
  const refreshLikedProducts = useAppStore(
    (state) => state.refreshLikedProducts,
  );
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasFreshLoad, setHasFreshLoad] = useState(false);
  const lastLoadedAtRef = useRef(0);

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

  const handleToggleNotify = useCallback(
    (productId: string, value: boolean): Promise<void> =>
      updateLikeAlert(productId, { notifyOnPriceDrop: value }).catch(
        (error: unknown) => {
          logger.error('Alarm anahtarı güncellenemedi', { error });
          Alert.alert(
            'Kaydedilemedi',
            'Fiyat alarmı güncellenirken bir sorun oluştu.',
          );
        },
      ),
    [updateLikeAlert],
  );

  const handleDelete = useCallback(
    (product: Product): void => {
      Alert.alert(
        'Beğeniyi sil',
        `${product.brand} ürününü dolabından çıkarmak istiyor musun?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: () => {
              setDeletingId(product.id);
              void unlikeProduct(product.id)
                .catch((error: unknown) => {
                  logger.error('Beğeni silinemedi', { error });
                  Alert.alert(
                    'Silinemedi',
                    'Beğeni kaldırılırken bir sorun oluştu. Tekrar dene.',
                  );
                })
                .finally(() => {
                  setDeletingId(null);
                });
            },
          },
        ],
      );
    },
    [unlikeProduct],
  );

  if (sessionSyncStatus === 'loading' || !hasFreshLoad) {
    return (
      <View style={styles.root}>
        <Text style={styles.header}>Beğenilenler</Text>
        <View style={styles.list}>
          {LIKED_SKELETON_KEYS.map((key) => (
            <View key={key} style={styles.card}>
              <SkeletonShimmer width={112} height={148} borderRadius={0} />
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
      <Text style={styles.header}>Beğenilenler</Text>
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
            Henüz beğendiğin ürün yok. Keşfetmeye başla!
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
              onDelete={handleDelete}
              onToggleNotify={(productId, value) => {
                void handleToggleNotify(productId, value);
              }}
              isDeleting={deletingId === item.product.id}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 56,
  },
  flex: {
    flex: 1,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  image: {
    width: 112,
    minHeight: 148,
    backgroundColor: '#E2E8F0',
  },
  imageFallback: {
    width: 112,
    minHeight: 148,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  imageFallbackText: {
    color: '#64748B',
    fontWeight: '600',
  },
  meta: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  skeletonMeta: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  previousPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  livePriceDrop: {
    color: '#16A34A',
  },
  dropBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dropBadgeText: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '800',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  alertLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
    paddingRight: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  tryButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tryButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: 12,
    color: '#94A3B8',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 26,
  },
});
