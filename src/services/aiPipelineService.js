import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// AI plan üretim pipeline'ının client tarafı — artık Gemini'yi DOĞRUDAN
// çağırmıyor (VITE_GEMINI_API_KEY tamamen kaldırıldı, tarayıcı bundle'ında
// hiçbir AI anahtarı yok). Bu dosya, tıpkı coachActionService.js gibi, JWT ile
// doğrulanmış tek bir sunucu endpoint'ine (/api/generate-plan) istek atan
// hafif bir proxy/wrapper'a dönüştü. Gerçek persona/prompt mantığı artık
// api/_lib/planPrompt.js'te (yalnızca sunucuda, process.env.GEMINI_API_KEY ile).
//
// Dışa açılan 3 fonksiyonun imzası (ve usePlanStudio.js'teki kullanımı)
// AYNEN korunmuştur — yalnızca içerideki taşıma mekanizması değişti.
async function callGeneratePlan(action, payload, label) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Devam etmek için giriş yapmalısın.");
  }

  logger.info("AI_PIPELINE", `${label} isteği gönderiliyor`);

  let res;
  try {
    res = await fetch("/api/generate-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
  } catch (err) {
    logger.error("AI_PIPELINE", `${label} başarısız oldu (sunucuya ulaşılamadı)`, { error: err?.message });
    throw new Error("Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dener misin?");
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || !body?.ok) {
    const message = body?.message || "Yapay zeka isteği başarısız oldu.";
    logger.error("AI_PIPELINE", `${label} başarısız oldu`, { status: res.status, message });
    throw new Error(message);
  }

  return body.data;
}

// { category, goal } -> [{ title, type: "choice"|"text", options: [str] }]
export async function generateOnboardingQuestions(payload) {
  return callGeneratePlan("onboarding_questions", payload, "Onboarding soruları üretimi");
}

// userInput: { category, goal, durationText?, startDate?, answers? }
// Dönüş: { plan_title, plan_summary, category, total_days, routines, first_week_tasks }
export async function createEnrichedPlan(payload) {
  return callGeneratePlan("create_plan", payload, "Plan oluşturma");
}

// args: { planTitle, planSummary, mode, targetWeekNumber }
// Dönüş: { week_number, week_tasks }
export async function fetchNextWeekTasks(payload) {
  return callGeneratePlan("next_week", payload, `${payload?.targetWeekNumber || "?"}. hafta üretimi`);
}
