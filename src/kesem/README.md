# Kesem — Harcama Takibi (Parça 1/3)

Routinix içinde, hamburger menüden açılan tam ekran harcama takibi modülü.
`/kesem/...` adresiyle de doğrudan açılır (PWA yenileme/derin bağlantı).

## Yapı
- `config.js` — menü adı (`KESEM_DEFAULT_MENU_LABEL` + kullanıcı ayarı), yol sabitleri. Ana pakette, küçük.
- `KesemApp.jsx` — lazy yüklenen kabuk: telefonda cam alt çubuk, ≥768px'te cam yan çubuk + iki sütun.
- `kesem.css` — **tüm renkler** CSS değişkenleri (`.kesem-root` kapsamı; şema + 5 palet + `--kc-*` kategori renkleri).
- `data/idb.js` — kullanıcıya özel IndexedDB (`kesem-<userId>`), atomik yazma; yoksa bellek yedeği.
- `state/store.jsx` — bellek içi durum + **değişiklik kümeleri** (`{store,id,before,after}`) → geri al/yinele her veri türünde.
- `model/schema.js` — veri modeli ve sonraki parçalar için ayrılmış alanlar (taksit, tekrarlayan, borç, birikim, kur).
- `ui/AddSheet.jsx` — hızlı ekleme (tutar tuş takımı, kategori/ödeme çipleri, tarih-saat, mağaza önerisi, etiket, fiş).
- `pages/` — Ana Sayfa, Harcamalar (+detay), Analiz (boş durum), Daha Fazla (yönetim, görünüm, ayarlar).

## Sonraki parçalar için
- Yeni veri türü = `STORES` listesine + `COLLECTIONS`'a ekle; undo/redo otomatik çalışır.
- Supabase senkronu: `data/idb.js`'teki adaptör arayüzünü (`getAll/get/apply`) uygulayan yeni bir adaptör.
- Tüm kayıtlarda `updatedAt` / `deletedAt` (silme = yumuşak) senkron için hazır.

# Parça 2 — Para yönetimi

- **Hesaplar:** `model/finance.js` (saf fonksiyonlar) + `model/finance.test.js` → `npm run test:kesem` (node:test, esbuild ile paketlenir).
- **Veri (IndexedDB v2, yalnızca yeni depolar eklendi):** `installments`, `recurrings`, `people`, `debts`, `goals`, `wishes`, `shopping`; `meta` içinde `budget`, `rates`, `activity`. Şema notları `model/schema.js`.
- **Otomatik kayıt:** `store.materialize()` açılışta/öne gelince vadesi gelen taksit ve otomatik abonelikleri sabit kimlikli (`g-inst-…`, `g-rec-…`) gerçek işleme çevirir — çift kayıt olmaz, silinen yeniden doğmaz.
- **₺ karşılığı:** işlemlerde `baseMinor`; eski kayıtlarda yoksa `amountMinor` kullanılır (`baseOf`).
- **Bölüşme:** işlemin `amountMinor`'u BENİM payım; diğer paylar `debts` kaydı olur (`txId` ile bağlı, işlem silinince birlikte silinir/geri gelir).
- **Tasarım dili:** `kesem.css` sonundaki "PARÇA 2" bölümü — cam yüzey jetonları, kart hiyerarşisi (`.k-card.hero|accent|calm`), bento (`.k-bento`, `.b-1x1…`, container query ile tablette 6 sütun), kontrast katmanı (`--k-accent-ink`, `--k-btn-fill`).
