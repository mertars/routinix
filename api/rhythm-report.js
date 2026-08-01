import { getSupabaseAdmin, getUserFromRequest } from "./_lib/supabaseAdmin.js";
import { generateRhythmReport } from "./_lib/rhythmPrompt.js";
import { findTodayDay, postponeDayTasks } from "../src/services/aiCoachService.js";

// "Rhythm & Insights" modülünün TEK sunucu tarafı giriş noktası — desen
// api/coach-action.js ile birebir aynı: JWT doğrulama, service_role ile
// yalnızca doğrulanmış kullanıcıya ait plan/task'lar üzerinde çalışma.
//
// "Bugün" kavramı: mevcut uygulamada takvim tarihine bağlı bir görev
// zamanlaması YOK (tasks.day_number, plana göreceli). Bu yüzden AI Koç'un
// zaten kullandığı findTodayDay/postponeDayTasks (src/services/aiCoachService.js)
// aynen burada da kullanılır — YALNIZCA TEK bir plan için değil, kullanıcının
// TÜM aktif planları için ayrı ayrı çalıştırılıp toplanır.
function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC) — user_quotas ile aynı yaklaşım
}

function toWeeksShape(planTasks) {
  const days = new Map();
  for (const t of planTasks || []) {
    const d = t.day_number ?? 1;
    if (!days.has(d)) days.set(d, []);
    days.get(d).push(t);
  }
  return [...days.entries()].sort((a, b) => a[0] - b[0]).map(([dayNumber, tasks]) => ({ dayNumber, tasks }));
}

async function fetchPlansWithTasks(admin, userId) {
  const [{ data: plans, error: plansErr }, { data: tasks, error: tasksErr }] = await Promise.all([
    admin.from("plans").select("*").eq("user_id", userId),
    admin.from("tasks").select("*").eq("user_id", userId),
  ]);
  if (plansErr || tasksErr) throw plansErr || tasksErr;
  const tasksByPlan = {};
  for (const t of tasks || []) (tasksByPlan[t.plan_id] = tasksByPlan[t.plan_id] || []).push(t);
  return (plans || []).map((p) => ({ ...p, tasks: tasksByPlan[p.id] || [] }));
}

// Her planın kendi "bugün"ünü bulur (findTodayDay), tüm planlardaki bugünün
// görevlerini tek bir listede toplar. Planı boş (hiç görevi yüklenmemiş) olan
// planlar atlanır.
function collectTodayAcrossPlans(plans) {
  const entries = [];
  for (const p of plans) {
    if (!p.tasks.length) continue;
    const day = findTodayDay(toWeeksShape(p.tasks));
    if (day) entries.push({ plan: p, day });
  }
  return entries;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Yalnızca POST desteklenir." });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ ok: false, message: "Oturum doğrulanamadı, tekrar giriş yapar mısın?" });
  }

  const { action, lapsedRoutineTitles } = req.body || {};
  if (!action) {
    return res.status(400).json({ ok: false, message: "'action' alanı zorunlu." });
  }

  const admin = getSupabaseAdmin();
  const dateStr = todayDate();

  try {
    if (action === "generate") {
      // Bugünün odaklanma (Pomodoro) süresi — focus_sessions'tan, gün UTC
      // sınırlarıyla. Plan/task sorgusundan BAĞIMSIZ (ikisi de yalnızca
      // user.id/dateStr'ye ihtiyaç duyar) — sıralı await yerine Promise.all
      // ile PARALEL çekilir, sunucu gecikmesini tek bir round-trip'e indirir.
      const dayStart = `${dateStr}T00:00:00.000Z`;
      const dayEnd = `${dateStr}T23:59:59.999Z`;
      const [plans, sessionsRes] = await Promise.all([
        fetchPlansWithTasks(admin, user.id),
        admin.from("focus_sessions").select("duration_min").eq("user_id", user.id).gte("started_at", dayStart).lte("started_at", dayEnd),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      const focusMinutesToday = (sessionsRes.data || []).reduce((n, s) => n + (s.duration_min || 0), 0);

      const todayEntries = collectTodayAcrossPlans(plans);

      let completedTasks = 0;
      let totalTasks = 0;
      for (const { day } of todayEntries) {
        totalTasks += day.tasks.length;
        completedTasks += day.tasks.filter((t) => t.is_completed).length;
      }

      const stats = {
        completedTasks,
        totalTasks,
        focusMinutesToday,
        activePlanCount: plans.length,
        // Rutin check-in durumu yalnızca client'ta (localStorage) tutulur —
        // sunucunun buna erişimi yok. Yalnızca AI'ın metin/ton bağlamı için
        // kullanılır, hiçbir sayısal alanda güvenilmez/doğrulanmaz.
        lapsedRoutineTitles: Array.isArray(lapsedRoutineTitles) ? lapsedRoutineTitles.slice(0, 20).map(String) : [],
      };

      const { summary, tomorrowFocus } = await generateRhythmReport({ stats });

      const { data: report, error: upsertErr } = await admin
        .from("daily_reports")
        .upsert(
          { user_id: user.id, report_date: dateStr, summary_text: summary, tomorrow_focus: tomorrowFocus, stats, updated_at: new Date().toISOString() },
          { onConflict: "user_id,report_date" }
        )
        .select()
        .single();
      if (upsertErr) throw upsertErr;

      return res.status(200).json({ ok: true, report });
    }

    if (action === "endDay") {
      const plans = await fetchPlansWithTasks(admin, user.id);
      const todayEntries = collectTodayAcrossPlans(plans);

      const patches = todayEntries.flatMap(({ day }) => postponeDayTasks(day));

      let mutatedTasks = [];
      if (patches.length > 0) {
        mutatedTasks = await Promise.all(
          patches.map(async ({ id, fields }) => {
            const { data, error } = await admin.from("tasks").update(fields).eq("id", id).select().single();
            if (error) throw error;
            return data;
          })
        );
      }

      // Bugünün raporu zaten üretildiyse, kaç görevin ertelendiğini üzerine yaz
      // (rapor yoksa sorun değil — yalnızca erteleme yapılır, rapor zorunlu değil).
      const { data: existingReport } = await admin
        .from("daily_reports")
        .select("id")
        .eq("user_id", user.id)
        .eq("report_date", dateStr)
        .maybeSingle();
      if (existingReport) {
        await admin
          .from("daily_reports")
          .update({ rescheduled_count: patches.length, updated_at: new Date().toISOString() })
          .eq("id", existingReport.id);
      }

      return res.status(200).json({
        ok: true,
        rescheduledCount: patches.length,
        mutatedTasks,
        message:
          patches.length > 0
            ? `${patches.length} görevi yarına kaydırdım — kendine iyi bak, yarın hafif adımlarla devam ediyoruz 🌙`
            : "Bugün için ertelenecek bir şey yok, harika gidiyorsun! ✅",
      });
    }

    return res.status(400).json({ ok: false, message: `Bilinmeyen aksiyon: ${action}` });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[rhythm-report] hata:", err?.message, err?.stack);
    return res.status(500).json({ ok: false, message: "Sunucu tarafında beklenmedik bir hata oluştu." });
  }
}
