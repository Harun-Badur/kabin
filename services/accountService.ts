import { logger } from '../lib/logger';
import { getRequiredSupabaseClient } from '../lib/supabase';

interface DeleteAccountResponse {
  detail?: unknown;
}

const getDeleteAccountUrl = (): string => {
  const proxyUrl = process.env.EXPO_PUBLIC_VTON_PROXY_URL?.trim().replace(
    /\/+$/,
    '',
  );

  if (proxyUrl) {
    return proxyUrl.replace(/\/vton-proxy$/, '/delete-account');
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(
    /\/+$/,
    '',
  );
  if (!supabaseUrl) {
    throw new Error('Hesap silme adresi çözümlenemedi.');
  }

  return `${supabaseUrl}/functions/v1/delete-account`;
};

const readDetail = (body: string): string | null => {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
      const detail = (parsed as DeleteAccountResponse).detail;
      if (typeof detail === 'string' && detail.length > 0) {
        return detail;
      }
    }
  } catch (error) {
    logger.warn('Hesap silme yanıtı çözümlenemedi', { error });
  }
  return null;
};

export const deleteAccount = async (): Promise<void> => {
  const client = getRequiredSupabaseClient();
  const { data, error } = await client.auth.getSession();

  if (error) {
    logger.error('Oturum okunamadı', { detail: error.message });
    throw new Error('Oturum doğrulanamadı. Çıkıp tekrar giriş yapmayı dene.');
  }

  const accessToken = data.session?.access_token?.trim();
  if (!accessToken) {
    throw new Error('Hesabı silmek için giriş yapmalısın.');
  }

  const response = await fetch(getDeleteAccountUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const detail = readDetail(body);
    logger.error('Hesap silinemedi', { status: response.status, detail });
    throw new Error(detail ?? 'Hesap silinemedi. Lütfen tekrar dene.');
  }
};
