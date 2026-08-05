// Delta Update Engine — AI Koç serbest metin isteklerinde Gemini'ye ASLA
// tüm plan JSON'ını YENİDEN ÜRETTİRMİYORUZ; coachPrompt.js zaten yalnızca
// DEĞİŞEN parçayı bir "delta nesnesi" olarak döndürüyor:
//   { mutations: [{task_id, fields}], newTasks: [...], deletedTaskIds: [...], planTotalDays }
// Bu, "UPDATE_TASK/DELETE_TASK/ADD_TASK" aksiyon tipli bir delta şemasıyla
// AYNI amaca hizmet eder — mutations[].fields zaten "değişen alanlar" (bir
// PATCH), deletedTaskIds zaten DELETE_TASK'ın karşılığı, newTasks zaten
// ADD_TASK'ın karşılığı, planTotalDays zaten RESIZE_PLAN'ın karşılığı.
// (Bu dosyadan ÖNCE bu 4 adım coach-action.js'in dispatch() fonksiyonunun
// İÇİNE gömülüydü, art arda 4 ayrı adım olarak; token/maliyet DAVRANIŞI
// DEĞİŞMEDİ — bu, o 4 adımı TEK bir isimli, test edilebilir, yeniden
// kullanılabilir fonksiyona toparlayan bir KOD KALİTESİ refaktörüdür.)
//
// GÜVENLİK (değişmedi, yalnızca taşındı): AI'ın ürettiği task_id'lerin
// GERÇEKTEN bu plana ait olduğu burada doğrulanır (halüsinasyon/başka
// kullanıcı id'si sızıntısına karşı) — validasyon apply mantığının kendisiyle
// AYNI yerde yaşar, çağıran kodun bunu HATIRLAMASINA gerek kalmaz.

async function applyPatches(admin, patches) {
  if (!patches.length) return [];
  return Promise.all(
    patches.map(async ({ id, fields }) => {
      const { data, error } = await admin.from("tasks").update(fields).eq("id", id).select().single();
      if (error) throw error;
      return data;
    })
  );
}

async function insertNewTasks(admin, planId, userId, rows) {
  if (!rows?.length) return [];
  const payload = rows.map((r) => {
    const dayNumber = Math.max(1, Number(r.day_number) || 1);
    return {
      plan_id: planId,
      user_id: userId,
      week_number: Math.max(1, Math.ceil(dayNumber / 7)),
      day_number: dayNumber,
      title: (r.title ?? "").toString().trim() || "İsimsiz görev",
      detail: r.detail ?? null,
      duration_min: r.duration_min ?? null,
      priority: r.priority ?? null,
      estimated_cost: r.estimated_cost ?? null,
      map_search_query: r.map_search_query ?? null,
      is_completed: false,
    };
  });
  const { data, error } = await admin.from("tasks").insert(payload).select();
  if (error) throw error;
  return data || [];
}

async function deleteTasks(admin, ids) {
  if (!ids?.length) return [];
  const { data, error } = await admin.from("tasks").delete().in("id", ids).select("id");
  if (error) throw error;
  return data || [];
}

async function updatePlanTotalDays(admin, planId, totalDays) {
  const { data, error } = await admin.from("plans").update({ total_days: totalDays }).eq("id", planId).select().single();
  if (error) throw error;
  return data;
}

// SERT/DB SEVİYESİ GÜVENCE: "planı N güne indir" isteğinde AI'ın deltası
// (mutations + deletedTaskIds) HER görevi doğru şekilde ele aldığını
// VARSAYAR — model bir görevi ne yeniden dağıtır ne siler gibi bir uç durumu
// (edge case) kaçırırsa (ör. çok sayıda görev nedeniyle yanıt maxOutputTokens
// sınırında kesilirse), o görev day_number > yeni total_days ile DB'de ARTIK
// (stale) olarak kalabilirdi. PlanBoard.jsx'in takvim şeridi zaten total_days
// kadar hücre ürettiği için bu ARTIK günler UI'da görünmez/erişilemez hale
// gelir — AMA hâlâ `tasks` tablosunda durur ve `weeks` state'i (dolayısıyla
// "Tüm Plan" PDF ihracı, bkz. PrintablePlan.jsx) üzerinden SIZAR. Bu fonksiyon
// AI'IN NE DEDİĞİNDEN BAĞIMSIZ, planın total_days'i her değiştiğinde bu
// değişmezi (invariant) DOĞRUDAN veritabanı seviyesinde zorlar: bir planın
// hiçbir görevi kendi total_days'ini AŞAMAZ.
async function pruneTasksBeyondTotalDays(admin, planId, totalDays) {
  const { data, error } = await admin.from("tasks").delete().eq("plan_id", planId).gt("day_number", totalDays).select("id");
  if (error) throw error;
  return data || [];
}

// delta: coachPrompt.js'in runCoachIntent() dönüşü — { mutations, newTasks,
// deletedTaskIds, planTotalDays }. plan: allPlans içinden hedef plan (`.tasks`
// alanı DOLU olmalı — validasyon bunu kullanır).
// Döner: { mutatedTasks, newTasks, deletedTaskIds, updatedPlan } — client'a
// olduğu gibi yansıtılabilecek, coach-action.js'in ÖNCEDEN döndürdüğüyle
// BİREBİR AYNI şekil.
export async function applyPlanDelta(admin, plan, userId, delta) {
  const validIds = new Set(plan.tasks.map((t) => t.id));

  const patches = (delta.mutations || [])
    .filter((m) => m?.task_id && m?.fields && validIds.has(m.task_id))
    .map((m) => ({ id: m.task_id, fields: m.fields }));
  const deleteIds = (delta.deletedTaskIds || []).filter((id) => validIds.has(id));

  const mutatedTasks = await applyPatches(admin, patches);
  const newTasks = await insertNewTasks(admin, plan.id, userId, delta.newTasks || []);
  const deletedTasks = await deleteTasks(admin, deleteIds);

  let updatedPlan = null;
  let prunedTasks = [];
  if (delta.planTotalDays && delta.planTotalDays !== plan.total_days) {
    updatedPlan = await updatePlanTotalDays(admin, plan.id, delta.planTotalDays);
    // Yukarıdaki applyPatches/insertNewTasks/deleteTasks ZATEN uygulandıktan
    // SONRA çalışır — bu yüzden bu noktada DB'nin GERÇEK/güncel durumunu
    // görür, yalnızca AI'ın kaçırdığı gerçek ARTIKLARI temizler.
    prunedTasks = await pruneTasksBeyondTotalDays(admin, plan.id, delta.planTotalDays);
  }

  const deletedTaskIds = [...deletedTasks.map((t) => t.id), ...prunedTasks.map((t) => t.id)];
  return { mutatedTasks, newTasks, deletedTaskIds, updatedPlan };
}
