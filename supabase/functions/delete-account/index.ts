// Kabin — hesap silme (Google Play zorunluluğu).
// JWT doğrulanır, ardından auth.users satırı silinir. public.users,
// liked_products, passed_products, push_tokens, price_alerts ve rate_limits
// cascade ile birlikte silinir.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('delete-account yapılandırması eksik');
    return jsonResponse({ detail: 'Servis yapılandırılmamış.' }, 500);
  }

  const token = getBearerToken(request);
  if (!token) {
    return jsonResponse({ detail: 'Giriş yapmalısın.' }, 401, {
      'WWW-Authenticate': 'Bearer',
    });
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

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('Hesap silinemedi', { message: deleteError.message });
    return jsonResponse(
      { detail: 'Hesap silinemedi. Lütfen tekrar dene.' },
      500,
    );
  }

  console.info('Hesap silindi');
  return jsonResponse({ deleted: true }, 200);
});
