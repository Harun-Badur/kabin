import { Alert, Linking } from 'react-native';
import { buildAffiliateUrl } from '../lib/deeplink';
import { logger } from '../lib/logger';
import type { FeedProvider, Product } from '../types/product';

// Trendyol ürün sayfası: /p/{contentId} kısa form.
const TRENDYOL_PRODUCT_URL = 'https://www.trendyol.com/p/{id}';
// Hepsiburada ürün sayfası: /urun/{sku} kısa form.
const HEPSIBURADA_PRODUCT_URL = 'https://www.hepsiburada.com/urun/{id}';
const AMAZON_PRODUCT_URL = 'https://www.amazon.com.tr/dp/{id}';

export const PROVIDER_REDIRECT_LABEL: Record<FeedProvider, string> = {
  trendyol: "Trendyol'a",
  hepsiburada: "Hepsiburada'ya",
  amazon: "Amazon'a",
  mock: 'mağazaya',
};

interface AffiliateTags {
  amazon?: string;
  trendyol?: string;
  hepsiburada?: string;
}

export const parseAffiliateTagsJson = (): AffiliateTags => {
  const raw =
    process.env.EXPO_PUBLIC_AFFILIATE_TAGS_JSON ??
    process.env.AFFILIATE_TAGS_JSON;

  if (!raw || raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }

    const tags: AffiliateTags = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        continue;
      }
      if (key === 'amazon' || key === 'trendyol' || key === 'hepsiburada') {
        tags[key] = value.trim();
      }
    }
    return tags;
  } catch (error) {
    logger.error('AFFILIATE_TAGS_JSON çözümlenemedi', { error });
    return {};
  }
};

const buildFallbackProductUrl = (
  provider: FeedProvider,
  externalId: string,
): string => {
  switch (provider) {
    case 'trendyol':
      return TRENDYOL_PRODUCT_URL.replace('{id}', encodeURIComponent(externalId));
    case 'hepsiburada':
      return HEPSIBURADA_PRODUCT_URL.replace(
        '{id}',
        encodeURIComponent(externalId),
      );
    case 'amazon':
      return AMAZON_PRODUCT_URL.replace('{id}', encodeURIComponent(externalId));
    case 'mock':
      return TRENDYOL_PRODUCT_URL.replace('{id}', encodeURIComponent(externalId));
  }
};

const resolveProductUrl = (product: Product): string | null => {
  const existing = product.affiliateUrl?.trim() || product.productUrl?.trim();
  if (existing) {
    return existing;
  }

  const provider = product.provider;
  const externalId = product.externalId?.trim();
  if (!provider || !externalId) {
    return null;
  }

  return buildFallbackProductUrl(provider, externalId);
};

const applyAffiliateTag = (product: Product, url: string): string => {
  const provider = product.provider ?? 'mock';
  const tags = parseAffiliateTagsJson();
  const tag = tags[provider as keyof AffiliateTags];
  return buildAffiliateUrl(provider, url, tag);
};

export const getRedirectLabel = (product: Product): string => {
  const provider = product.provider ?? 'mock';
  return PROVIDER_REDIRECT_LABEL[provider];
};

export const openProductPage = async (product: Product): Promise<void> => {
  try {
    const resolvedUrl = resolveProductUrl(product);
    if (!resolvedUrl) {
      Alert.alert(
        'Mağaza linki yok',
        'Bu ürün için pazaryeri adresi bulunamadı.',
      );
      return;
    }

    const targetUrl = product.affiliateUrl?.trim()
      ? resolvedUrl
      : applyAffiliateTag(product, resolvedUrl);

    const canOpen = await Linking.canOpenURL(targetUrl);
    if (!canOpen) {
      Alert.alert(
        'Sayfa açılamadı',
        'Mağaza bağlantısı bu cihazda açılamıyor. Linki daha sonra dene.',
      );
      return;
    }

    await Linking.openURL(targetUrl);
  } catch (error) {
    logger.error('Pazaryeri sayfası açılamadı', {
      error,
      productId: product.id,
    });
    Alert.alert(
      'Yönlendirme başarısız',
      'Pazaryeri sayfası açılamadı. İnternetini kontrol edip tekrar dene.',
    );
  }
};
