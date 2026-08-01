import { categoryOf } from "../constants";
import { findTodayDay } from "../services/aiCoachService";

// "Rhythm & Insights" analitik grafiklerinin SAF veri dönüşümleri (DOM/React
// bağımsız — RhythmStudio.jsx bunları çağırıp RhythmCharts.jsx bileşenlerine
// hazır, çizime uygun veri geçirir).

// Derin Odak Hacmi — odak seanslarını (focus_sessions) planın kategorisine
// (mode) göre dakika bazında gruplar. `sessions[].plan_id` → plans map'i
// üzerinden kategoriye çözülür (tag, YAZMA anında değil OKUMA anında
// türetilir — bkz. supabase/migration.sql 7. bölüm yorumu).
export function aggregateDeepWorkByCategory(sessions, plans) {
  const planModeById = new Map((plans || []).map((p) => [p.id, p.mode]));
  const minutesByMode = new Map();
  for (const s of sessions || []) {
    const mode = (s.plan_id && planModeById.get(s.plan_id)) || "general";
    minutesByMode.set(mode, (minutesByMode.get(mode) || 0) + (s.duration_min || 0));
  }
  return [...minutesByMode.entries()]
    .map(([mode, minutes]) => ({ key: mode, minutes, ...categoryOf(mode) }))
    .sort((a, b) => b.minutes - a.minutes);
}

// Pik Verimlilik Saatleri — odak seanslarını başlangıç saatine göre 3'er
// saatlik 8 dilime (00-03, 03-06, ... 21-24) toplar. Yerel saat kullanılır
// (kullanıcının kendi günü, UTC değil) ki harita gerçekten "günün hangi
// saatinde" sorusuna cevap versin.
const HEATMAP_BUCKET_HOURS = 3;
const HEATMAP_BUCKET_COUNT = 24 / HEATMAP_BUCKET_HOURS;

export function aggregateHeatmapBuckets(sessions) {
  const buckets = Array.from({ length: HEATMAP_BUCKET_COUNT }, (_, i) => ({
    startHour: i * HEATMAP_BUCKET_HOURS,
    endHour: (i + 1) * HEATMAP_BUCKET_HOURS,
    minutes: 0,
  }));
  for (const s of sessions || []) {
    const hour = new Date(s.started_at).getHours();
    const idx = Math.min(HEATMAP_BUCKET_COUNT - 1, Math.floor(hour / HEATMAP_BUCKET_HOURS));
    buckets[idx].minutes += s.duration_min || 0;
  }
  return buckets;
}

// Ritim Dengesi & Esneklik İndeksi — seçili aralıktaki günlerin yüzde kaçında
// KULLANICI AKTİFTİ (bir rapor üretilmiş VEYA en az 1 görev tamamlanmış gün)
// — zincir koparma/streak stresi YARATMAYAN bir süreklilik ölçüsü. Rapor
// üretilmemiş bir gün "başarısızlık" sayılmaz, yalnızca indekse katkı
// vermez (nötr).
export function computeFlexibilityIndex(reports, rangeDays) {
  if (!rangeDays || rangeDays <= 0) return 0;
  const activeDays = (reports || []).filter((r) => (r.stats?.completedTasks || 0) > 0 || (r.stats?.focusMinutesToday || 0) > 0).length;
  return Math.round((Math.min(activeDays, rangeDays) / rangeDays) * 100);
}

// Zorluk/Hafifletme Dağılımı — Esnek Sistem'in kaç günde devreye girdiğini
// (rescheduled_count > 0) toplam rapor sayısına oranlar. "Pes etme" değil,
// "ritme dönüş" motivasyon metriği olarak çerçevelenir (bkz. RhythmStudio.jsx
// metinleri).
export function computeReliefDistribution(reports) {
  const total = (reports || []).length;
  const reliefDays = (reports || []).filter((r) => (r.rescheduled_count || 0) > 0).length;
  return { total, reliefDays, steadyDays: total - reliefDays };
}

// Tarih aralığı yardımcıları — period: "week" | "month" | "year".
export function rangeStartFor(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "week") start.setDate(now.getDate() - 6);
  else if (period === "month") start.setDate(now.getDate() - 29);
  else start.setDate(now.getDate() - 364);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function daysBetween(fromDate, toDate) {
  return Math.max(1, Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1);
}

// Seçili takvim gününe (YYYY-MM-DD, UTC — bkz. RhythmStudio.jsx todayKey())
// denk gelen odak seanslarını süzer — Dashboard grid'inin sol-alt "Odak
// Seansları" listesi için.
export function sessionsForDate(sessions, dateStr) {
  if (!dateStr) return [];
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd = `${dateStr}T23:59:59.999Z`;
  return (sessions || []).filter((s) => s.started_at >= dayStart && s.started_at <= dayEnd);
}

// "Bugün"ün görevlerini TÜM aktif planlar üzerinden toplar — api/rhythm-report.js
// ile AYNI findTodayDay sezgisini (src/services/aiCoachService.js, sunucu VE
// client'ta kullanılan saf/paylaşılan fonksiyon) kullanır. Yalnızca "bugün"
// için anlamlıdır (görevlerin gerçek takvim tarihi yok — bkz. proje notları),
// bu yüzden RhythmStudio yalnızca `isToday` iken bu listeyi gösterir.
export function collectTodayTasks(plans) {
  const entries = [];
  for (const p of plans || []) {
    if (!p.tasks?.length) continue;
    const byDay = new Map();
    for (const t of p.tasks) {
      const d = t.day_number ?? 1;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(t);
    }
    const weeks = [{ weekNumber: 1, days: [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([dayNumber, tasks]) => ({ dayNumber, tasks })) }];
    const day = findTodayDay(weeks);
    if (!day) continue;
    const cat = categoryOf(p.mode);
    for (const t of day.tasks) entries.push({ ...t, planTitle: p.title || "Plan", planEmoji: cat.emoji, planAccent: cat.accent });
  }
  return entries;
}
