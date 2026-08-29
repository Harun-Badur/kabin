export const FASHN_TRYON_MAX_MODEL_NAME = 'tryon-max' as const;

export const FASHN_DEFAULT_RESOLUTION = '1k' as const;
export const FASHN_DEFAULT_GENERATION_MODE = 'fast' as const;
export const FASHN_DEFAULT_PROMPT =
  "Preserve the person's face, identity, body proportions, pose, hands, skin tone, hair, and background exactly as in the model image. Only replace the clothing item with the product image. Do not change the person, body shape, camera angle, or scene.";

export type FashnResolution = '1k' | '2k' | '4k';
export type FashnGenerationMode = 'fast' | 'balanced' | 'quality';

export interface FashnTryOnMaxInputs {
  model_image: string;
  product_image: string;
  resolution: FashnResolution;
  generation_mode: FashnGenerationMode;
  num_images: 1;
  output_format: 'png';
  return_base64: true;
  prompt?: string;
}

export interface FashnTryOnMaxRequest {
  model_name: typeof FASHN_TRYON_MAX_MODEL_NAME;
  inputs: FashnTryOnMaxInputs;
}

export interface BuildFashnTryOnMaxRequestOptions {
  resolution?: FashnResolution;
  generationMode?: FashnGenerationMode;
  prompt?: string;
}

export const FASHN_TRYON_MAX_FORBIDDEN_INPUT_KEYS = [
  'seed',
  'garment_image',
  'category',
  'cloth_type',
  'garment_photo_type',
  'mode',
  'num_samples',
] as const;

export const parseFashnResolution = (
  value: string | undefined,
): FashnResolution => {
  if (value === '1k' || value === '2k' || value === '4k') {
    return value;
  }
  return FASHN_DEFAULT_RESOLUTION;
};

export const parseFashnGenerationMode = (
  value: string | undefined,
): FashnGenerationMode => {
  if (value === 'fast' || value === 'balanced' || value === 'quality') {
    return value;
  }
  return FASHN_DEFAULT_GENERATION_MODE;
};

export const resolveFashnPrompt = (
  value: string | undefined,
): string | null => {
  if (value === undefined) {
    return FASHN_DEFAULT_PROMPT;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const buildFashnTryOnMaxRequest = (
  modelImage: string,
  productImage: string,
  options: BuildFashnTryOnMaxRequestOptions = {},
): FashnTryOnMaxRequest => {
  const inputs: FashnTryOnMaxInputs = {
    model_image: modelImage,
    product_image: productImage,
    resolution: options.resolution ?? FASHN_DEFAULT_RESOLUTION,
    generation_mode: options.generationMode ?? FASHN_DEFAULT_GENERATION_MODE,
    num_images: 1,
    output_format: 'png',
    return_base64: true,
  };
  const prompt = resolveFashnPrompt(options.prompt);
  if (prompt) {
    inputs.prompt = prompt;
  }
  return {
    model_name: FASHN_TRYON_MAX_MODEL_NAME,
    inputs,
  };
};
