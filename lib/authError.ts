const AUTH_MESSAGE_BY_NEEDLE: Array<{ needle: string; message: string }> = [
  {
    needle: 'invalid login credentials',
    message: 'E-posta veya şifre hatalı.',
  },
  {
    needle: 'email not confirmed',
    message: 'E-postanı doğrulaman gerekiyor.',
  },
  {
    needle: 'user already registered',
    message: 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.',
  },
  {
    needle: 'password should be at least',
    message: 'Şifre en az 6 karakter olmalı.',
  },
  {
    needle: 'unable to validate email',
    message: 'Geçerli bir e-posta adresi gir.',
  },
  {
    needle: 'email rate limit',
    message: 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
  },
];

export const toTurkishAuthMessage = (error: unknown): string => {
  const raw =
    error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu.';
  const lower = raw.toLowerCase();
  const match = AUTH_MESSAGE_BY_NEEDLE.find((item) =>
    lower.includes(item.needle),
  );
  return match?.message ?? 'İşlem tamamlanamadı. Lütfen tekrar dene.';
};
