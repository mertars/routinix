import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// Sunucu fonksiyonundan (Vercel) daha erken, KONTROLLÜ bir zaman aşımı —
// coachActionService.js'teki AYNI gerekçe: Gemini asılı kalırsa, kullanıcı
// platform seviyesindeki ham bir hata yanıtını beklemek yerine net bir
// "zaman aşımı" mesajı görür. Plan üretimi (özellikle create_plan) diğer
// AI çağrılarından biraz daha uzun sürebildiği için süre biraz daha geniş.
const REQUEST_TIMEOUT_MS = 35_000;

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch("/api/generate-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    logger.error("AI_PIPELINE", `${label} başarısız oldu (${timedOut ? "zaman aşımı" : "sunucuya ulaşılamadı"})`, { error: err?.message });
    throw new Error(timedOut ? "Yapay zeka yanıt vermekte gecikti, lütfen tekrar dener misin?" : "Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dener misin?");
  } finally {
    clearTimeout(timeoutId);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || !body?.ok) {
    // Sunucu (generate-plan.js) artık HER durumda geçerli JSON döner (bkz.
    // api/_lib/aiErrors.js) — `body` yalnızca gerçekten anormal bir
    // durumda (ör. Vercel platform seviyesinde bir hata sayfası) null olur.
    const message = body?.message || "Sistem şu an hizmet veremiyor, lütfen birazdan tekrar dener misin?";
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
