// Kabin — Modal VTON proxy.
// İstemci artık Modal'a doğrudan gitmez: JWT burada doğrulanır, kota burada
// tüketilir ve Modal'a yalnızca X-Kabin-Secret ile çağrı yapılır.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MINUTE_LIMIT = 3;
const DAY_LIMIT = 20;
const MODAL_TIMEOUT_MS = 150_000;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TryOnPayload {
  person_image_base64: string;
  garment_image_url: string;
  cloth_type: string;
  category?: string;
  garment_description?: string;
}

interface QuotaResult {
  allowed: boolean;
  reason?: string;
  retry_after_seconds?: number;
}

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      ...extraHeaders,
      'Content-Type': 'application/json',
    },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isQuotaResult = (value: unknown): value is QuotaResult =>
  isRecord(value) && typeof value.allowed === 'boolean';

const readTryOnPayload = (value: unknown): TryOnPayload | null => {
  if (!isRecord(value)) {
    return null;
  }
  const personImage = value.person_image_base64;
  const garmentUrl = value.garment_image_url;
  const clothType = value.cloth_type;

  if (
    typeof personImage !== 'string' ||
    personImage.trim().length === 0 ||
    typeof garmentUrl !== 'string' ||
    garmentUrl.trim().length === 0 ||
    typeof clothType !== 'string'
  ) {
    return null;
  }

  return {
    person_image_base64: personImage,
    garment_image_url: garmentUrl,
    cloth_type: clothType,
    category: typeof value.category === 'string' ? value.category : undefined,
    garment_description:
      typeof value.garment_description === 'string'
        ? value.garment_description
        : undefined,
  };
};

const getBearerToken = (request: Request): string | null => {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ detail: 'Yalnızca POST destekleniyor.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const modalBaseUrl = Deno.env
    .get('MODAL_VTON_URL')
    ?.trim()
    .replace(/\/+$/, '');
  const modalSecret = Deno.env.get('KABIN_VTON_SECRET')?.trim();

  if (!supabaseUrl || !serviceRoleKey || !modalBaseUrl || !modalSecret) {
    console.error('vton-proxy yapılandırması eksik', {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hasModalUrl: Boolean(modalBaseUrl),
      hasModalSecret: Boolean(modalSecret),
    });
    return jsonResponse(
      { detail: 'Sanal deneme servisi yapılandırılmamış.' },
      500,
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    return jsonResponse(
      { detail: 'Sanal deneme için giriş yapmalısın.' },
      401,
      { 'WWW-Authenticate': 'Bearer' },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return jsonResponse(
      { detail: 'Oturumun geçersiz veya süresi dolmuş. Tekrar giriş yap.' },
      401,
      { 'WWW-Authenticate': 'Bearer' },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    console.error('vton-proxy gövdesi okunamadı', { error });
    return jsonResponse({ detail: 'İstek gövdesi geçersiz JSON.' }, 400);
  }

  const payload = readTryOnPayload(rawBody);
  if (!payload) {
    return jsonResponse(
      {
        detail:
          'person_image_base64, garment_image_url ve cloth_type alanları zorunlu.',
      },
      400,
    );
  }

  const { data: quotaData, error: quotaError } = await admin.rpc(
    'consume_vton_quota',
    {
      p_user_id: user.id,
      p_minute_limit: MINUTE_LIMIT,
      p_day_limit: DAY_LIMIT,
    },
  );

  if (quotaError || !isQuotaResult(quotaData)) {
    console.error('Kota kontrolü başarısız', { message: quotaError?.message });
    return jsonResponse(
      { detail: 'Kota kontrolü yapılamadı. Biraz sonra tekrar dene.' },
      503,
    );
  }

  if (!quotaData.allowed) {
    const retryAfter = quotaData.retry_after_seconds ?? 60;
    const detail =
      quotaData.reason === 'daily_limit'
        ? `Günlük sanal deneme limitine ulaştın (${DAY_LIMIT}). Yarın tekrar dene.`
        : `Çok hızlı deniyorsun. ${retryAfter} saniye sonra tekrar dene.`;
    return jsonResponse({ detail }, 429, {
      'Retry-After': String(retryAfter),
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, MODAL_TIMEOUT_MS);

  try {
    const modalResponse = await fetch(`${modalBaseUrl}/tryon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kabin-Secret': modalSecret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = await modalResponse.text();
    return new Response(body, {
      status: modalResponse.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type':
          modalResponse.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return jsonResponse(
        {
          detail:
            'Sanal deneme zaman aşımına uğradı. İlk denemede GPU soğuk başlıyor; tekrar dene.',
        },
        504,
      );
    }
    console.error('Modal çağrısı başarısız', { error });
    return jsonResponse(
      { detail: 'Sanal deneme servisine ulaşılamadı. Tekrar dene.' },
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
});
