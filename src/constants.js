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

// AI Plan Oluşturucu + AI Koç — anonim (misafir) oturumlar için kilitli.
// usePlanStudio.js (plan üretimi) ve AiCoachWidget.jsx (koç sohbeti) AYNI
// mesajı paylaşır — AuthModal'da context mesajı olarak gösterilir.
export const AI_GATE_MESSAGE = "🤖 AI Koç ve Yapay Zeka ile Plan Oluşturma özelliğini kullanabilmek için ücretsiz hesabını tamamla.";

export const STAGE_INTRO = "intro";
export const STAGE_WIZARD = "wizard";
export const STAGE_LOADING = "loading";
export const STAGE_ERROR = "error";
export const STAGE_PLAN = "plan";

export const MIN_GOAL_LENGTH = 5;

// Ücretsiz hesap başına maksimum aktif plan sayısı — GERÇEK sınır sunucu
// tarafında bir DB trigger'ı (bkz. supabase/plan_limit.sql, hangi client
// yolundan gelirse gelsin: wizard İLE de Nexus şablon klonlama İLE de
// aşılamaz). Buradaki sabit yalnızca UX içindir — kullanıcı 11. planı
// denemeden ÖNCE şık bir modalla durdurulsun diye.
export const MAX_ACTIVE_PLANS = 10;

// "✨ Şablon Keşfet" (Template Hub) için görsel ağırlıklı, hazır rota kütüphanesi.
// Her şablon: kapak görseli, süre, 2 cümlelik tanıtım, illüstratif tamamlanma
// oranı ve önizleme için kısa rutin/gün listesi taşır. "Şablonu Kullan" tıklanınca
// goal + category + totalDays usePlanStudio.startFromTemplate'e aktarılır.
export const TEMPLATE_LIBRARY = [
  {
    id: "docker-14",
    category: "software",
    emoji: "💻",
    title: "14 Günlük Docker Ustalığı",
    description: "Konteynerleşmeyi sıfırdan production seviyesine taşı. İmaj optimizasyonu, compose ve orkestrasyon temelleri iki haftada elinde.",
    image: "https://images.unsplash.com/photo-1605745341112-85968b19335b?auto=format&fit=crop&w=800&q=60",
    totalDays: 14,
    completionRate: 88,
    goal: "14 günde Docker ve konteyner temellerini sıfırdan öğrenmek",
    previewRoutines: ["Günlük 20 dk resmi dokümantasyon okuma", "Her imajı optimize edip boyut kıyasla", "Öğrendiğini tek cümlelik günlük ile not al"],
    previewDays: ["Temel kavramlar & ilk container", "Dockerfile & imaj katmanları", "Volume & network yönetimi", "Docker Compose ile çoklu servis", "Optimizasyon & multi-stage build"],
  },
  {
    id: "system-design-30",
    category: "software",
    emoji: "🏗️",
    title: "30 Günlük Sistem Tasarımı",
    description: "Ölçeklenebilir mimari düşünme becerini Principal Architect seviyesine çıkar. Gerçek vaka analizleriyle trade-off'ları içselleştir.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=60",
    totalDays: 30,
    completionRate: 76,
    goal: "30 günde sistem tasarımı ve ölçeklenebilir mimari becerilerini ileri seviyeye taşımak",
    previewRoutines: ["Haftalık 1 vaka analizi (case study)", "Mimari kararları diyagramla belgelendir", "Bir trade-off'u yazılı savun"],
    previewDays: ["Ölçeklenebilirlik temelleri", "Veritabanı sharding & replikasyon", "Cache stratejileri", "Mesaj kuyrukları & async işleme", "Load balancing & CDN"],
  },
  {
    id: "upper-body-28",
    category: "fitness",
    emoji: "🏋️",
    title: "Üst Vücut Hipertrofi Programı",
    description: "Push/Pull split ile progressive overload uygula, 4 haftada gözle görülür kas kütlesi ve güç artışı hedefle. CSCS prensipleriyle programlanır.",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=60",
    totalDays: 28,
    completionRate: 92,
    goal: "4 haftalık üst vücut hipertrofi (Push/Pull) antrenman programı ile kas kütlesi ve güç artırmak",
    previewRoutines: ["Her antrenman öncesi 10 dk ısınma", "Setler arası RPE not et", "Haftalık vücut ölçümü kaydet"],
    previewDays: ["Push: Göğüs & Omuz", "Pull: Sırt & Biceps", "Aktif dinlenme & mobility", "Push: Hacim artışı", "Pull: Güç odaklı"],
  },
  {
    id: "run-5k-21",
    category: "fitness",
    emoji: "🏃",
    title: "21 Günlük 5K Koşu Kondisyonu",
    description: "Sıfırdan kesintisiz 5K koşabilecek kardiyovasküler kapasiteye ulaş. Kademeli mesafe artışıyla sakatlanma riskini minimumda tutar.",
    image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=60",
    totalDays: 21,
    completionRate: 83,
    goal: "21 günde kesintisiz 5K koşabilecek kondisyona ulaşmak",
    previewRoutines: ["Koşu öncesi 5 dk dinamik esneme", "Nabız/tempo not et", "Haftada 1 dinlenme günü"],
    previewDays: ["Yürüyüş-koşu geçişleri (Gün 1)", "Tempo artışı (Gün 5)", "Mesafe odaklı koşu (Gün 10)", "Aktif toparlanma (Gün 15)", "Kesintisiz 5K denemesi (Gün 21)"],
  },
  {
    id: "kas-6",
    category: "vacation",
    emoji: "🏖️",
    title: "Kaş & Çevresi Romantik Rotası",
    description: "Koyları, tekne turlarını ve gastronomi duraklarını dengeleyen 6 günlük bir kaçamak. Kalabalıktan uzak, huzurlu bir tempo ile kurgulanır.",
    image: "https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?auto=format&fit=crop&w=800&q=60",
    totalDays: 6,
    completionRate: 88,
    goal: "6 günlük Kaş tatili — koylar, tekne turu ve gastronomi rotası",
    previewRoutines: ["Sabah erken saatte plaj/koy çıkışı", "Günün bütçesini akşam gözden geçir", "Yerel bir restoranı listene ekle"],
    previewDays: ["Varış & merkez keşif", "Tekne turu & gizli koylar", "Kalkan gezisi & gastronomi", "Sahil yürüyüşü & dalış", "Antik kent ziyareti", "Serbest gün & dönüş hazırlığı"],
  },
  {
    id: "kapadokya-4",
    category: "vacation",
    emoji: "🗺️",
    title: "Kapadokya Balon & Vadi Turu",
    description: "Gün doğumu balon turundan vadi yürüyüşlerine, yer altı şehrinden şarap tadımına 4 günlük yoğun ama dengeli bir rota.",
    image: "https://images.unsplash.com/photo-1641128324972-af3212f0f6bd?auto=format&fit=crop&w=800&q=60",
    totalDays: 4,
    completionRate: 90,
    goal: "4 günlük Kapadokya gezisi — balon turu, vadi yürüyüşleri ve yeraltı şehri rotası",
    previewRoutines: ["Balon turu için gün doğumundan önce kalk", "Her vadi sonrası su molası ver", "Günlük fotoğraf/anı notu tut"],
    previewDays: ["Varış & Ürgüp keşfi", "Gün doğumu balon turu & vadiler", "Yeraltı şehri & şarap tadımı", "Panorama noktaları & dönüş"],
  },
  {
    id: "english-30",
    category: "general",
    emoji: "🗣️",
    title: "30 Günlük İngilizce Akıcılık",
    description: "Konuşma pratiğini gündelik alışkanlığa dönüştürerek akıcı seviyeye taşı. Meta-Learning teknikleriyle kalıcı kelime hazinesi inşa eder.",
    image: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=800&q=60",
    totalDays: 30,
    completionRate: 79,
    goal: "30 günde İngilizce konuşma pratiğini akıcı seviyeye taşımak",
    previewRoutines: ["Günlük 15 dk gölge okuma (shadowing)", "5 yeni kelimeyi cümlede kullan", "Haftalık kısa video günlüğü kaydet"],
    previewDays: ["Telaffuz & gölge okuma", "Günlük konuşma kalıpları", "Dinleme & not alma", "Serbest konuşma pratiği", "Haftalık değerlendirme"],
  },
  {
    id: "guitar-45",
    category: "general",
    emoji: "🎸",
    title: "45 Günlük Gitar Başlangıç",
    description: "Temel akorlardan ilk üç şarkıyı çalabilecek seviyeye adım adım ilerle. Parmak egzersizleri ve ritim çalışmalarıyla desteklenir.",
    image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=60",
    totalDays: 45,
    completionRate: 81,
    goal: "45 günde temel akorlarla 3 şarkı çalabilecek gitar seviyesi",
    previewRoutines: ["Günlük 10 dk parmak ısınma egzersizi", "Akor geçişlerini metronomla çalış", "Haftada 1 kısa performans videosu çek"],
    previewDays: ["Temel akorlar (Em, Am, C, G)", "Akor geçiş hızlanması", "Basit strumming pattern", "İlk şarkı denemesi", "Ritim & tempo çalışması"],
  },
];

