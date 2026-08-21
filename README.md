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

EAS bulut derlemesi `.env` dosyasını görmez; `EXPO_PUBLIC_*` değerleri
`eas.json` profillerinin `env` bloğunda olmalı (anon key istemciye zaten
gömülür). `SUPABASE_SERVICE_ROLE_KEY` ve `KABIN_VTON_SECRET` buraya **asla**
yazılmaz.

### Auth (e-posta)

Supabase Dashboard → **Authentication → Providers → Email**:
**Confirm email** kapalı olmalı. Açık kalırsa kayıt session dönmez, giriş
`email not confirmed` ile düşer ve APK'da "İşlem tamamlanamadı" gibi genel
bir mesaj görünebilir. Geliştirme / dahili test için e-posta doğrulamasını
kapat; yayında açacaksan kullanıcıya doğrulama bağlantısını açıkça söyle.

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

## Build & Release

Uygulama kimliği: Android `com.kabin.app`, iOS `app.kabin.mobile`. Sürüm
`app.json` içinde tutulur (`version` + `android.versionCode`); `eas.json`
`appVersionSource: "local"` kullandığı için sürüm numaralarının tek kaynağı
`app.json`'dır.

### Tek seferlik kurulum

```bash
npm install -g eas-cli
eas login              # expo.dev hesabı
eas init               # extra.eas.projectId değerini app.json'a yazar
```

### Build profilleri

| Profil | Çıktı | Kullanım |
|--------|-------|----------|
| `development` | APK + dev client | Cihazda native modül debug |
| `preview` | APK | Dahili test, cihaza doğrudan kurulum |
| `production` | AAB | Play Store yüklemesi (`autoIncrement`) |

```bash
# Dahili test için kurulabilir APK
eas build --platform android --profile preview

# Play Store için AAB (versionCode otomatik artar)
eas build --platform android --profile production

# Play Console'a yükle (internal track, draft)
eas submit --platform android --profile production
```

Yerel manifest doğrulaması (bulut kredisi harcamaz):

```bash
npx expo config --type public
npx expo prebuild --platform android --no-install   # android/ üretir, gitignore'da
```

`prebuild` çalıştırdıktan sonra `android/` klasörünü sil ve `package.json`
içindeki `android`/`ios` script'lerinin `expo start --android` olarak kaldığını
doğrula; prebuild bunları `expo run:*` olarak değiştiriyor ve proje CNG
(managed) akışında kalmalı.

### İzinler

Manifeste yalnızca `INTERNET`, `POST_NOTIFICATIONS` ve galeri okuma izinleri
girer. `expo-image-picker` varsayılan olarak `CAMERA` ve `RECORD_AUDIO` da
ekliyor; ikisi de `android.blockedPermissions` ile kaldırılıyor çünkü uygulama
kamera ya da mikrofon kullanmıyor. Bu listeyi genişletmeden önce Play Console
"Veri güvenliği" formunun da güncellenmesi gerekir.

### Marka varlıkları

`assets/` altındaki simge ve splash görselleri Kabin lacivertiyle (`#0F172A`)
üretilmiş **placeholder**'lardır. Yayın öncesi tasarımcı çıktısıyla
değiştirilmeli; boyutlar korunmalı (`icon.png` 1024×1024,
`android-icon-foreground.png` 1024×1024 saydam, `notification-icon.png` 96×96
beyaz silüet + saydam).

## Proje yapısı

Navigasyon `expo-router` ile dosya tabanlıdır; giriş noktası `index.ts`
polyfill'leri yükleyip `expo-router/entry`'ye devreder.

```
kabin/
├── index.ts                # polyfill'ler + expo-router/entry
├── app.json                # Expo adı: Kabin
├── app/                    # router: dosya = route
│   ├── _layout.tsx         # kök Stack + auth gate (Stack.Protected)
│   ├── auth.tsx            # oturum yoksa buraya düşer
│   └── (tabs)/
│       ├── _layout.tsx     # Keşfet / Beğenilenler / Profil
│       ├── index.tsx       # Keşfet (swipe feed)
│       ├── liked.tsx       # Beğenilenler
│       └── profile.tsx     # Profil + hesap silme
├── components/
│   ├── SwipeCard.tsx
│   └── VirtualTryOnModal.tsx
├── data/                   # mock katalog + sample CSV
├── hooks/                  # useAuth + AuthProvider
├── lib/                    # Supabase client, deep link, rıza, gizlilik
├── modal/                  # CatVTON FastAPI (Modal)
├── scripts/                # import, seed, görsel çıkarma
├── services/               # feed, VTON, hesap, satın al
├── store/                  # Zustand
├── supabase/               # SQL şema + Edge Functions
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
