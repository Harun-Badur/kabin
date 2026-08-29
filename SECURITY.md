# Güvenlik

Kabin, ürün keşfi ve sanal deneme için kişisel fotoğraf ve pazaryeri bağlantıları işler. Bu repoya sır, token veya özel anahtar commit edilmez.

## Gizlilik

- Sanal deneme ekranı uygulamada durur; bu sürümde deneme fotoğrafı bir giydirme sağlayıcısına gönderilmez.
- Ürün kataloğu Supabase üzerinden anonim okunur. Yazma işlemleri yalnızca lokal scriptlerde `service_role` ile yapılır.

## Ortam değişkenleri

- `.env` ve `.env*.local` Git’e eklenmez (bkz. `.gitignore`).
- Şablon için `.env.example` kullan; gerçek değer koyma.
- `SUPABASE_SERVICE_ROLE_KEY` asla `EXPO_PUBLIC_` öneki almaz ve uygulama (Expo) kodunda import edilmez.
- Sızdırılmış bir anahtar görürsen ilgili serviste hemen rotate et (Supabase).
