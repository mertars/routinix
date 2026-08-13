import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// Freemium Gatekeeping — client tarafı yardımcıları. GERÇEK sınır DB
// katmanında (bkz. supabase/full_sync_migration.sql §18: user_entitlements +
// enforce_free_plan_limit trigger'ı) — buradaki PLAN_LIMIT yalnızca UI'da
// ("Plan Hakkı: 2/3" rozeti, paywall metni) göstermek için; trigger'daki
// `v_limit constant int := 3` İLE SENKRON tutulmalı, biri değişirse diğeri
// de değişmeli.
export const PLAN_LIMIT = 3;

// enforce_free_plan_limit() trigger'ının fırlattığı özel metin — Postgrest
// bunu error.message'a AYNEN yansıtır (bkz. o fonksiyondaki RAISE EXCEPTION).
const PLAN_LIMIT_MARKER = "LIMIT_REACHED_PLANS";

export function isPlanLimitError(error) {
  return Boolean(error?.message && String(error.message).includes(PLAN_LIMIT_MARKER));
}

// Rozet/paywall UI'ı için: kullanıcının kaç planı olduğunu (CANLI count —
// bkz. trigger'daki AYNI gerekçe, sayaç DRIFT riski yok) ve premium
// durumunu tek çağrıda getirir. RLS zaten yalnızca kendi satırlarını
// görmesine izin verdiğinden ayrı bir sunucu endpoint'i GEREKMEZ.
export async function fetchPlanUsage(userId) {
  if (!userId) return { count: 0, limit: PLAN_LIMIT, isPremium: false };

  const [{ count, error: countErr }, { data: entitlement, error: entErr }] = await Promise.all([
    supabase.from("plans").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("user_entitlements").select("is_premium").eq("user_id", userId).maybeSingle(),
  ]);

  if (countErr) logger.error("ENTITLEMENTS", "Plan sayısı okunamadı", { error: countErr.message });
  if (entErr) logger.error("ENTITLEMENTS", "Premium durumu okunamadı", { error: entErr.message });

  return {
    count: countErr ? 0 : count || 0,
    limit: PLAN_LIMIT,
    isPremium: Boolean(entitlement?.is_premium),
  };
}
