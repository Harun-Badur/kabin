export type TryOnStatus = 'idle' | 'loading' | 'error' | 'success';

export type GarmentCategory = 'upper_body' | 'lower_body' | 'dresses';

export interface TryOnOptions {
  garmentDescription: string;
  category: GarmentCategory;
}
