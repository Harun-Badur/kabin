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
       +--try-on-->  Modal VTON API  (person image + garment URL)
       +--Satın Al--> Trendyol / Hepsiburada ürün sayfası
```

Uygulama yalnızca `EXPO_PUBLIC_*` değişkenlerini görür. `SUPABASE_SERVICE_ROLE_KEY` cihaza gömülmez.

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
| `EXPO_PUBLIC_MODAL_VTON_URL` | Uygulama | Modal FastAPI tabanı (`...modal.run`) |
| `EXPO_PUBLIC_AFFILIATE_TAGS_JSON` | Uygulama | Boş bırakılırsa URL’ye affiliate parametresi eklenmez |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnızca script | Feed import / seed. `EXPO_PUBLIC_` **olmaz** |
| `AFFILIATE_TAGS_JSON` | Script | Seed tarafı etiketleri |

Şema sırası (SQL Editor):
1. `supabase/schema_products.sql`
2. `supabase/schema.sql`
3. `supabase/price_tracking.sql`

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

## Güvenlik

Ayrıntı: [SECURITY.md](SECURITY.md). `.env` commit edilmez. Service role anahtarı uygulama paketinde yer almaz.
