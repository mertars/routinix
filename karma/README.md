# Karma — Halısaha Takım Kurucu

Arkadaş grubunun oyuncularını puanla, halısaha maçı için en dengeli iki takımı
saniyeler içinde kur. Mobil öncelikli, koyu temalı, çevrimdışı çalışan bir PWA.

> Bu klasör Routinix reposunun içinde **bağımsız** bir projedir: kendi
> `package.json`'ı vardır, Routinix'in hiçbir dosyasını kullanmaz veya değiştirmez.

## Özellikler

- **Oyuncular:** isim, takma ad, emoji veya fotoğraf avatar, ana + 2 alternatif
  mevki (KL, DEF, OS, KNT, FV), tercih ettiği ayak, bu hafta geliyor mu.
  18 alt özellik (+5 kalecilik), **hızlı** (6 ana özellik) ve **detaylı** giriş.
- **Kartlar:** puana göre bronz (<65), gümüş (65-74), altın (75-84), özel (85+).
  Profilde çevrilebilir kart, mevki bazlı puanlar ve öneri, radar grafiği, form.
- **Puanlama:** mevkiye göre ağırlıklı ortalama; ağırlıklar Ayarlar'dan düzenlenir.
- **Kadro kur:** gelenleri seç, 5v5-8v8, fazla oyuncu yedek/dönüşümlü, kaleci
  dönüşümlü, iki takıma ayrı diziliş, kurallar (aynı/ayrı takım, sabit mevki).
  3 alternatif, kaydırarak gezme, sürükle-bırak veya dokunarak takas, anlık denge
  skoru, WhatsApp metni ve PNG görsel.
- **Maçlar:** kadroyu maç olarak kaydet, skor ve maçın adamı gir; galibiyet
  oranı, G-B-M, son 5 maç formu.
