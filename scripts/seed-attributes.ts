/**
 * products → product_attributes idempotent seed.
 *
 *   npx tsx scripts/seed-attributes.ts
 *
 * Önkoşul: supabase/recs_v1.sql uygulanmış olsun.
 */
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  CURATED_ATTRIBUTE_OVERRIDES,
  inferProductAttributes,
  normalizeTitleKey,
} from '../lib/productAttributes';
import { parseNumeric } from '../lib/price';

loadEnv();

const PAGE_SIZE = 500;

interface ProductRow {
  id: string;
  title: string;
  brand: string | null;
  price: number | string;
  category: string;
  colors: unknown;
}

interface AttributeRow {
  product_id: string;
  gender: string;
  colors: string[];
  fit: string;
  subcategory: string;
  brand_slug: string;
  price_band: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const colorNamesFromJsonb = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== 'string') {
      return [];
    }
    return [item.name];
  });
};

const isProductRow = (value: unknown): value is ProductRow => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    (typeof value.brand === 'string' || value.brand === null) &&
    (typeof value.price === 'number' || typeof value.price === 'string') &&
    typeof value.category === 'string'
  );
};

const requireEnv = (
  name: 'EXPO_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY',
): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} .env içinde tanımlı olmalı.`);
  }
  return value;
};

const fetchAllProducts = async (
  client: ReturnType<typeof createClient>,
): Promise<ProductRow[]> => {
  const rows: ProductRow[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client
      .from('products')
      .select('id, title, brand, price, category, colors')
      .range(from, to);

    if (error) {
      throw new Error(`Ürünler okunamadı: ${error.message}`);
    }

    const page = (data ?? []).filter(isProductRow);
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return rows;
};

const toAttributeRow = (product: ProductRow): AttributeRow => {
  const price = parseNumeric(product.price) ?? 0;
  const inferred = inferProductAttributes({
    title: product.title,
    brand: product.brand,
    price,
    category: product.category,
    existingColorNames: colorNamesFromJsonb(product.colors),
  });

  return {
    product_id: product.id,
    gender: inferred.gender,
    colors: inferred.colors,
    fit: inferred.fit,
    subcategory: inferred.subcategory,
    brand_slug: inferred.brand_slug,
    price_band: inferred.price_band,
  };
};

const run = async (): Promise<void> => {
  const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const products = await fetchAllProducts(client);
  if (products.length === 0) {
    console.log('Katalog boş; product_attributes yazılmadı.');
    return;
  }

  const attributes = products.map(toAttributeRow);
  const { error } = await client.from('product_attributes').upsert(attributes, {
    onConflict: 'product_id',
  });

  if (error) {
    throw new Error(`product_attributes upsert başarısız: ${error.message}`);
  }

  const curatedHits = products.filter(
    (product) => CURATED_ATTRIBUTE_OVERRIDES[normalizeTitleKey(product.title)],
  ).length;
  const withColor = attributes.filter((row) => row.colors.length > 0).length;
  const gendered = attributes.filter((row) => row.gender !== 'unisex').length;

  const percent = (count: number): string =>
    `${Math.round((count / products.length) * 100)}%`;

  console.log(`${attributes.length} ürün product_attributes'e yazıldı (upsert).`);
  console.log(`curated override: ${curatedHits}/${products.length} (${percent(curatedHits)})`);
  console.log(`renk eşleşmesi: ${withColor}/${products.length} (${percent(withColor)})`);
  console.log(`cinsiyet (men/women): ${gendered}/${products.length} (${percent(gendered)})`);
  console.log('fit/subcategory/price_band: 100% (heuristic varsayılanlı)');
};

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
  console.error(`seed-attributes başarısız: ${message}`);
  process.exit(1);
});
