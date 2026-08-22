import { Pressable, StyleSheet, Text, View } from 'react-native';
import PressableScale from './PressableScale';
import { colors, radius, spacing } from '../lib/theme';
import {
  GARMENT_SIZES,
  HEIGHT_CM_DEFAULT,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  STYLE_TAGS,
  WEIGHT_KG_DEFAULT,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  type GarmentSize,
  type StyleTag,
  type UserStudioProfile,
} from '../types/profile';

interface SizeStudioCardProps {
  profile: UserStudioProfile;
  disabled: boolean;
  onHeightChange: (value: number) => void;
  onWeightChange: (value: number) => void;
  onTopSizeChange: (value: GarmentSize) => void;
  onBottomSizeChange: (value: GarmentSize) => void;
  onStyleToggle: (value: StyleTag) => void;
}

interface StepperProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T | T[] | null;
  disabled: boolean;
  onSelect: (value: T) => void;
}

function Stepper({
  label,
  unit,
  value,
  min,
  max,
  disabled,
  onChange,
}: StepperProps) {
  return (
    <View style={styles.stepperBlock}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <PressableScale
          onPress={() => onChange(value - 1)}
          disabled={disabled || value <= min}
          style={styles.stepperButton}
          accessibilityRole="button"
          accessibilityLabel={`${label} azalt`}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </PressableScale>
        <Text style={styles.stepperValue}>{`${value} ${unit}`}</Text>
        <PressableScale
          onPress={() => onChange(value + 1)}
          disabled={disabled || value >= max}
          style={styles.stepperButton}
          accessibilityRole="button"
          accessibilityLabel={`${label} artır`}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  disabled,
  onSelect,
}: ChipGroupProps<T>) {
  const isSelected = (value: T): boolean => {
    if (Array.isArray(selected)) {
      return selected.includes(value);
    }
    return selected === value;
  };

  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = isSelected(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              disabled={disabled}
              style={[styles.chip, active ? styles.chipActive : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={option.label}
            >
              <Text
                style={[styles.chipText, active ? styles.chipTextActive : null]}
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

export default function SizeStudioCard({
  profile,
  disabled,
  onHeightChange,
  onWeightChange,
  onTopSizeChange,
  onBottomSizeChange,
  onStyleToggle,
}: SizeStudioCardProps) {
  const height = profile.heightCm ?? HEIGHT_CM_DEFAULT;
  const weight = profile.weightKg ?? WEIGHT_KG_DEFAULT;
  const sizeOptions = GARMENT_SIZES.map((size) => ({
    value: size,
    label: size,
  }));

  return (
    <View style={styles.card}>
      <View style={styles.stepperPair}>
        <Stepper
          label="Boy"
          unit="cm"
          value={height}
          min={HEIGHT_CM_MIN}
          max={HEIGHT_CM_MAX}
          disabled={disabled}
          onChange={onHeightChange}
        />
        <Stepper
          label="Kilo"
          unit="kg"
          value={weight}
          min={WEIGHT_KG_MIN}
          max={WEIGHT_KG_MAX}
          disabled={disabled}
          onChange={onWeightChange}
        />
      </View>
      <ChipGroup
        label="Üst beden"
        options={sizeOptions}
        selected={profile.topSize}
        disabled={disabled}
        onSelect={onTopSizeChange}
      />
      <ChipGroup
        label="Alt beden"
        options={sizeOptions}
        selected={profile.bottomSize}
        disabled={disabled}
        onSelect={onBottomSizeChange}
      />
      <ChipGroup
        label="Stil"
        options={STYLE_TAGS.map((tag) => ({
          value: tag.value,
          label: tag.label,
        }))}
        selected={profile.styleTags}
        disabled={disabled}
        onSelect={onStyleToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.input,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  stepperPair: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepperBlock: {
    flex: 1,
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
  stepperRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xs,
  },
  stepperButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.inverseText,
  },
});
