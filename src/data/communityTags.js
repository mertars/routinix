// "Topluluk Şablon Hub'ı" — hazır, hiyerarşik etiket kataloğu. Şablonlar
// `templates.tags text[]` (serbest metin dizisi) olarak saklanır — bu
// katalog yalnızca filtre panelinde ÖNERİLEN/tıklanabilir etiketleri
// besler; kullanıcı GuidedTemplateForm'da bunların dışında custom bir
// etiket de yazıp ekleyebilir (aynı diziye eklenir, ayrı bir mekanizma yok).
export const TAG_GROUPS = [
  {
    key: "diet",
    label: "Diyet",
    tags: ["Sıkı Diyet", "Kilo Alma", "Kilo Verme", "Intermittent Fasting"],
  },
  {
    key: "software",
    label: "Yazılım",
    tags: ["Yazılım", "Backend", "Frontend", "Sistem Tasarımı", "DevOps"],
  },
  {
    key: "exam",
    label: "Sınav Hazırlık",
    tags: ["YKS/Sınav Hazırlık", "Dil Sınavı", "Akademik Yazım"],
  },
  {
    key: "lifestyle",
    label: "Yaşam Tarzı",
    tags: ["Minimalizm", "Erken Kalkma", "Dijital Detoks", "Uyku Düzeni"],
  },
  {
    key: "fitness",
    label: "Spor & Fitness",
    tags: ["Spor/Fitness", "Kuvvet Antrenmanı", "Kardiyo", "Esneklik/Mobility"],
  },
  {
    key: "travel",
    label: "Seyahat",
    tags: ["Bütçe Seyahat", "Rota Planlama", "Solo Gezi"],
  },
];

// Düz liste — arama/otomatik-tamamlama gibi tek boyutlu ihtiyaçlar için.
export const ALL_PRESET_TAGS = TAG_GROUPS.flatMap((g) => g.tags);

// Kullanıcının serbest yazdığı bir etiketi normalize eder (baş harf büyük,
// fazla boşluk temizlenir) — hem preset hem custom etiketler için templates.tags
// dizisine eklenmeden önce buradan geçer, tutarlı görünüm sağlar.
export function normalizeTag(raw) {
  const trimmed = (raw || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.charAt(0).toLocaleUpperCase("tr") + trimmed.slice(1);
}
