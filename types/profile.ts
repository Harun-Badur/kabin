export const GARMENT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

export type GarmentSize = (typeof GARMENT_SIZES)[number];

export const STYLE_TAGS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'street', label: 'Sokak' },
  { value: 'classic', label: 'Klasik' },
  { value: 'sport', label: 'Spor' },
] as const;

export type StyleTag = (typeof STYLE_TAGS)[number]['value'];

export interface UserStudioProfile {
  userId: string;
  heightCm: number | null;
  weightKg: number | null;
  topSize: GarmentSize | null;
  bottomSize: GarmentSize | null;
  styleTags: StyleTag[];
  modelPhotoPath: string | null;
}

export interface StudioProfilePatch {
  heightCm?: number | null;
  weightKg?: number | null;
  topSize?: GarmentSize | null;
  bottomSize?: GarmentSize | null;
  styleTags?: StyleTag[];
  modelPhotoPath?: string | null;
}

export const HEIGHT_CM_MIN = 150;
export const HEIGHT_CM_MAX = 210;
export const WEIGHT_KG_MIN = 40;
export const WEIGHT_KG_MAX = 150;
export const HEIGHT_CM_DEFAULT = 170;
export const WEIGHT_KG_DEFAULT = 65;
