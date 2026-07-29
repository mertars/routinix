// AI Koç'un hazır aksiyon çiplerinin SAF (Supabase'siz) veri dönüşümleri.
// Her fonksiyon güncellenecek görevleri { id, fields } yama listesi olarak
// döner; gerçek DB yazımı planService.updateTasksBulk ile ayrı yapılır —
// böylece usePlanStudio önce optimistic UI güncellemesi uygulayıp sonra
// arka planda kalıcılaştırabilir.

function roundTo5(n) {
  return Math.max(5, Math.round(n / 5) * 5);
}

const PRIORITY_DOWN = { Yüksek: "Orta", Orta: "Düşük", Düşük: "Düşük" };
const PRIORITY_UP = { Düşük: "Orta", Orta: "Yüksek", Yüksek: "Yüksek" };

// 📉 Planı Hafiflet — tamamlanmamış görevlerin süresini ~%30 kısaltır, önceliği yumuşatır.
export function lightenTasks(tasks) {
  return tasks
    .filter((t) => !t.is_completed && t.duration_min)
    .map((t) => ({
      id: t.id,
      fields: {
        duration_min: roundTo5(t.duration_min * 0.7),
        ...(t.priority ? { priority: PRIORITY_DOWN[t.priority] || t.priority } : {}),
      },
    }));
}

// 🔥 Tempoyu Sıkılaştır — süreyi hafifçe kısaltır, önceliği yükseltir (daha yoğun tempo).
export function intensifyTasks(tasks) {
  return tasks
    .filter((t) => !t.is_completed && t.duration_min)
    .map((t) => ({
      id: t.id,
      fields: {
        duration_min: roundTo5(t.duration_min * 0.85),
        ...(t.priority ? { priority: PRIORITY_UP[t.priority] || t.priority } : {}),
      },
    }));
}

// ☕ Bugün Çok Yoruldum — verilen günün tamamlanmamış görevlerini bir sonraki güne kaydırır.
export function postponeDayTasks(dayObj) {
  if (!dayObj) return [];
  return dayObj.tasks
    .filter((t) => !t.is_completed)
    .map((t) => ({ id: t.id, fields: { day_number: dayObj.dayNumber + 1 } }));
}

// "Bugün" = yüklü günler içinde tamamlanmamış görevi olan ilk gün (yoksa son gün).
export function findTodayDay(weeks) {
  const days = weeks.flatMap((w) => w.days).sort((a, b) => a.dayNumber - b.dayNumber);
  if (!days.length) return null;
  return days.find((d) => d.tasks.some((t) => !t.is_completed)) || days[days.length - 1];
}

// 📊 Gidişatımı Analiz Et — tamamen client-side, DB'ye dokunmaz.
export function analyzeProgress(weeks) {
  const allTasks = weeks.flatMap((w) => w.days.flatMap((d) => d.tasks));
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.is_completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (total === 0) return "Henüz görev verisi yok — bir hafta yüklendiğinde gidişatını analiz edebilirim.";
  if (pct >= 80) return `Harika gidiyorsun! Görevlerinin %${pct}'ini tamamladın (${done}/${total}). Bu tempoyu koru 💪`;
  if (pct >= 50) return `İyi bir ivmedesin: %${pct} tamamlama (${done}/${total}). İstersen "Tempoyu Sıkılaştır" ile hedefi öne çekebiliriz.`;
  if (pct >= 20) return `Şu an %${pct} tamamlama oranındasın (${done}/${total}). İstersen "Planı Hafiflet" ile yükü azaltıp momentum kazanabiliriz.`;
  return `Henüz %${pct} tamamlama var (${done}/${total}). Küçük adımlarla başlayalım — istersen bugünkü yükü hafifleteyim 🌿`;
}
