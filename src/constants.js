// Uygulama genelinde paylaşılan sabitler + saf yardımcılar. Yeni pipeline
// (aiPipelineService) kategori/persona odaklı olduğu için burada 4 kategori
// tanımlanır; her birinin görsel kimliği (renk/emoji) ve hedef girişi için
// yer tutucu metni vardır.

export const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const CATEGORIES = {
  software: {
    key: "software",
    label: "Yazılım & Mühendislik",
    emoji: "🧑‍💻",
    tagline: "Kod, mimari, sistem tasarımı — Principal Architect eşliğinde",
    accent: "#6E7BFF",
    accentSoft: "rgba(110,123,255,0.14)",
    placeholder: "6 ayda sıfırdan ileri seviye C# ve .NET öğrenmek...",
  },
  fitness: {
    key: "fitness",
    label: "Fitness & Antrenman",
    emoji: "💪",
    tagline: "Progressive overload, split/PPL, RPE — CSCS antrenör eşliğinde",
    accent: "#F4406B",
    accentSoft: "rgba(244,64,107,0.14)",
    placeholder: "3 ayda kas kütlesi kazanmak ve güç artırmak...",
  },
  vacation: {
    key: "vacation",
    label: "Seyahat & Tatil",
    emoji: "🌴",
    tagline: "Rota, harita, bütçe — profesyonel seyahat rehberi eşliğinde",
    accent: "#2ED9A3",
    accentSoft: "rgba(46,217,163,0.14)",
    placeholder: "6 gün Roma'da tarih ve gastronomi turu...",
  },
  general: {
    key: "general",
    label: "Öğrenme & Diğer",
    emoji: "🎓",
    tagline: "Dil, finans, müzik, sanat... — Meta-Learning uzmanı eşliğinde",
    // Mor/neon indigo — tatil (emerald) ve yazılım (mavi-indigo) tonlarından net ayrışır.
    accent: "#B26BFF",
    accentSoft: "rgba(178,107,255,0.15)",
    placeholder: "1 yılda İspanyolca'yı akıcı (B2) konuşabilmek...",
  },
};

export const CATEGORY_KEYS = ["software", "fitness", "vacation", "general"];

export function categoryOf(key) {
  return CATEGORIES[key] || CATEGORIES.general;
}

export const STAGE_INTRO = "intro";
export const STAGE_WIZARD = "wizard";
export const STAGE_LOADING = "loading";
export const STAGE_ERROR = "error";
export const STAGE_PLAN = "plan";

export const MIN_GOAL_LENGTH = 5;

// Dinamik soru üretimi başarısız olursa kullanılan güvenli, genel yedek anket.
export const FALLBACK_QUESTIONS = [
  {
    title: "Bu alandaki mevcut seviyen nedir?",
    type: "choice",
    options: ["Yeni başlıyorum", "Biraz deneyimim var", "Orta seviye", "İleri seviye"],
  },
  {
    title: "Haftada ne kadar zaman ayırabilirsin?",
    type: "choice",
    options: ["5 saatten az", "5-10 saat", "10-20 saat", "20 saatten fazla"],
  },
  {
    title: "Özel bir kısıtlaman, tercihin ya da eklemek istediğin bir şey var mı?",
    type: "text",
    options: [],
  },
];

export const LOADING_MESSAGES = [
  "Hedefin analiz ediliyor...",
  "Uzman şapkası giyiliyor...",
  "Rutinler ve ilk hafta hazırlanıyor...",
  "Planın oluşturuluyor...",
];

// Basit, istemci-taraflı bir "anlamsız metin" sezgiseli — gerçek bir NLP/AI
// çağrısı değil; klavye üzerinde rastgele gezinme ya da aşırı tekrar gibi
// belirgin durumları yakalar.
export function isLikelyGibberish(text) {
  const clean = (text || "").trim().toLowerCase().replace(/[^a-zçğıöşü]/g, "");
  if (clean.length < MIN_GOAL_LENGTH) return false;
  const KEYBOARD_PATTERNS = ["qwert", "asdf", "zxcv", "yuiop", "hjkl", "asdasd", "qweqwe", "sdfsdf", "lkjlkj", "poiuy"];
  if (KEYBOARD_PATTERNS.some((p) => clean.includes(p))) return true;
  const vowels = (clean.match(/[aeıioöuü]/g) || []).length;
  if (vowels / clean.length < 0.15) return true;
  if (new Set(clean).size <= 3 && clean.length >= 6) return true;
  return false;
}
