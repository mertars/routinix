import { getSupabaseAdmin, getUserFromRequest } from "./_lib/supabaseAdmin.js";
import { getRemaining, consumeOne, TRIAL_LIMIT } from "./_lib/quota.js";
import { isAdminUser } from "./_lib/adminAccess.js";
import { runCoachIntent } from "./_lib/coachPrompt.js";
import { classifyGeminiError } from "./_lib/aiErrors.js";
import { lightenTasks, intensifyTasks, postponeDayTasks, findTodayDay, analyzeProgress } from "../src/services/aiCoachService.js";

// AI Koç'un TEK sunucu tarafı giriş noktası. Eskiden client (anon key) hem
// Gemini'yi doğrudan çağırıyor hem de tasks tablosunu doğrudan güncelliyordu
// (API anahtarı bundle'a gömülü + RLS'in izin verdiği her satırı/kolonu
// değiştirebiliyordu). Artık:
//   1) İstek JWT ile doğrulanır (Authorization: Bearer <access_token>).
//   2) Günlük hak (user_quotas) burada, service_role ile kontrol/düşürülür —
//      istemci localStorage'ı silerek hakkını sıfırlayamaz.
//   3) Tüm görev mutasyonları (lighten/intensify/postpone/freeText) service_role
//      ile, yalnızca doğrulanmış kullanıcıya ait plan/task'lar üzerinde yapılır.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Yalnızca POST desteklenir." });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ ok: false, consumed: false, message: "Oturum doğrulanamadı, tekrar giriş yapar mısın?" });
  }
  // AI Koç anonim (misafir) oturumlara TAMAMEN KAPALI — client tarafındaki
  // gate (AiCoachWidget.jsx) yalnızca UX'tir, GERÇEK sınır burasıdır: `is_anonymous`
  // JWT'den doğrulanır, client'ın gönderdiği hiçbir alana güvenilmez. "status"
  // dahil TÜM action'lar için geçerli — yarı-erişim yok.
  if (user.is_anonymous) {
    return res.status(403).json({ ok: false, consumed: false, message: "403 Forbidden - Login Required: AI Koç'u kullanmak için ücretsiz hesabını tamamlaman gerekiyor." });
  }

  const { action, message, targetPlanId } = req.body || {};
  if (!action) {
    return res.status(400).json({ ok: false, consumed: false, message: "'action' alanı zorunlu." });
  }

  // Admin durumu YALNIZCA JWT'den doğrulanmış `user.email`e göre, sunucu
  // tarafında hesaplanır (bkz. adminAccess.js dosya başı yorumu) — client
  // isteğinden gelen hiçbir alan bu kararı ETKİLEMEZ.
  const isAdmin = isAdminUser(user);

  try {
    if (action === "status") {
      if (isAdmin) return res.status(200).json({ ok: true, consumed: false, unlimited: true, remaining: null, trialLimit: null });
      const remaining = await getRemaining(user.id);
      return res.status(200).json({ ok: true, consumed: false, unlimited: false, remaining, trialLimit: TRIAL_LIMIT });
    }

    // Hak kontrolü — AI çağrısı/mutasyon yapılmadan ÖNCE (gereksiz maliyeti
    // önler); localStorage değil, tek gerçek kaynak burasıdır. Admin ise bu
    // kontrol tamamen atlanır.
    const remainingBefore = isAdmin ? Infinity : await getRemaining(user.id);
    if (!isAdmin && remainingBefore <= 0) {
      return res.status(403).json({
        ok: false,
        consumed: false,
        unlimited: false,
        remaining: 0,
        trialLimit: TRIAL_LIMIT,
        message: `AI Koç deneme limitin doldu. Sınırsız kullanım için Premium'a geç.`,
      });
    }

    const admin = getSupabaseAdmin();

    // Kullanıcının TÜM planları + görevleri — service_role RLS'i bypass ettiği
    // için burada MUTLAKA user_id ile manuel scoping yapılır.
    const [{ data: plans, error: plansErr }, { data: tasks, error: tasksErr }] = await Promise.all([
      admin.from("plans").select("*").eq("user_id", user.id),
      admin.from("tasks").select("*").eq("user_id", user.id),
    ]);
    if (plansErr || tasksErr) throw plansErr || tasksErr;

    const tasksByPlan = {};
    for (const t of tasks || []) (tasksByPlan[t.plan_id] = tasksByPlan[t.plan_id] || []).push(t);
    const allPlans = (plans || []).map((p) => ({ ...p, tasks: tasksByPlan[p.id] || [] }));

    if (allPlans.length === 0) {
      return res.status(200).json({ ok: false, consumed: false, message: "Önce bir plan açman gerekiyor." });
    }

    const result = await dispatch(action, { message, targetPlanId, allPlans, userId: user.id, admin });

    // NOT: `Infinity` JSON.stringify'da sessizce `null`a döner — bu yüzden
    // admin/sınırsız durumu ayrı bir `unlimited` bayrağıyla taşınır, asla
    // ham Infinity/remaining sayısı olarak DEĞİL.
    if (isAdmin) {
      result.unlimited = true;
      result.remaining = null;
      result.trialLimit = null;
    } else {
      result.unlimited = false;
      result.remaining = result.consumed ? await consumeOne(user.id) : remainingBefore;
      result.trialLimit = TRIAL_LIMIT;
    }
    return res.status(result.ok === false ? 400 : 200).json(result);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[coach-action] hata:", "status:", err?.status, err?.message, err?.stack);
    // "Beklenmedik bir sunucu yanıtı alındı." (frontend'in JSON-parse-edilemedi
    // fallback'i) ile KARIŞTIRILMASIN — bu, sunucunun GERÇEKTEN döndürdüğü,
    // geçerli bir JSON hata yanıtı. Gemini tarafında kota/bütçe tükenmişse
    // (429) kullanıcı bunu net görür, sunucu tarafındaki genel bir hatadan
    // ayırt edebilir.
    const { httpStatus, message } = classifyGeminiError(err);
    return res.status(httpStatus).json({ ok: false, consumed: false, message });
  }
}

