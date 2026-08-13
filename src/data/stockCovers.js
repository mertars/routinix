// Şablon Kapak Fotoğraf Galerisi — 5 temalı, gerçek stok fotoğraf havuzu
// (bkz. GuidedTemplateForm.jsx "Kapak & Etiketler" adımı). presetCovers.js'teki
// SAF CSS mesh-gradient sistemiyle KARIŞTIRILMASIN — o hâlâ yaşıyor, yalnızca
// buradaki fotoğraflardan biri ağ hatasıyla yüklenemezse DÜŞÜLECEK yedek
// katman olarak (bkz. CoverPattern.jsx).
//
// KAYNAK NOTU (dürüstlük): Unsplash Source API (eskiden anahtar sız,
// kelime-bazlı stok foto ile en doğal seçenek) 2023'te KALICI OLARAK
// KAPANDI (source.unsplash.com artık 503 döner, bizzat bu oturumda
// doğrulandı). Yerine LoremFlickr kullanılıyor — anahtar GEREKTİRMEYEN,
// kelime etiketine göre GERÇEK (Flickr'ın kendi foto havuzundan) fotoğraf
// döndüren tek canlı/güvenilir servis. `?lock={n}` parametresi HER seferinde
// rastgele farklı bir foto DÖNMEMESİNİ, aynı kapak ID'sinin HER ZAMAN aynı
// fotoğrafı göstermesini garanti eder (deterministik — CoverPattern.jsx'in
// eski Picsum-seed yaklaşımıyla AYNI gerekçe). Bu, hand-picked/lisanslı bir
// kütüphane DEĞİL — kelimeyle EŞLEŞEN gerçek fotoğraflar, ama tek tek
// kürasyon edilmedi; bu sınırı açıkça belirtiyoruz.
const THEME_DEFS = [
  { key: "fitness", label: "Fitness", emoji: "💪", keyword: "fitness,gym", locks: [11, 12, 13, 14, 15, 16] },
  { key: "nutrition", label: "Yemek & Beslenme", emoji: "🥗", keyword: "food,nutrition", locks: [21, 22, 23, 24, 25, 26] },
  { key: "minimalist", label: "Minimalist", emoji: "◻️", keyword: "minimal", locks: [31, 32, 33, 34, 35, 36] },
  { key: "aesthetic", label: "Aesthetic", emoji: "🌸", keyword: "aesthetic,pastel", locks: [41, 42, 43, 44, 45, 46] },
  { key: "discipline", label: "Çalışma & Disiplin", emoji: "📚", keyword: "workspace,desk", locks: [51, 52, 53, 54, 55, 56] },
];

// Fotoğraf yüklenemezse (ağ hatası/engelleme) düşülecek, temaya özgü SAF CSS
// zemin — presetCovers.js'teki mesh() ile AYNI teknik (blur yok, tek seferlik
// ucuz paint), yalnızca bu yeni temaların kendi rengiyle.
const THEME_FALLBACK_BG = {
  fitness: "linear-gradient(160deg, #3a0d16 0%, #1a0508 100%)",
  nutrition: "linear-gradient(160deg, #2a2408 0%, #14100a 100%)",
  minimalist: "linear-gradient(160deg, #1c1c1f 0%, #0a0a0b 100%)",
  aesthetic: "linear-gradient(160deg, #2a1830 0%, #150a1a 100%)",
  discipline: "linear-gradient(160deg, #0d1f2a 0%, #060f14 100%)",
};

function buildTheme(theme) {
  return theme.locks.map((lock, i) => ({
    id: `stock-${theme.key}-${lock}`,
    label: `${theme.label} ${i + 1}`,
    theme: theme.key,
    themeLabel: theme.label,
    emoji: theme.emoji,
    url: `https://loremflickr.com/640/360/${encodeURIComponent(theme.keyword)}?lock=${lock}`,
    fallbackBg: THEME_FALLBACK_BG[theme.key],
  }));
}

// Grup halinde (yatay kaydırma şeridi başına bir tema) — bkz. GuidedTemplateForm.jsx
export const STOCK_COVER_GROUPS = THEME_DEFS.map((t) => ({ key: t.key, label: t.label, emoji: t.emoji, covers: buildTheme(t) }));

// Düz liste — id'den hızlı bakış için (bkz. CoverPattern.jsx).
export const STOCK_COVERS = STOCK_COVER_GROUPS.flatMap((g) => g.covers);

export function stockCoverById(id) {
  return STOCK_COVERS.find((c) => c.id === id) || null;
}

export function isStockCoverId(id) {
  return typeof id === "string" && id.startsWith("stock-");
}
