// Template Hydration — Gemini'den GELEN kompakt "tuple" (dizi-içinde-dizi)
// task formatını, downstream kodun (planService.js flattenWeek/
// savePlanToSupabase) beklediği nesne şekline geri çevirir. bkz.
// planPrompt.js taskFieldGuide() — modelden BU SIRADA istenen alanlar
// buradaki TASK_SHAPE ile BİREBİR eşleşmeli; biri değişirse diğeri de
// güncellenmeli (tek kaynak burada tanımlanır, planPrompt.js buraya
// import ETMEZ ama yorum satırıyla birbirine referans verir).
const TASK_SHAPE = {
  vacation: ["title", "description", "duration_min", "estimated_cost", "map_search_query"],
  // active_widgets: bkz. planPrompt.js taskFieldGuide("fitness") — AI'ın
  // ürettiği GERÇEK set/tekrar/RPE değerlerini taşıyan opsiyonel widget
  // dizisi (bkz. src/utils/smartWidgets.js injectSmartWidgets — varsayılan
  // "3x12" yerine bu değerleri kullanır).
  fitness: ["title", "description", "duration_min", "priority", "active_widgets"],
  software: ["title", "description", "duration_min", "priority"],
  general: ["title", "description", "duration_min", "priority"],
};

function hydrateTask(entry, category) {
  // GERİYE DÖNÜK/SAVUNMACI: model ara sıra (nadiren) istenen tuple yerine
  // hâlâ bir NESNE dönebilir (ör. eski bir prompt cache'i, ya da modelin
  // JSON şema talimatını tam uymadığı bir durum) — bu durumda dokunma,
  // zaten downstream'in beklediği şekilde. Sessizce KIRILMAK yerine
  // esnek davranmak, bir format sapmasının TÜM plan üretimini
  // çökertmesini önler.
  if (!Array.isArray(entry)) return entry;
  const shape = TASK_SHAPE[category] || TASK_SHAPE.general;
  const obj = {};
  shape.forEach((key, i) => {
    const v = entry[i];
    if (v !== undefined && v !== null && v !== "") obj[key] = v;
  });
  return obj;
}

function hydrateDays(days, category) {
  return (days || []).map((d) => ({
    ...d,
    tasks: Array.isArray(d.tasks) ? d.tasks.map((t) => hydrateTask(t, category)) : d.tasks,
  }));
}

// createEnrichedPlan'ın ham (henüz hydrate edilmemiş) çıktısını alır,
// first_week_tasks'ı hydrate eder. Fonksiyonun DIŞ imzası/dönüş şekli
// değişmez — yalnızca .tasks alanlarının İÇİ tuple'dan nesneye döner.
export function hydratePlanTemplate(rawOutput, category) {
  if (!rawOutput || !Array.isArray(rawOutput.first_week_tasks)) return rawOutput;
  return { ...rawOutput, first_week_tasks: hydrateDays(rawOutput.first_week_tasks, category) };
}

// fetchNextWeekTasks'ın ham çıktısını hydrate eder (week_tasks).
export function hydrateWeekTemplate(rawOutput, category) {
  if (!rawOutput || !Array.isArray(rawOutput.week_tasks)) return rawOutput;
  return { ...rawOutput, week_tasks: hydrateDays(rawOutput.week_tasks, category) };
}
