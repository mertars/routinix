import { CATEGORIES } from "../constants";
import { createWidget, createWidgetWithValue, getWidgetDef } from "./taskWidgets";

// Akıllı Widget Enjektörü (AI Context Widget Parser) — TEK doğruluk kaynağı.
// DÜRÜSTLÜK NOTU: bu "AI" bir Gemini çağrısı DEĞİL — kategori + hedef
// metnindeki anahtar kelimelere dayalı DETERMİNİSTİK bir bağlam sınıflandırıcı
// (icsExport.js'in gün-haftanın-günü sezgisi/DayBatchWidgetModal'ın toplu
// uygulama ilkesiyle AYNI ruhta: hızlı, ücretsiz, öngörülebilir). Kategori
// (yazılım/fitness/tatil/genel) TEK BAŞINA yeterince ayrıştırıcı DEĞİL —
// "genel" kategorisi hem YKS/ders hem gaming hedeflerini kapsayabilir — bu
// yüzden asıl sinyal HEDEF METNİNDEKİ anahtar kelimeler, kategori yalnızca
// eşleşme bulunamazsa düşülen bir yedek ipucu.
const CONTEXT_RULES = [
  {
    key: "fitness",
    keywords: ["fitness", "antrenman", "spor", "gym", "egzersiz", "kas", "kilo", "koşu", "yürüyüş", "diyet", "vücut", "hipertrofi", "kondisyon"],
    categoryHint: "fitness",
    widgetTypes: ["sets_reps", "calorie", "timer"],
  },
  {
    key: "academic",
    keywords: ["yks", "lgs", "sınav", "ders", "kodlama", "yazılım", "üniversite", "matematik", "ingilizce", "öğren", "kitap", "quiz", "coding", "programlama", "algoritma", "docker", "python"],
    categoryHint: "software",
    widgetTypes: ["counter", "timer", "spotify"],
  },
  {
    key: "gaming",
    keywords: ["gaming", "cs2", "cs:go", "valorant", "oyun", "esports", "league of legends", "dota", "fortnite", "pubg", "rank", "elo"],
    categoryHint: null,
    widgetTypes: ["game_score", "counter", "youtube"],
  },
];

const REST_EXCLUSION_RE = /dinlenme|tatil|serbest zaman|izin günü|mola günü/i;

// Kategori + hedef metnine bakıp bir bağlam anahtarı ("fitness"/"academic"/
// "gaming") ya da eşleşme yoksa null döner.
export function detectSmartContext(category, goalText) {
  const text = `${goalText || ""}`.toLocaleLowerCase("tr");
  const byKeyword = CONTEXT_RULES.find((rule) => rule.keywords.some((kw) => text.includes(kw)));
  if (byKeyword) return byKeyword.key;
  const byCategory = CONTEXT_RULES.find((rule) => rule.categoryHint === category);
  return byCategory ? byCategory.key : null;
}

export function widgetTypesForContext(contextKey) {
  return CONTEXT_RULES.find((rule) => rule.key === contextKey)?.widgetTypes || [];
}

