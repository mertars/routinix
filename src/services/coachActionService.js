import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// Sunucu fonksiyonundan (Vercel) daha erken, KONTROLLÜ bir zaman aşımı —
// Gemini bir ihtimal normalden uzun sürer/asılı kalırsa, kullanıcı platform
// seviyesindeki ham bir hata/timeout yanıtını (JSON OLMAYAN, "Beklenmedik
// bir sunucu yanıtı alındı." fallback'ini tetikleyen) beklemek yerine
// burada net bir "zaman aşımı" mesajı görür.
const REQUEST_TIMEOUT_MS = 25_000;

// AI Koç'un TEK client-side giriş noktası. Artık hiçbir AI çağrısı ya da
// tasks mutasyonu doğrudan tarayıcıdan yapılmıyor — hepsi JWT ile doğrulanmış
// /api/coach-action sunucu fonksiyonuna gidiyor (bkz. api/coach-action.js).
// action: "status" | "analyze" | "lighten" | "intensify" | "postponeToday" | "freeText"
export async function callCoachAction({ action, message, targetPlanId }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { ok: false, consumed: false, message: "Devam etmek için giriş yapmalısın." };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch("/api/coach-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, message, targetPlanId }),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    logger.error("AI_COACH", timedOut ? "İstek zaman aşımına uğradı" : "Sunucuya ulaşılamadı", { action, error: err?.message });
    return {
      ok: false,
      consumed: false,
      message: timedOut
        ? "Yapay zeka yanıt vermekte gecikti, lütfen tekrar dener misin?"
        : "Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dener misin?",
    };
  } finally {
    clearTimeout(timeoutId);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  // Sunucu (coach-action.js) artık HER durumda geçerli JSON döner (bkz.
  // api/_lib/aiErrors.js) — bu dal yalnızca gerçekten anormal bir durumda
  // (ör. Vercel platform seviyesinde bir hata sayfası, fonksiyon hiç
  // çalışmadı) tetiklenir; "AI Koç yanıt vermedi" gibi Gemini kaynaklı
  // hatalarla KARIŞTIRILMASIN diye ayrı, açık bir mesaj.
  if (!res.ok && !body) {
    logger.error("AI_COACH", "Sunucu yanıtı çözümlenemedi", { action, status: res.status });
    return { ok: false, consumed: false, message: "Sistem şu an hizmet veremiyor, lütfen birazdan tekrar dener misin?" };
  }

  if (!res.ok) {
    logger.warn("AI_COACH", "coach-action isteği başarısız", { action, status: res.status, message: body?.message });
  }

  return body;
}
