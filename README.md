# Kabin

**Kaydır, dene, keşfet.** Moda ürünlerini swipe ile gez, yapay zekâ ile sanal dene, beğendiğini pazaryerinde aç.

## Özellikler

- Tinder benzeri kart yığını: sağa beğen, sola geç
- Kategori rozetleri: üst giyim, alt giyim, elbise
- AI sanal deneme (CatVTON, Modal GPU)
- Trendyol ve Hepsiburada derin bağlantıları (kanonikal ürün URL)
- Supabase ürün feed’i; bağlantı yoksa yerel mock katalog
- Fiyat takibi (MVP: manuel/script) ve Expo push token kaydı

## Tech stack

| Katman | Teknoloji |
|--------|-----------|
| Uygulama | Expo 54, React Native 0.81, TypeScript |
| Jestür / animasyon | Gesture Handler, Reanimated |
| Durum | Zustand |
| Veri | PostgreSQL (Supabase), anon RLS okuma |
| VTON | Modal.com, CatVTON (A10G) |
| Katalog scriptleri | Node (`tsx`), Cheerio |

## Mimari

```
Expo (Kabin)  --feed-->  Supabase (products)
       |                      ^
       |                      |  lokal seed / import (service_role)
       +--try-on-->  Supabase Edge Function (vton-proxy)  --X-Kabin-Secret-->  Modal VTON API
       +--hesap sil--> Supabase Edge Function (delete-account)
       +--Satın Al--> Trendyol / Hepsiburada ürün sayfası
```

Uygulama yalnızca `EXPO_PUBLIC_*` değişkenlerini görür. `SUPABASE_SERVICE_ROLE_KEY` cihaza gömülmez.

Modal VTON endpoint'i internete açık olduğu için **istemci Modal'a doğrudan
gitmez**. `vton-proxy` Edge Function'ı Supabase JWT'sini doğrular, kullanıcı
başına kotayı (dakikada 3 / günde 20) tüketir ve Modal'a yalnızca
`X-Kabin-Secret` başlığıyla çağrı yapar. Modal tarafı `/health` dışındaki tüm
yollarda bu başlığı arar; eksik veya hatalıysa 401 döner.

## Kurulum

### Ön koşullar

- Node.js 20+
- npm
- Expo Go (cihaz) veya Android emülatör
- (İsteğe bağlı) Modal CLI — VTON deploy için
- (İsteğe bağlı) Supabase projesi — canlı feed için

### Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyala ve değerleri doldur:

| Değişken | Nerede | Açıklama |
|----------|--------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Uygulama | Supabase proje URL’si |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Uygulama | Anon / public key (RLS ile okuma) |
| `EXPO_PUBLIC_VTON_PROXY_URL` | Uygulama | `vton-proxy` Edge Function adresi |
| `EXPO_PUBLIC_AFFILIATE_TAGS_JSON` | Uygulama | Boş bırakılırsa URL’ye affiliate parametresi eklenmez |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnızca script | Feed import / seed. `EXPO_PUBLIC_` **olmaz** |
| `AFFILIATE_TAGS_JSON` | Script | Seed tarafı etiketleri |
| `KABIN_VTON_SECRET` | Edge Function + Modal | Proxy ↔ Modal paylaşılan sırrı. Uygulamaya **girmez** |
| `MODAL_VTON_URL` | Edge Function | Modal FastAPI tabanı (`...modal.run`) |

Şema sırası (SQL Editor):
1. `supabase/schema_products.sql`
2. `supabase/schema.sql`
3. `supabase/price_tracking.sql`
4. `supabase/rate_limits.sql`

### Edge Function deploy

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>

# Proxy ↔ Modal paylaşılan sırrı (Modal tarafındakiyle AYNI dize olmalı)
npx supabase secrets set KABIN_VTON_SECRET=<sir>
npx supabase secrets set MODAL_VTON_URL=https://<workspace>--kabin-vton-tryonservice-fastapi-app.modal.run

npx supabase functions deploy vton-proxy
npx supabase functions deploy delete-account
```

Modal tarafı:

```bash
modal secret create kabin-vton-secret KABIN_VTON_SECRET=<ayni-sir>
modal deploy modal/tryon_api.py
```

### Geliştirme sunucusu

```bash
npm install
npx expo start
```

Cache temizlemek için: `npx expo start -c`

### Fiyat düşüşü testi (MVP, scraping yok)

İlk katalog ürününün `current_price` değerini %10 düşürür, ilgili beğenilere `price_alerts` yazar. Push varsayılan **dry-run**:

```bash
npx ts-node scripts/simulate-price-drop.ts
```

Aynı komut proje içinde `tsx` ile de çalışır: `npx tsx scripts/simulate-price-drop.ts`

Gerçek Expo push göndermek için: `npx tsx scripts/simulate-price-drop.ts --send`

## Proje yapısı

```
kabin/
├── App.tsx                 # Swipe feed
├── app.json                # Expo adı: Kabin
├── components/
│   ├── SwipeCard.tsx
│   └── VirtualTryOnModal.tsx
├── data/                   # mock katalog + sample CSV
├── lib/                    # Supabase client, deep link
├── modal/                  # CatVTON FastAPI (Modal)
├── scripts/                # import, seed, görsel çıkarma
├── services/               # feed, VTON, satın al
├── store/                  # Zustand
├── supabase/               # SQL şema
└── types/
```

## Roadmap

- Kullanıcı dolabı ve beğeni geçmişi
- Öneri sıralaması (stil / beden)
- Affiliate etiketlerinin canlıya alınması
- Daha fazla pazaryeri
- Mağaza yayını (EAS / Play Store)

## Gizlilik ve hesap silme

Gizlilik politikası: <https://github.com/Harun-Badur/kabin-privacy>
(kaynak: [PRIVACY_POLICY.md](PRIVACY_POLICY.md))

Sanal deneme fotoğrafı yalnızca o deneme için işlenir ve saklanmaz; özellik ilk
kullanımda uygulama içinde açık rıza ister.

### Hesap silme

**Uygulama içinden:** Profil sekmesi → **Hesabımı Sil** → onay. Hesap,
beğeniler, geçilen ürünler, fiyat alarmları, bildirim tokenları ve kota
sayaçları cascade ile kalıcı olarak silinir.

**Web üzerinden (Google Play zorunluluğu):** Uygulamaya erişimi olmayan
kullanıcılar, hesap kaydıyla aynı adresten **destek@kabin.app** adresine
"Hesap silme talebi" konulu e-posta göndererek silme talep edebilir. Talepler
30 gün içinde işleme alınır. Adımların web erişimli tarifi gizlilik
politikasının [Hesap silme](https://github.com/Harun-Badur/kabin-privacy#4-hesap-silme)
bölümünde yayınlanır ve Play Console "Veri silme" alanına bu URL girilir.

## Güvenlik

Ayrıntı: [SECURITY.md](SECURITY.md). `.env` commit edilmez. Service role anahtarı uygulama paketinde yer almaz. Modal VTON endpoint'ine yalnızca `vton-proxy` Edge Function'ı üzerinden, kimliği doğrulanmış kullanıcı adına erişilir.