// AI'ın ürettiği ham gün dizisini ([{ day, tasks: [...] }]) MUTASYONSUZ
// zenginleştirir — flattenWeek'e (planService.js) gitmeden ÖNCE çağrılır.
// Açıkça "dinlenme/tatil" günü olan görevler ATLANIR (fitness widget'ları bir
// dinlenme gününe enjekte edilmez).
//
// `t.active_widgets` — AI'ın (bkz. api/_lib/planPrompt.js taskFieldGuide
// "fitness") GERÇEK set/tekrar/RPE değerleriyle doldurduğu opsiyonel dizi
// (yalnızca fitness kategorisinde, planHydration.js ile tuple'dan çözülür).
// Bir tür için AI değeri VARSA sabit varsayılan ("3x12") YERİNE o kullanılır;
// yoksa eskisi gibi generic createWidget() default'una düşülür. İşlendikten
// sonra `active_widgets` geçici bir alan olduğu için task'tan SİLİNİR — DB
// `tasks` tablosunda böyle bir sütun YOK, yalnızca `widgets` jsonb'ye yazılır.
export function injectSmartWidgets(weekDays, contextKey) {
  const widgetTypes = widgetTypesForContext(contextKey);
  if (!contextKey || widgetTypes.length === 0) return weekDays;
  return (weekDays || []).map((dayObj) => {
    if (!dayObj.tasks || dayObj.tasks.length === 0) return dayObj;
    return {
      ...dayObj,
      tasks: dayObj.tasks.map((t) => {
        const { active_widgets, ...rest } = t;
        if (REST_EXCLUSION_RE.test(t.title || "")) return rest;

        const aiByType = new Map((active_widgets || []).filter((w) => w?.type).map((w) => [w.type, w.value]));
        const fresh = widgetTypes
          .map((type) => (aiByType.has(type) ? createWidgetWithValue(type, aiByType.get(type)) : createWidget(type)))
          .filter(Boolean);
        return { ...rest, widgets: [...(t.widgets || []), ...fresh] };
      }),
    };
  });
}

// PlanGeneratedSummaryModal'ın "Eklenecek Otomatik Widget'lar Özeti" rozet
// listesi için — bu bağlamda ENJEKTE EDİLECEĞİ KESİN OLARAK BİLİNEN türler
// (injectSmartWidgets İLE AYNI liste), her görevi tekrar taramaya gerek yok.
export function getSmartWidgetBadges(contextKey) {
  return widgetTypesForContext(contextKey)
    .map((type) => getWidgetDef(type))
    .filter(Boolean)
    .map((def) => ({ type: def.type, label: def.label, icon: def.icon }));
}

function formatHours(h) {
  return String(h).replace(".", ",");
}

// Stratejik Başarı Kartı'nın (bkz. PlanGeneratedSummaryModal.jsx) analiz
// cümlesi — plana ÖZEL, gerçek veriden (1. haftanın toplam süresi/gün sayısı)
// türetilen deterministik bir özet metni (İKİNCİ bir Gemini çağrısı DEĞİL —
// yukarıdaki dürüstlük notuyla AYNI gerekçe: hızlı, ücretsiz, her zaman
// üretilebilir).
export function buildStrategicAnalysis({ category, contextKey, totalDays, firstWeekTasks }) {
  const tasks = firstWeekTasks || [];
  const totalMinutes = tasks.reduce((sum, t) => sum + (Number(t.duration_min) || 0), 0);
  const weeklyHours = totalMinutes > 0 ? Math.round((totalMinutes / 60) * 10) / 10 : null;
  const taskCount = tasks.length;
  const days = totalDays || taskCount || 7;
  const hourPhrase = weeklyHours ? `haftalık ~${formatHours(weeklyHours)} saatlik` : `${taskCount} adımlık`;

  if (contextKey === "fitness") {
    return `Bu plan seni ${hourPhrase} bir antrenman ritmine oturtacak — set/tekrar ve makro takibi görevlerine otomatik işlendi, tek yapman gereken tutarlılık.`;
  }
  if (contextKey === "academic") {
    return `Bu plan seni ${hourPhrase} bir odak/çalışma bloğuna ulaştıracak — soru/sayfa sayacı ve pomodoro otomatik eklendi, ${days} günlük ritmi bozmadan ilerle.`;
  }
  if (contextKey === "gaming") {
    return `Bu plan seni ${hourPhrase} bir pratik rutinine sokacak — galibiyet/mağlubiyet ve hedef sayaçları otomatik işlendi, gelişimini ölçülebilir kıl.`;
  }
  const catInfo = CATEGORIES[category] || CATEGORIES.general;
  return `Bu plan seni ${hourPhrase} bir ilerleme ritmine oturtacak — ${days} günlük yol haritan hazır, ${catInfo.label.toLocaleLowerCase("tr")} odağıyla ilerleyebilirsin.`;
}
