# Kabin — Gizlilik Politikası

**Son güncelleme:** 25 Ağustos 2026
**Uygulama:** Kabin / VITRIVIA (Android)
**İletişim:** destek@kabin.app

Kabin; moda ürünlerini keşfetmenizi, yapay zekâ ile sanal olarak denemenizi ve
beğendiklerinizi takip etmenizi sağlar. Bu politika hangi verileri topladığımızı,
neden topladığımızı ve nasıl silebileceğinizi açıklar.

VITRIVIA, uygulama içindeki etkileşimleri kişiselleştirilmiş öneriler sunmak amacıyla saklar.

---

## 1. Topladığımız veriler

| Veri | Neden | Nerede saklanır | Saklama süresi |
|------|-------|-----------------|----------------|
| E-posta adresi | Hesap oluşturma ve giriş | Supabase (AB/ABD bölgesi) | Hesap silinene kadar |
| Beğenilen / geçilen ürünler | Dolabınızı oluşturmak, aynı ürünü tekrar göstermemek | Supabase | Hesap silinene kadar |
| Uygulama içi etkileşimler (beğeni, geçme, görüntüleme, arama, filtre, sanal deneme, mağaza tıklaması) | Kişiselleştirilmiş öneriler sunmak | Supabase | Hesap silinene kadar |
| Stil stüdyosu tercihleri (beden, stil etiketleri) | Önerileri ve sanal denemeyi kişiselleştirmek | Supabase | Hesap silinene kadar |
| Fiyat alarmı tercihleri | Fiyat düşünce bildirim göndermek | Supabase | Hesap silinene kadar |
| Bildirim (push) tokenı | Fiyat düşüşü bildirimi göndermek | Supabase | Hesap silinene kadar |
| Sanal deneme fotoğrafı | Yalnızca giydirme işlemini yapmak | **Saklanmaz** — bkz. bölüm 2 | 0 (işlem sonunda yok edilir) |
| Sanal deneme kotası (sayaç) | Kötüye kullanımı engellemek | Supabase | Hesap silinene kadar |

Reklam kimliği toplamıyoruz. Konum, rehber, arama geçmişi veya cihaz kimliği
toplamıyoruz. Üçüncü taraf analitik veya reklam SDK'sı kullanmıyoruz.

---

## 2. Sanal deneme fotoğrafınız

Sanal deneme özelliğini kullandığınızda:

1. Galerinizden seçtiğiniz fotoğraf cihazınızda tutulur.
2. Bu sürümde fotoğraf bir giydirme sağlayıcısına gönderilmez.
3. Sonuç görseli üretildiğinde yalnızca cihazınızda gösterilir; **kalıcı sunucu
   deposuna yazılmaz**.
4. Fotoğrafınız model eğitimi, reklam veya profilleme için **kullanılmaz**.

Bu işlem için uygulama içinde ilk kullanımda **açık rızanız** alınır. Rıza
vermezseniz sanal deneme özelliği çalışmaz; uygulamanın diğer bölümlerini
kullanmaya devam edebilirsiniz.

**İşleme dayanağı (KVKK / GDPR):** açık rıza (KVKK m.5/1, GDPR Art. 6(1)(a)).

---

## 3. Verileri kimlerle paylaşıyoruz

| Alt işleyici | Amaç | Aktarılan veri |
|--------------|------|----------------|
| Supabase Inc. | Veritabanı, kimlik doğrulama | E-posta, beğeniler, bildirim tokenı |
| Expo (Push Notification Service) | Bildirim iletimi | Bildirim tokenı |

Verilerinizi satmıyoruz ve reklam amaçlı paylaşmıyoruz.

Pazaryeri bağlantılarına (Trendyol, Hepsiburada, Amazon) tıkladığınızda ilgili
sitenin kendi gizlilik politikası geçerli olur; Kabin bu sitelere kişisel
verinizi göndermez.

---

## 4. Hesap silme

Hesabınızı ve tüm verilerinizi iki yolla silebilirsiniz.

### Uygulama içinden

1. Kabin uygulamasını açın ve giriş yapın.
2. Alt menüden **Profil** sekmesine gidin.
3. **Hesabımı Sil** düğmesine dokunun.
4. Onay penceresinde **Kalıcı olarak sil** seçeneğini onaylayın.

Hesabınız, beğenileriniz, geçtiğiniz ürünler, fiyat alarmları, bildirim
tokenları, kota sayaçlarınız, uygulama içi etkileşim kayıtlarınız, stil
profiliniz ve kayıtlı model fotoğrafınız anında ve kalıcı olarak silinir. Bu
işlem geri alınamaz.

### Web üzerinden / e-posta ile

Uygulamayı kaldırdıysanız veya uygulamaya erişemiyorsanız hesap kaydınızla
aynı adresten **destek@kabin.app** adresine "Hesap silme talebi" konulu bir
e-posta gönderin. Talebi **30 gün içinde** işleme alır ve silme
tamamlandığında sizi bilgilendiririz. Kimlik doğrulaması için yalnızca hesap
e-postanızdan gönderim yeterlidir; ek belge istemeyiz.

---

## 5. Haklarınız

KVKK ve GDPR kapsamında; verilerinize erişme, düzeltme, silme, işlemeyi
kısıtlama ve verilerinizi taşınabilir biçimde alma hakkına sahipsiniz. Bu
haklarınızı kullanmak için **destek@kabin.app** adresine yazabilirsiniz.

---

## 6. Çocukların gizliliği

Kabin 13 yaşın altındaki kullanıcılara yönelik değildir ve bu yaş grubundan
bilerek veri toplamayız.

---

## 7. Güvenlik

- Tüm ağ trafiği HTTPS üzerinden şifrelenir.
- Veritabanı satır düzeyi güvenlik (RLS) ile korunur; her kullanıcı yalnızca
  kendi kayıtlarına erişebilir.
- Sanal deneme servisine yalnızca kimliği doğrulanmış kullanıcılar adına,
  sunucu tarafı bir aracı üzerinden erişilir.

---

## 8. Politika değişiklikleri

Bu politikayı güncellediğimizde "Son güncelleme" tarihini değiştirir ve önemli
değişiklikleri uygulama içinde duyururuz.

---
---

# Kabin — Privacy Policy (English summary)

**Last updated:** 25 August 2026 · **Contact:** destek@kabin.app

**What we collect.** Your email address (for the account), the products you
like or skip, your price-alert preferences, your push notification token, and
in-app interactions used to personalize recommendations. VITRIVIA stores
in-app interactions in order to provide personalized recommendations. All of
this is stored in Supabase and kept until you delete your account. We do
not collect advertising identifiers, location, or contacts, and we use no
third-party analytics or ad SDKs.

**Your try-on photo.** The virtual try-on screen is still in the app. In this
version the photo is **not sent** to a GPU inference provider. When a result
exists it is shown only on your device and is **not stored** on our servers. We
still ask for your **explicit consent** before try-on; if you decline, the
feature is disabled and the rest of the app keeps working.

**Sub-processors.** Supabase (database and authentication), Expo Push
Notification Service (notification delivery). We do not sell your data.

**Deleting your account.** In the app: open **Profile → Delete My Account** and
confirm. Your account, interactions, style profile, saved model photo, and all
associated data are deleted permanently and immediately. If you no longer have
the app installed, email **destek@kabin.app** from your account address with
the subject "Account deletion request"; we process such requests within **30
days**.

**Your rights.** Under GDPR and Turkish KVKK you may access, correct, delete,
restrict, or export your data. Contact **destek@kabin.app**.

**Children.** Kabin is not directed at children under 13.
