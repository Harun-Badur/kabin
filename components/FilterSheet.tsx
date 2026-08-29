import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PressableScale from './PressableScale';
import { colors, radius, spacing } from '../lib/theme';
import type {
  ProductFilters,
  ProductGender,
} from '../services/productService';
import type { GarmentCategory } from '../types/product';

const CATEGORY_CHIPS: { value: GarmentCategory; label: string }[] = [
  { value: 'upper_body', label: 'Üst' },
  { value: 'lower_body', label: 'Alt' },
  { value: 'dresses', label: 'Elbise' },
];

const GENDER_CHIPS: { value: ProductGender; label: string }[] = [
  { value: 'women', label: 'Kadın' },
  { value: 'men', label: 'Erkek' },
  { value: 'unisex', label: 'Unisex' },
];

const SIZE_CHIPS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

interface FilterSheetProps {
  visible: boolean;
  filters: ProductFilters;
  onClose: () => void;
  onApply: (filters: ProductFilters) => void;
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T | null) => void;
}

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const isActive = selected === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(isActive ? null : option.value)}
              style={[styles.chip, isActive ? styles.chipActive : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={option.label}
            >
              <Text
                style={[styles.chipText, isActive ? styles.chipTextActive : null]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function FilterSheet({
  visible,
  filters,
  onClose,
  onApply,
}: FilterSheetProps) {
  const [draft, setDraft] = useState<ProductFilters>(filters);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [filters, visible]);

  const handleClear = (): void => {
    setDraft({ query: filters.query });
  };

  const handleApply = (): void => {
    onApply({
      ...draft,
      query: filters.query,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Filtreleri kapat"
        />
        <View style={styles.sheet}>
          <Text style={styles.title}>Filtrele</Text>
          <ChipGroup
            label="Kategori"
            options={CATEGORY_CHIPS}
            selected={draft.category ?? null}
            onSelect={(category) => setDraft((current) => ({ ...current, category }))}
          />
          <ChipGroup
            label="Cinsiyet"
            options={GENDER_CHIPS}
            selected={draft.gender ?? null}
            onSelect={(gender) => setDraft((current) => ({ ...current, gender }))}
          />
          <ChipGroup
            label="Beden"
            options={SIZE_CHIPS.map((size) => ({ value: size, label: size }))}
            selected={draft.size ?? null}
            onSelect={(size) => setDraft((current) => ({ ...current, size }))}
          />
          <View style={styles.actions}>
            <PressableScale
              onPress={handleClear}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Temizle"
            >
              <Text style={styles.clearText}>Temizle</Text>
            </PressableScale>
            <PressableScale
              onPress={handleApply}
              style={styles.applyButton}
              accessibilityRole="button"
              accessibilityLabel="Uygula"
            >
              <Text style={styles.applyText}>Uygula</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
    opacity: 0.4,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.lg,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.inverseText,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  clearButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  clearText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  applyText: {
    color: colors.inverseText,
    fontSize: 16,
    fontWeight: '800',
  },
});
