import { Clock, Timer, Hash, Flame, Dumbbell, Music2, Clapperboard, Image, ListChecks, Gauge, StickyNote, Gamepad2 } from "lucide-react";

// Widget Tabanlı Görev Sistemi — TEK doğruluk kaynağı (katalog + varsayılan
// değerler). WidgetPicker.jsx (kategorize edilmiş arama popover'ı) ve
// TaskWidgets.jsx (dinamik render motoru) İKİSİ de buradan okur — yeni bir
// widget türü eklemek TEK bu dosyaya bir girdi eklemek anlamına gelir.
//
// Her görevin `widgets` alanı: [{ id, type, value }] — `id` yalnızca İSTEMCİ
// tarafı React key/silme amaçlı (bkz. newWidgetId), sunucuya AYNEN gönderilir
// ama anlamlı bir kimlik DEĞİLDİR.
export const WIDGET_CATEGORIES = [
  { key: "time", label: "Zaman" },
  { key: "metric", label: "Metrik" },
  { key: "media", label: "Medya" },
  { key: "org", label: "Organizasyon" },
];

export const WIDGET_CATALOG = [
  {
    type: "time",
    category: "time",
    label: "Saat Aralığı",
    icon: Clock,
    defaultValue: () => ({ start: "09:00", end: "10:00" }),
  },
  {
    type: "timer",
    category: "time",
    label: "Kronometre",
    icon: Timer,
    // elapsedSec: DURAKLATILMIŞ/kaydedilmiş toplam süre. running/startedAt
    // İSTEMCİDE TUTULMAZ (bkz. TaskWidgets.jsx dosya başı yorumu) — sayfa
    // yenilenince "çalışıyor" durumu KORUNMAZ, dürüst bir sınır.
    defaultValue: () => ({ elapsedSec: 0 }),
  },
  {
    type: "counter",
    category: "metric",
    label: "Sayı Sayacı",
    icon: Hash,
    defaultValue: () => ({ label: "Sayfa", current: 0, target: 10 }),
  },
  {
    type: "calorie",
    category: "metric",
    label: "Kalori / Makro",
    icon: Flame,
    defaultValue: () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 }),
  },
  {
    type: "sets_reps",
    category: "metric",
    label: "Set / Tekrar",
    icon: Dumbbell,
    // repRange/rpe: AI'ın ürettiği GERÇEK antrenman verisi (bkz.
    // api/_lib/planPrompt.js taskFieldGuide("fitness") active_widgets) —
    // sabit "reps" yerine (varsa) tercih edilir, bkz. TaskWidgets.jsx
    // SetsRepsWidget. İkisi de opsiyonel, elle eklenen widget'larda YOK.
    defaultValue: () => ({ sets: 3, reps: 12, repRange: null, rpe: null, weightKg: null }),
  },
  {
    type: "spotify",
    category: "media",
    label: "Spotify Playlist",
    icon: Music2,
    defaultValue: () => ({ url: "" }),
  },
  {
    type: "youtube",
    category: "media",
    label: "YouTube Video",
    icon: Clapperboard,
    defaultValue: () => ({ url: "" }),
  },
  {
    type: "image",
    category: "media",
    label: "Görsel",
    icon: Image,
    // DÜRÜSTLÜK NOTU: gerçek dosya YÜKLEME altyapısı (Supabase Storage)
    // projede YOK — bilerek KURULMADI (bkz. WidgetPicker.jsx görsel widget
    // açıklaması). Bunun yerine bir görsel URL'si YAPIŞTIRILIR.
    defaultValue: () => ({ url: "" }),
  },
  {
    type: "game_score",
    category: "metric",
    label: "Oyun Skoru (G/M)",
    icon: Gamepad2,
    // Akıllı Widget Enjektörü'nün (bkz. utils/smartWidgets.js) "Gaming"
    // bağlamı için ürettiği TEK yeni widget türü — diğer tüm enjekte edilen
    // türler (gym_set→sets_reps, nutrition_macro→calorie, academic_counter→
    // counter, media_embed→spotify/youtube) zaten var olan katalog
    // girdileriyle birebir eşleşiyordu, bu YENİ bir kavram olduğu için
    // katalogda karşılığı yoktu.
    defaultValue: () => ({ wins: 0, losses: 0 }),
  },
  {
    type: "checklist",
    category: "org",
    label: "Alt Liste",
    icon: ListChecks,
    defaultValue: () => ({ items: [] }),
  },
  {
    type: "difficulty",
    category: "org",
    label: "Zorluk Seviyesi",
    icon: Gauge,
    defaultValue: () => ({ level: "Orta" }),
  },
  {
    type: "note",
    category: "org",
    label: "Not",
    icon: StickyNote,
    defaultValue: () => ({ text: "" }),
  },
];

const WIDGET_BY_TYPE = new Map(WIDGET_CATALOG.map((w) => [w.type, w]));

export function getWidgetDef(type) {
  return WIDGET_BY_TYPE.get(type) || null;
}

export const DIFFICULTY_LEVELS = ["Kolay", "Orta", "Zor"];
export const DIFFICULTY_STYLE = {
  Kolay: { color: "#6FCF97", bg: "rgba(111,207,151,0.14)" },
  Orta: { color: "var(--amber-accent)", bg: "rgba(240,179,126,0.14)" },
  Zor: { color: "#FF6E92", bg: "rgba(244,64,107,0.14)" },
};

let widgetIdCounter = 0;
export function newWidgetId() {
  widgetIdCounter += 1;
  return `widget-${Date.now()}-${widgetIdCounter}`;
}

export function createWidget(type) {
  const def = getWidgetDef(type);
  if (!def) return null;
  return { id: newWidgetId(), type, value: def.defaultValue() };
}

// AI'ın (bkz. active_widgets) ürettiği GERÇEK değerlerle bir widget
// oluşturur — defaultValue()'nun ÜZERİNE yazar (spread), AI'ın belirtmediği
// alanlar (ör. weightKg) varsayılanda kalır.
export function createWidgetWithValue(type, valueOverride) {
  const def = getWidgetDef(type);
  if (!def) return null;
  return { id: newWidgetId(), type, value: { ...def.defaultValue(), ...(valueOverride || {}) } };
}

export function formatClockTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Spotify/YouTube URL'lerinden gömme (embed) ID'sini ayıklar — MusicContext.jsx/
// GlobalMusicPlayer.jsx'teki AYNI, canlı doğrulanmış düzenli ifadeler.
export const SPOTIFY_PLAYLIST_URL_RE = /playlist\/([a-zA-Z0-9]+)/;
export const YOUTUBE_VIDEO_URL_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;
