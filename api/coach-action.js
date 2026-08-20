import { getSupabaseAdmin, getUserFromRequest } from "./_lib/supabaseAdmin.js";
import { getRemaining, consumeOne, TRIAL_LIMIT } from "./_lib/quota.js";
import { isAdminUser } from "./_lib/adminAccess.js";
import { isPremiumUser } from "./_lib/entitlements.js";
import { runCoachIntent } from "./_lib/coachPrompt.js";
import { classifyGeminiError } from "./_lib/aiErrors.js";
import { matchDeterministicIntent } from "./_lib/ruleEngine.js";
import { applyPlanDelta } from "./_lib/planDelta.js";
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

  if (!process.env.GEMINI_API_KEY) {
    // eslint-disable-next-line no-console
    console.error("GEMINI_API_KEY missing");
    return res.status(500).json({ ok: false, consumed: false, message: "Sunucu yapılandırma hatası: yapay zeka servisi kullanılamıyor." });
  }

  // FUNCTION_INVOCATION_FAILED SERTLEŞTİRMESİ: getUserFromRequest ve
  // isAdminUser ÖNCEDEN try/catch DIŞINDAYDI — biri (ör. eksik Supabase env
  // değişkeni) fırlatırsa, Vercel fonksiyonu JSON DEĞİL ham bir hata
  // sayfasıyla öldürüyordu (istemci "Beklenmedik bir sunucu yanıtı alındı."
  // görüyordu). Artık TÜM handler gövdesi TEK bir try/catch içinde.
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ ok: false, consumed: false, message: "Oturum doğrulanamadı, tekrar giriş yapar mısın?" });
    }
    // AI Koç anonim (misafir) oturumlara TAMAMEN KAPALI — client tarafındaki
    // gate (AiCoachWidget.jsx) yalnızca UX'tir, GERÇEK sınır burasıdır:
    // `is_anonymous` JWT'den doğrulanır, client'ın gönderdiği hiçbir alana
    // güvenilmez. "status" dahil TÜM action'lar için geçerli — yarı-erişim yok.
    if (user.is_anonymous) {
      return res.status(403).json({ ok: false, consumed: false, message: "403 Forbidden - Login Required: AI Koç'u kullanmak için ücretsiz hesabını tamamlaman gerekiyor." });
    }

    const { action, message, targetPlanId } = req.body || {};
    if (!action) {
      return res.status(400).json({ ok: false, consumed: false, message: "'action' alanı zorunlu." });
    }

    // Admin durumu YALNIZCA JWT'den doğrulanmış `user.email`e göre, sunucu
    // tarafında hesaplanır (bkz. adminAccess.js dosya başı yorumu) — client
    // isteğinden gelen hiçbir alan bu kararı ETKİLEMEZ. Premium durumu da
    // AYNI şekilde yalnızca sunucuda, user_entitlements'tan (bkz.
    // entitlements.js) okunur — ikisi birleşip TEK "sınırsız" bayrağı olur,
    // quota.js'in tek bildiği şey budur (admin/premium ayrımını bilmesine
    // gerek yok).
    const isAdmin = isAdminUser(user);
    const isUnlimited = isAdmin || (await isPremiumUser(user.id));

    if (action === "status") {
      if (isUnlimited) return res.status(200).json({ ok: true, consumed: false, unlimited: true, remaining: null, trialLimit: null });
      const remaining = await getRemaining(user.id);
      return res.status(200).json({ ok: true, consumed: false, unlimited: false, remaining, trialLimit: TRIAL_LIMIT });
    }

    // Hak kontrolü — AI çağrısı/mutasyon yapılmadan ÖNCE (gereksiz maliyeti
    // önler); localStorage değil, tek gerçek kaynak burasıdır. Admin/premium
    // ise bu kontrol tamamen atlanır.
    const remainingBefore = isUnlimited ? Infinity : await getRemaining(user.id);
    if (!isUnlimited && remainingBefore <= 0) {
      return res.status(403).json({
        ok: false,
        consumed: false,
        unlimited: false,
        remaining: 0,
        trialLimit: TRIAL_LIMIT,
        code: "LIMIT_REACHED_AI_MESSAGES",
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
    // admin/premium sınırsız durumu ayrı bir `unlimited` bayrağıyla taşınır,
    // asla ham Infinity/remaining sayısı olarak DEĞİL.
    if (isUnlimited) {
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
    console.error("Gemini Error Details:", { source: "coach-action", status: err?.status, message: err?.message, stack: err?.stack });
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

// applyPatches/insertNewTasks/deleteTasks/updatePlanTotalDays artık BURADA
// DEĞİL — planDelta.js'in applyPlanDelta()'sına toparlandı (Delta Update
// Engine, bkz. o dosyanın başındaki yorum).

async function dispatch(action, { message, targetPlanId, allPlans, userId, admin }) {
  if (action === "analyze") {
    const subset = targetPlanId ? allPlans.filter((p) => p.id === targetPlanId) : allPlans;
    return { ok: true, consumed: true, message: analyzeProgress(toWeeksShape(subset)) };
  }

  if (action === "freeText") {
    // Zero-AI Rule Engine: mesaj zaten var olan bir hazır aksiyonla (lighten/
    // intensify/postponeToday/analyze) BİREBİR eşleşiyorsa Gemini'ye HİÇ
    // gitmeden, o aksiyonu (aşağıdaki, ZATEN deterministik dala) devreder —
    // 0 TL maliyet, ağ round-trip'i yok. Quick-action butonlarıyla TUTARLILIK
    // için (onlar da zaten deterministik ama YİNE DE trial hakkı düşürüyor)
    // consumed davranışı aynı kalır — kullanıcı deneyimi açısından "AI Koç'a
    // yazdım, işlemi yaptı" ile "butona bastım, işlemi yaptı" arasında fark
    // yaratmamak bilinçli bir tercih (bkz. ruleEngine.js dosya başı yorumu).
    const ruleMatch = matchDeterministicIntent(message);
    if (ruleMatch) {
      return dispatch(ruleMatch, { targetPlanId, allPlans, userId, admin });
    }

    // targetPlanId: widget'ın "Konuştuğun Plan" seçicisinden gelen, İSTEMCİNİN
    // ZATEN BİLDİĞİ hedef — AI'a bir tahmin olarak DEĞİL, doğrudan bağlam
    // olarak verilir (bkz. coachPrompt.js). Önceden buraya hiç geçmiyordu,
    // bu yüzden AI her mesajda planlar arasında körlemesine seçim yapmaya
    // çalışıyor, emin olamayınca da sürekli "hangi planı kastettin?" diye
    // sorup duruyordu.
    const aiResult = await runCoachIntent({ message, plans: allPlans, selectedPlanId: targetPlanId });

    const hasTaskLevelChanges = aiResult.mutations.length || aiResult.newTasks.length || aiResult.deletedTaskIds.length;
    const hasChanges = hasTaskLevelChanges || aiResult.planTotalDays;

    // KOD SEVİYESİNDE DÜRÜSTLÜK ZORLAMASI (2026-08-20, canlıda doğrulandı,
    // İKİ AŞAMADA): coachPrompt.js'e yalnızca PROMPT talimatıyla güvenmek
    // yetersiz kaldı — model reply metninde "yaptım" derken mutations boş
    // dönmeye devam etti. İlk düzeltme (yalnızca `!hasChanges` kontrolü) DE
    // yetersiz çıktı: model göremediği görevlere DOKUNMADAN yalnızca
    // `plan_total_days`'i küçültüyordu (ör. 84->42) — bu TEK BAŞINA
    // `hasChanges`'i true yapıp applyPlanDelta'ya giriyor ve planı BOZUYORDU
    // (total_days küçülüyor ama yeni sınırın ötesindeki onlarca görev
    // askıda/erişilemez kalıyor, gerçek testte doğrulandı). Bu yüzden kontrol
    // `hasTaskLevelChanges`'e (mutations/newTasks/deletedTaskIds) bakıyor —
    // eylem gerektiren bir intent'te göremediği bir plan için TEK BAŞINA
    // planTotalDays değiştirmek de YETERSİZ/GÜVENSİZ sayılır.
    const ACTION_INTENTS = new Set(["lighten", "intensify", "postpone", "add_task", "delete_task", "resize_plan"]);
    if (aiResult.visibilityLimited && ACTION_INTENTS.has(aiResult.intent) && !hasTaskLevelChanges) {
      return {
        ok: true,
        consumed: true,
        message: `Bu plan şu an tek seferde işleyebileceğimden daha büyük (${aiResult.totalTaskCount} görev) — bu yüzden bu kadar geniş kapsamlı bir değişikliği güvenle yapamadım. Daha dar bir kapsamda (ör. "ilk 4 hafta" gibi) tekrar ister misin?`,
        targetPlanId: aiResult.targetPlanId || null,
      };
    }

    if (!hasChanges) {
      const unclear = aiResult.intent === "unclear";
      return { ok: true, consumed: !unclear, message: aiResult.reply, targetPlanId: aiResult.targetPlanId || null };
    }

    const effectivePlanId = aiResult.targetPlanId || targetPlanId;
    const plan = allPlans.find((p) => p.id === effectivePlanId);
    if (!plan) {
      return { ok: true, consumed: false, message: aiResult.reply || "Hangi planı kastettiğini anlayamadım — plan seçiciden birini seçer misin?" };
    }

    // Delta Update Engine: AI'ın döndürdüğü delta (mutations/newTasks/
    // deletedTaskIds/planTotalDays) tek bir yerde, id doğrulamasıyla
    // birlikte uygulanır (bkz. planDelta.js).
    const delta = await applyPlanDelta(admin, plan, userId, aiResult);

    return { ok: true, consumed: true, message: aiResult.reply, targetPlanId: plan.id, ...delta };
  }

  // Hazır aksiyonlar (lighten/intensify/postponeToday) — client'ın ekranda
  // açık olan planını hedefler, bu yüzden targetPlanId zorunludur. Rule
  // Engine eşleşmeleri de (yukarıdaki freeText dalı) BURAYA yönlenir.
  const plan = allPlans.find((p) => p.id === targetPlanId);
  if (!plan) return { ok: false, consumed: false, message: "Plan bulunamadı." };

  let mutations = [];
  let successMessage = "";

  if (action === "lighten") {
    mutations = lightenTasks(plan.tasks).map(({ id, fields }) => ({ task_id: id, fields }));
    successMessage = "Anlaşıldı! Bugünkü görev yükünü %30 hafifletip süreleri güncelledim 🌿";
  } else if (action === "intensify") {
    mutations = intensifyTasks(plan.tasks).map(({ id, fields }) => ({ task_id: id, fields }));
    successMessage = "Tempoyu sıkılaştırdım — görev süreleri kısaldı, öncelikler yükseldi. Hadi bakalım 🔥";
  } else if (action === "postponeToday") {
    const todayDay = findTodayDay(toWeeksShape([plan]));
    if (!todayDay || !todayDay.tasks.some((t) => !t.is_completed)) {
      return { ok: true, consumed: true, message: "Bugün için bekleyen görevin yok, harika gidiyorsun! ✅" };
    }
    mutations = postponeDayTasks(todayDay).map(({ id, fields }) => ({ task_id: id, fields }));
    successMessage = "Bugünün kalan görevlerini yarına kaydırdım — kendine iyi bak, yarın devam ederiz ☕";
  } else {
    return { ok: false, consumed: false, message: `Bilinmeyen aksiyon: ${action}` };
  }

  if (mutations.length === 0) {
    return { ok: true, consumed: true, message: "Şu an güncellenecek aktif bir görev bulamadım — plan zaten tamamlanmış görünüyor 🎉" };
  }

  const { mutatedTasks } = await applyPlanDelta(admin, plan, userId, { mutations });
  return { ok: true, consumed: true, message: successMessage, targetPlanId: plan.id, mutatedTasks };
}
