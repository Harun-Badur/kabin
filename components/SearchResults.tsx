import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import PressableScale from './PressableScale';
import { colors, radius, spacing } from '../lib/theme';
import type { Product } from '../types/product';

const THUMB_SIZE = 64;

interface SearchResultsProps {
  products: Product[];
  onAdd: (product: Product) => void;
  onOpenStore: (product: Product) => void;
}

interface SearchRowProps {
  product: Product;
  onAdd: (product: Product) => void;
  onOpenStore: (product: Product) => void;
}

function SearchRow({ product, onAdd, onOpenStore }: SearchRowProps) {
  return (
    <View style={styles.row}>
      <Image
        source={{ uri: product.imageUrl }}
        style={styles.thumb}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={product.id}
      />
      <View style={styles.copy}>
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={styles.actions}>
          <PressableScale
            onPress={() => onAdd(product)}
            style={styles.primary}
            accessibilityRole="button"
            accessibilityLabel="Ekle"
          >
            <Text style={styles.primaryText}>Ekle</Text>
          </PressableScale>
          <PressableScale
            onPress={() => onOpenStore(product)}
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel="Mağazaya git"
          >
            <Text style={styles.secondaryText}>Mağazaya Git</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

export default function SearchResults({
  products,
  onAdd,
  onOpenStore,
}: SearchResultsProps) {
  if (products.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Bu aramayla eşleşen ürün yok.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <SearchRow product={item} onAdd={onAdd} onOpenStore={onOpenStore} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.button,
    backgroundColor: colors.bgSoft,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
  },
  brand: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryText: {
    color: colors.inverseText,
    fontSize: 12,
    fontWeight: '800',
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
});
