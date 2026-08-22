import {
  GARMENT_SIZES,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  STYLE_TAGS,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  type GarmentSize,
  type StyleTag,
} from '../types/profile';

const STYLE_TAG_VALUES: readonly StyleTag[] = STYLE_TAGS.map(
  (entry) => entry.value,
);

export const clampHeightCm = (value: number): number =>
  Math.min(HEIGHT_CM_MAX, Math.max(HEIGHT_CM_MIN, Math.round(value)));

export const clampWeightKg = (value: number): number =>
  Math.min(WEIGHT_KG_MAX, Math.max(WEIGHT_KG_MIN, Math.round(value)));

export const isGarmentSize = (value: unknown): value is GarmentSize =>
  typeof value === 'string' &&
  (GARMENT_SIZES as readonly string[]).includes(value);

export const isStyleTag = (value: unknown): value is StyleTag =>
  typeof value === 'string' &&
  (STYLE_TAG_VALUES as readonly string[]).includes(value);

export const parseStyleTags = (value: unknown): StyleTag[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isStyleTag);
};
