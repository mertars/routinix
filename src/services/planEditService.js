import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// Plan Studio & Editor Engine — mevcut bir planı düzenleyip kaydetmenin TEK
// client-side giriş noktası. coachActionService.js İLE AYNI desen: JWT ile
// /api/plan-edit sunucu fonksiyonuna gidilir (service_role, çünkü client'ın
// anon key'i tasks satırlarını silemiyor — bkz. api/_lib/planReplace.js).
// builder: ManualPlanBuilder.jsx'in yerel state'i (saveManualPlanToSupabase
// İLE AYNI şekil) — days/routines TAMAMEN bu haliyle yazılır.
// Döner: { plan, routines, tasks } — saveManualPlanToSupabase'in dönüşüyle
// AYNI şekil, usePlanStudio.saveManualPlan'ın iki yolu (yeni/düzenle) aynı
// state güncelleme kodunu paylaşabilsin diye.
export async function updateManualPlanInSupabase(planId, builder, userId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Devam etmek için giriş yapmalısın.");
  }

  let res;
  try {
    res = await fetch("/api/plan-edit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ planId, builder }),
    });
  } catch (err) {
    logger.error("PLAN_EDIT", "Sunucuya ulaşılamadı", { planId, error: err?.message });
    throw new Error("Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dener misin?");
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || !body?.ok) {
    const message = body?.message || "Plan güncellenirken bir sorun oluştu. Tekrar dener misin?";
    logger.error("PLAN_EDIT", "Plan güncellenemedi", { planId, userId, status: res.status, message });
    throw new Error(message);
  }

  return { plan: body.plan, routines: body.routines || [], tasks: body.tasks || [] };
}