// --- Yardımcılar ------------------------------------------------------------

function toWeeksShape(plansSubset) {
  const days = new Map();
  for (const p of plansSubset) {
    for (const t of p.tasks || []) {
      const d = t.day_number ?? 1;
      if (!days.has(d)) days.set(d, []);
      days.get(d).push(t);
    }
  }
  const dayList = [...days.entries()].sort((a, b) => a[0] - b[0]).map(([dayNumber, tasks]) => ({ dayNumber, tasks }));
  return [{ weekNumber: 1, days: dayList }];
}

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

async function dispatch(action, { message, targetPlanId, allPlans, userId, admin }) {
  if (action === "analyze") {
    const subset = targetPlanId ? allPlans.filter((p) => p.id === targetPlanId) : allPlans;
    return { ok: true, consumed: true, message: analyzeProgress(toWeeksShape(subset)) };
  }

  if (action === "freeText") {
    const aiResult = await runCoachIntent({ message, plans: allPlans });

    if (!aiResult.mutations.length && !aiResult.newTasks.length) {
      const unclear = aiResult.intent === "unclear";
      return { ok: true, consumed: !unclear, message: aiResult.reply };
    }

    const effectivePlanId = aiResult.targetPlanId || targetPlanId;
    const plan = allPlans.find((p) => p.id === effectivePlanId);
    if (!plan) {
      return { ok: true, consumed: false, message: aiResult.reply || "Hangi planı kastettiğini anlayamadım — plan seçiciden birini seçer misin?" };
    }

    // Güvenlik: AI'ın ürettiği task_id'lerin GERÇEKTEN bu plana ait olduğunu
    // doğrula (halüsinasyon/başka kullanıcı id'si sızıntısına karşı).
    const validIds = new Set(plan.tasks.map((t) => t.id));
    const patches = aiResult.mutations
      .filter((m) => m?.task_id && m?.fields && validIds.has(m.task_id))
      .map((m) => ({ id: m.task_id, fields: m.fields }));

    const mutatedTasks = await applyPatches(admin, patches);
    const newTasks = await insertNewTasks(admin, plan.id, userId, aiResult.newTasks);

    return { ok: true, consumed: true, message: aiResult.reply, targetPlanId: plan.id, mutatedTasks, newTasks };
  }

  // Hazır aksiyonlar (lighten/intensify/postponeToday) — client'ın ekranda
  // açık olan planını hedefler, bu yüzden targetPlanId zorunludur.
  const plan = allPlans.find((p) => p.id === targetPlanId);
  if (!plan) return { ok: false, consumed: false, message: "Plan bulunamadı." };

  let patches = [];
  let successMessage = "";

  if (action === "lighten") {
    patches = lightenTasks(plan.tasks);
    successMessage = "Anlaşıldı! Bugünkü görev yükünü %30 hafifletip süreleri güncelledim 🌿";
  } else if (action === "intensify") {
    patches = intensifyTasks(plan.tasks);
    successMessage = "Tempoyu sıkılaştırdım — görev süreleri kısaldı, öncelikler yükseldi. Hadi bakalım 🔥";
  } else if (action === "postponeToday") {
    const todayDay = findTodayDay(toWeeksShape([plan]));
    if (!todayDay || !todayDay.tasks.some((t) => !t.is_completed)) {
      return { ok: true, consumed: true, message: "Bugün için bekleyen görevin yok, harika gidiyorsun! ✅" };
    }
    patches = postponeDayTasks(todayDay);
    successMessage = "Bugünün kalan görevlerini yarına kaydırdım — kendine iyi bak, yarın devam ederiz ☕";
  } else {
    return { ok: false, consumed: false, message: `Bilinmeyen aksiyon: ${action}` };
  }

  if (patches.length === 0) {
    return { ok: true, consumed: true, message: "Şu an güncellenecek aktif bir görev bulamadım — plan zaten tamamlanmış görünüyor 🎉" };
  }

  const mutatedTasks = await applyPatches(admin, patches);
  return { ok: true, consumed: true, message: successMessage, targetPlanId: plan.id, mutatedTasks };
}