export const TEMPLATE_CATEGORY_TABS = [
  { key: "all", label: "Tümü", emoji: "✨" },
  { key: "software", label: "Yazılım & Mimari", emoji: "💻" },
  { key: "fitness", label: "Spor & Sağlık", emoji: "🏋️" },
  { key: "vacation", label: "Seyahat & Tatil", emoji: "🏖️" },
  { key: "general", label: "Öğrenme", emoji: "📚" },
];

// Hedef girişinin üstünde gösterilen hazır şablon çipleri. Tıklanınca hem
// kategori hem hedef metni otomatik dolar.
export const TEMPLATE_CHIPS = [
  { emoji: "🏖️", label: "6 Günlük Kaş Tatili", category: "vacation", goal: "6 günlük Kaş tatili — koylar, tekne turu ve gastronomi rotası" },
  { emoji: "🏋️‍♂️", label: "4 Günlük Üst Vücut", category: "fitness", goal: "4 günlük üst vücut hipertrofi (Push/Pull) antrenman programı" },
  { emoji: "💻", label: "14 Günlük Docker", category: "software", goal: "14 günde Docker ve konteyner temellerini sıfırdan öğrenmek" },
  { emoji: "🗣️", label: "30 Günlük İngilizce", category: "general", goal: "30 günde İngilizce konuşma pratiğini akıcı seviyeye taşımak" },
  { emoji: "🏃", label: "21 Günlük Koşu", category: "fitness", goal: "21 günde kesintisiz 5K koşabilecek kondisyona ulaşmak" },
  { emoji: "🎸", label: "45 Günlük Gitar", category: "general", goal: "45 günde temel akorlarla 3 şarkı çalabilecek gitar seviyesi" },
];

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
  "Routinix odağını yapılandırıyor...",
  "Rutinlerin ve ilk haftan hazırlanıyor...",
  "Performans çerçeven oluşturuluyor...",
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