- **Veri:** localStorage; JSON yedek al/yükle; tüm grubu tek linkle paylaş
  (veri sıkıştırılıp URL'in `#` kısmına konur, sunucuya gitmez).

## Geliştirme

```bash
cd karma
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest birim testleri
npm run typecheck
npm run build      # üretim derlemesi
npm run icons      # PWA ikonlarını ve iOS açılış görsellerini yeniden üret
npm run build:routinix  # Routinix içine gömülecek statik çıktıyı public/karma'ya yaz
```

Node 20.9+ gerekir.

## Routinix içinde yayın (/karma)

Karma, Routinix'in canlı Vercel projesi üzerinden `/karma` adresinde yayınlanır;
Routinix'in menüsündeki (çekmece) **Halısaha Karma** tuşu buraya açılır.

- Karma statik olarak (`output: "export"`, `basePath: "/karma"`) derlenir ve
  çıktısı reponun kökündeki `public/karma/` klasörüne kopyalanır. Routinix'in
  kendi build'i (Vite) `public/` klasörünü olduğu gibi yayına taşıdığı için
  Routinix'in derleme süreci değişmez.
- Sayfa adresleri Routinix'in `vercel.json` dosyasındaki `/karma/...`
  yönlendirmeleriyle karşılanır (Routinix'in "her şey index.html'e" kuralından
  önce gelir).
- Routinix'in Tailwind'i `karma/` ve `public/karma/` klasörlerini taramaz
  (`src/index.css` → `@source not`), böylece Routinix'in CSS'i değişmez.

**Karma'da değişiklik yaptıktan sonra:**

```bash
cd karma
npm run build:routinix   # public/karma'yı yeniden üretir
git add ../public/karma && git commit -m "Karma: Routinix içindeki derlemeyi güncelle"
```

Routinix içinde çalışırken Karma'nın sayfa başlığında Routinix'e dönüş
bağlantısı görünür. Veriler aynı alan adının localStorage'ında
(`karma:data` anahtarıyla) tutulur, Routinix'in verilerine karışmaz.

## Ayrı bir Vercel projesi olarak deploy (opsiyonel)

1. Vercel'de **Add New → Project** ile bu repoyu içe aktar.
2. **Root Directory** olarak `karma` seç (Framework: Next.js otomatik algılanır).
3. Deploy. Ortam değişkeni gerekmez.

Routinix projesi aynı repodan kendi ayarlarıyla deploy olmaya devam eder.

## Klasör yapısı

```
src/
  app/                     Next.js App Router sayfaları (oyuncular, kadro, maclar, ayarlar, paylas)
  components/
    builder/               kadro kurucu: kurulum, sonuç, saha, mini kart, paylaşım
    charts/                radar, form ve karşılaştırma grafikleri
    player/                oyuncu kartı, profil, düzenleyici
    screens/               sekme ekranları
    settings/              ağırlık editörü, link paylaşımı, yükleme kartı
    ui/                    buton, alt panel (sheet), kontroller, bildirim
  lib/
    types.ts               veri modeli
    constants.ts           mevkiler, etiketler, varsayılan ağırlıklar, dizilişler
    scoring.ts             puanlama (saf fonksiyonlar)
    balancer.ts            takım dengeleme (saf fonksiyonlar)
    lineup.ts              takas, WhatsApp metni, maç kaydı
    stats.ts               oyuncu istatistikleri
    storage.ts             depolama katmanı, doğrulama, JSON ve link paylaşımı
    store.ts               uygulama durumu (zustand)
    *.test.ts              Vitest testleri
```

## Puanlama

Ana özellik = alt özelliklerin yuvarlanmış ortalaması. Dış saha mevki puanı,
6 ana özelliğin mevki ağırlıklarıyla ağırlıklı ortalamasıdır:

| Mevki | HIZ | ŞUT | PAS | DRİ | DEF | FİZ |
|------|-----|-----|-----|-----|-----|-----|
| DEF  | 15  | 3   | 12  | 5   | 45  | 20  |
| OS   | 10  | 12  | 35  | 20  | 13  | 10  |
| KNT  | 30  | 15  | 15  | 30  | 3   | 7   |
| FV   | 20  | 40  | 8   | 20  | 2   | 10  |

KL = (Refleks 25, Uçuş 20, Pozisyon 20, Top tutma 20, Oyun kurma 15) ağırlıklı
ortalaması × %85 + PAS × %15. Kalecilik verisi olmayanların KL puanı, ilgili
dış saha özelliklerinden mütevazı bir tahmindir (en fazla 55).

## Dengeleme algoritması (`lib/balancer.ts`)

1. **Kaleciler:** en iyi iki kaleci farklı takımların KL slotuna sabitlenir
   (öncelik: "KL oynasın" kuralı → ana mevkisi KL → alternatifi KL → KL puanı).
   "Kaleci dönüşümlü" açıksa bu adım atlanır.
2. **Başlangıç:** kalan oyuncular yılan (snake) draft ile dağıtılır; takım içinde
   nadir mevkilerden başlayarak açgözlü yerleştirme yapılır.
3. **İyileştirme:** rastgele oyuncu takaslarıyla simulated annealing, ardından
   tüm ikili takasların denendiği yerel iyileştirme. 24 farklı başlangıçtan
   bağımsız arama yapılır, birbirinden farklı en iyi 3 kadro döndürülür.
4. **Amaç fonksiyonu:** `3 × toplam güç farkı + 0.8 × hat farkı + 0.5 × 6 özellik
   ortalaması farkı + mevki cezası + 500 × kural ihlali`. Oyuncunun puanı atandığı
   **slotun mevkisine** göre hesaplanır; mevki dışı oynatma puanı doğal olarak
   düşürür, ayrıca ceza da alır.

14 oyuncuda yaklaşık 50 ms sürer. Arama döngüsü bellek ayırmayan ayrı bir maliyet
fonksiyonu kullanır; testler bunun ayrıntılı değerlendirmeyle birebir aynı sonucu
verdiğini doğrular.

## Supabase'e geçiş

Uygulama verilere yalnızca `lib/storage.ts`'deki `KarmaStorage` arayüzü üzerinden
erişir:

```ts
interface KarmaStorage {
  kind: "local" | "memory" | "remote";
  load(): Promise<KarmaData | null>;
  save(data: KarmaData): Promise<void>;
  clear(): Promise<void>;
}
```

Geçiş için:

1. Supabase'de örneğin `groups (id uuid, owner uuid, data jsonb, updated_at)`
   tablosu ve RLS politikaları oluştur (ya da `players`, `matches` gibi ayrı
   tablolar).
2. Aynı arayüzü uygulayan bir `createSupabaseStorage(groupId)` yaz: `load` satırı
   okuyup `sanitizeData()`'dan geçirir, `save` `upsert` yapar.
3. `getStorage()` içinde localStorage yerine bu adaptörü döndür. Store ve
   bileşenlerde değişiklik gerekmez; kaydetme zaten 150 ms gecikmeli ve toplu.
4. Çok cihazlı canlı senkron istenirse adaptöre Supabase Realtime aboneliği
   eklenip `useKarma.setState` ile store güncellenebilir.

## PWA

`app/manifest.ts` manifesti üretir; `public/sw.js` sayfaları ağ-öncelikli,
`/_next/static` dosyalarını önbellek-öncelikli sunar, böylece uygulama çevrimdışı
da açılır. iOS açılış görselleri `lib/pwa.ts`'deki boyutlar için
`npm run icons` ile üretilir.
