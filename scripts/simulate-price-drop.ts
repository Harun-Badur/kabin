/**
 * Katalogdaki TÜM ürünlerin current_price değerini %10 düşürür.
 *
 *   npx tsx scripts/simulate-price-drop.ts
 *   npx tsx scripts/simulate-price-drop.ts --send
 */
import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

loadEnv();

const PRICE_DROP_RATIO = 0.9;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface CatalogProductRow {
  id: string;
  title: string;
  price: number | string;
  current_price: number | string | null;
}

interface LikedAlertRow {
  user_id: string;
  product_id: string;
  notify_on_price_drop: boolean | null;
}

interface PushTokenRow {
  user_id: string;
  expo_push_token: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: {
    productId: string;
    type: 'price_drop';
  };
}

interface DroppedProduct {
  id: string;
  title: string;
  previousPrice: number;
  newPrice: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const isCatalogProductRow = (value: unknown): value is CatalogProductRow => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    (typeof value.price === 'number' || typeof value.price === 'string')
  );
};

const isLikedAlertRow = (value: unknown): value is LikedAlertRow => {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.user_id === 'string' && typeof value.product_id === 'string';
};

const isPushTokenRow = (value: unknown): value is PushTokenRow => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.user_id === 'string' && typeof value.expo_push_token === 'string'
  );
};

const sendExpoPush = async (
  messages: ExpoPushMessage[],
  dryRun: boolean,
): Promise<void> => {
  if (messages.length === 0) {
    console.log('Gönderilecek push yok.');
    return;
  }

  if (dryRun) {
    console.log(`dryRun=true — ${messages.length} push gönderilmedi.`);
    return;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Expo push HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  console.log('Expo push yanıtı', body.slice(0, 500));
};

const fetchAllProducts = async (
  supabase: SupabaseClient,
): Promise<CatalogProductRow[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('id, title, price, current_price')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Ürünler okunamadı: ${error.message}`);
  }

  return (data ?? []).filter(isCatalogProductRow);
};

const simulatePriceDrop = async (): Promise<void> => {
  const dryRun = !process.argv.includes('--send');
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.',
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const columnProbe = await supabase
    .from('products')
    .select('current_price')
    .limit(1);
  if (columnProbe.error?.message.toLowerCase().includes('current_price')) {
    throw new Error(
      "current_price kolonu yok. supabase/price_tracking.sql dosyasını SQL Editor'da çalıştır.",
    );
  }

  const products = await fetchAllProducts(supabase);
  if (products.length === 0) {
    throw new Error('Katalog boş; önce products tablosuna ürün ekle.');
  }

  const dropped: DroppedProduct[] = [];
  const checkedAt = new Date().toISOString();

  for (const product of products) {
    const previousPrice =
      parseNumeric(product.current_price) ?? parseNumeric(product.price) ?? 0;
    if (previousPrice <= 0) {
      console.log(`Atlandı (geçersiz fiyat): ${product.title}`);
      continue;
    }

    const newPrice = roundMoney(previousPrice * PRICE_DROP_RATIO);
    const { error: updateError } = await supabase
      .from('products')
      .update({
        previous_price: previousPrice,
        current_price: newPrice,
        last_price_checked_at: checkedAt,
      })
      .eq('id', product.id);

    if (updateError) {
      throw new Error(
        `Fiyat güncellenemedi (${product.title}): ${updateError.message}`,
      );
    }

    dropped.push({
      id: product.id,
      title: product.title,
      previousPrice,
      newPrice,
    });
    console.log(
      `${product.title}: ${previousPrice.toFixed(2)} → ${newPrice.toFixed(2)} ₺`,
    );
  }

  if (dropped.length === 0) {
    throw new Error('Güncellenecek geçerli fiyatlı ürün yok.');
  }

  const droppedById = new Map(dropped.map((item) => [item.id, item]));
  const droppedIds = dropped.map((item) => item.id);

  const { data: likesData, error: likesError } = await supabase
    .from('liked_products')
    .select('user_id, product_id, notify_on_price_drop')
    .eq('notify_on_price_drop', true)
    .in('product_id', droppedIds);

  if (likesError) {
    throw new Error(`Beğeniler okunamadı: ${likesError.message}`);
  }

  const likes = (likesData ?? [])
    .filter(isLikedAlertRow)
    .filter((row) => droppedById.has(row.product_id));

  if (likes.length > 0) {
    const alertRows = likes.flatMap((like) => {
      const droppedProduct = droppedById.get(like.product_id);
      if (!droppedProduct) {
        return [];
      }
      return [
        {
          user_id: like.user_id,
          product_id: like.product_id,
          old_price: droppedProduct.previousPrice,
          new_price: droppedProduct.newPrice,
          sent_at: dryRun ? null : new Date().toISOString(),
        },
      ];
    });

    const { error: alertError } = await supabase
      .from('price_alerts')
      .insert(alertRows);

    if (alertError) {
      throw new Error(`price_alerts yazılamadı: ${alertError.message}`);
    }
  }

  const uniqueUserIds = [...new Set(likes.map((like) => like.user_id))];
  console.log(`Güncellenen ürün: ${dropped.length}`);
  console.log(`price_alerts: ${likes.length} satır / ${uniqueUserIds.length} kullanıcı`);

  if (uniqueUserIds.length === 0) {
    return;
  }

  const { data: tokenData, error: tokenError } = await supabase
    .from('push_tokens')
    .select('user_id, expo_push_token')
    .in('user_id', uniqueUserIds);

  if (tokenError) {
    throw new Error(`push_tokens okunamadı: ${tokenError.message}`);
  }

  const tokens = (tokenData ?? []).filter(isPushTokenRow);
  const messages: ExpoPushMessage[] = [];
  for (const token of tokens) {
    const userLikes = likes.filter((like) => like.user_id === token.user_id);
    for (const like of userLikes) {
      const droppedProduct = droppedById.get(like.product_id);
      if (!droppedProduct) {
        continue;
      }
      messages.push({
        to: token.expo_push_token,
        title: 'Fiyat düştü',
        body: `${droppedProduct.title} artık ${droppedProduct.newPrice.toFixed(2)} ₺`,
        data: { productId: droppedProduct.id, type: 'price_drop' },
      });
    }
  }

  await sendExpoPush(messages, dryRun);
};

simulatePriceDrop().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
  console.info(`Fiyat simülasyonu başarısız: ${message}`);
  process.exit(1);
});
