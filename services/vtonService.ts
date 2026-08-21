import { File } from 'expo-file-system';
import {
  EncodingType,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { getRequiredSupabaseClient } from '../lib/supabase';
import type { GarmentCategory, TryOnOptions } from '../types/vton';

const IMAGE_MAX_WIDTH = 768;
const IMAGE_JPEG_QUALITY = 0.8;
const FETCH_TIMEOUT_MS = 180_000;
const BODY_SUMMARY_LIMIT = 240;

export class VtonServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VtonServiceError';
  }
}

interface ModalTryOnRequest {
  person_image_base64: string;
  garment_image_url: string;
  cloth_type: 'upper' | 'lower' | 'overall';
  category: GarmentCategory;
  garment_description: string;
}

interface ModalTryOnResponse {
  image_base64?: string;
  image_data_uri?: string;
  content_type?: string;
  detail?: unknown;
}

const summarizeBody = (body: string): string => {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= BODY_SUMMARY_LIMIT) {
    return compact;
  }

  return `${compact.slice(0, BODY_SUMMARY_LIMIT)}…`;
};

const getVtonProxyUrl = (): string => {
  const url = process.env.EXPO_PUBLIC_VTON_PROXY_URL?.trim().replace(/\/+$/, '');

  if (!url) {
    throw new VtonServiceError(
      'Sanal deneme adresi eksik. .env içinde EXPO_PUBLIC_VTON_PROXY_URL tanımla.',
    );
  }

  return url;
};

const getAccessToken = async (): Promise<string> => {
  const client = getRequiredSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    console.error('Oturum tokenı okunamadı', { message: error.message });
    throw new VtonServiceError(
      'Oturum doğrulanamadı. Çıkıp tekrar giriş yapmayı dene.',
    );
  }

  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new VtonServiceError('Sanal deneme için giriş yapmalısın.');
  }

  return token;
};

const toClothType = (
  category: GarmentCategory,
): ModalTryOnRequest['cloth_type'] => {
  if (category === 'lower_body') {
    return 'lower';
  }
  if (category === 'dresses') {
    return 'overall';
  }
  return 'upper';
};

const readImageAsBase64 = async (uri: string): Promise<string> => {
  try {
    const file = new File(uri);
    return await file.base64();
  } catch (error) {
    console.error('Failed to read image with File API, using legacy reader', {
      error,
    });
    return readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  }
};

const extractDetail = (body: string): string => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
      const detail = (parsed as ModalTryOnResponse).detail;
      if (typeof detail === 'string' && detail.length > 0) {
        return detail;
      }
      if (detail !== undefined) {
        return summarizeBody(JSON.stringify(detail));
      }
    }
  } catch (error) {
    console.error('Failed to parse Modal error body', { error });
  }

  return summarizeBody(body) || 'yanıt boş';
};

const throwHttpError = (status: number, body: string): never => {
  const detail = extractDetail(body);
  console.error('VTON isteği başarısız', { status, detail });

  if (status === 401 || status === 403) {
    throw new VtonServiceError(
      'Sanal deneme için oturumun doğrulanamadı. Çıkıp tekrar giriş yap.',
    );
  }

  if (status === 429) {
    throw new VtonServiceError(detail);
  }

  if (status === 400) {
    throw new VtonServiceError(
      `Sanal deneme isteği geçersiz (HTTP ${status}): ${detail}`,
    );
  }

  if (status === 408 || status === 504) {
    throw new VtonServiceError(
      `Sanal deneme zaman aşımına uğradı (HTTP ${status}). İlk denemede GPU soğuk başlıyor; biraz bekleyip tekrar dene.`,
    );
  }

  throw new VtonServiceError(
    `Sanal deneme başarısız (HTTP ${status}): ${detail}`,
  );
};

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new VtonServiceError(
        'Sanal deneme zaman aşımına uğradı (180 sn). İlk denemede GPU soğuk başlıyor; tekrar dene.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const inferGarmentCategory = (title: string): GarmentCategory => {
  const normalized = title.toLowerCase();

  if (normalized.includes('elbise') || normalized.includes('dress')) {
    return 'dresses';
  }

  if (
    normalized.includes('pantolon') ||
    normalized.includes('etek') ||
    normalized.includes('jean') ||
    normalized.includes('denim')
  ) {
    return 'lower_body';
  }

  return 'upper_body';
};

export const limitPersonImage = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: IMAGE_MAX_WIDTH } }],
    {
      compress: IMAGE_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  return result.uri;
};

export const tryOnGarment = async (
  personImageUri: string,
  garmentImageUrl: string,
  options: TryOnOptions,
): Promise<string> => {
  try {
    const endpoint = getVtonProxyUrl();
    const accessToken = await getAccessToken();
    const preparedUri = await limitPersonImage(personImageUri);
    const personImageBase64 = await readImageAsBase64(preparedUri);

    if (!personImageBase64) {
      throw new VtonServiceError(
        'Fotoğraf okunamadı. Lütfen başka bir görsel dene.',
      );
    }

    const payload: ModalTryOnRequest = {
      person_image_base64: personImageBase64,
      garment_image_url: garmentImageUrl,
      cloth_type: toClothType(options.category),
      category: options.category,
      garment_description: options.garmentDescription,
    };

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.text();

    if (!response.ok) {
      throwHttpError(response.status, body);
    }

    let parsed: ModalTryOnResponse;
    try {
      parsed = JSON.parse(body) as ModalTryOnResponse;
    } catch (error) {
      console.error('Failed to parse Modal VTON JSON', {
        error,
        body: summarizeBody(body),
      });
      throw new VtonServiceError(
        `Sanal deneme yanıtı okunamadı (HTTP ${response.status}): ${summarizeBody(body)}`,
      );
    }

    const imageDataUri = parsed.image_data_uri;
    if (!imageDataUri) {
      throw new VtonServiceError(
        `Sanal deneme sonucu görseli yok (HTTP ${response.status}).`,
      );
    }

    return imageDataUri;
  } catch (error) {
    if (error instanceof VtonServiceError) {
      throw error;
    }

    console.error('Virtual try-on failed', { error });
    throw new VtonServiceError(
      'Sanal deneme sırasında beklenmeyen bir hata oluştu. İnternetini kontrol edip tekrar dene.',
    );
  }
};
