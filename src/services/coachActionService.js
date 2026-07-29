import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

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

  let res;
  try {
    res = await fetch("/api/coach-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, message, targetPlanId }),
    });
  } catch (err) {
    logger.error("AI_COACH", "Sunucuya ulaşılamadı", { action, error: err?.message });
    return { ok: false, consumed: false, message: "Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dener misin?" };
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok && !body) {
    logger.error("AI_COACH", "Sunucu yanıtı çözümlenemedi", { action, status: res.status });
    return { ok: false, consumed: false, message: "Beklenmedik bir sunucu yanıtı alındı." };
  }

  if (!res.ok) {
    logger.warn("AI_COACH", "coach-action isteği başarısız", { action, status: res.status, message: body?.message });
  }

  return body;
}
