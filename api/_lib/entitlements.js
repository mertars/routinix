import { getSupabaseAdmin } from "./supabaseAdmin.js";

// Premium/ücretsiz durumu — SUNUCU TARAFI, service_role ile okunur (bkz.
// supabase/full_sync_migration.sql §18 user_entitlements + is_user_premium()).
// Gerçek ödeme sağlayıcısı (Stripe vb.) bağlanana kadar bu tabloya YALNIZCA
// service_role yazabilir — client kendi kendine premium açamaz.
//
// FAIL-CLOSED (BİLEREK, diğer dosyalardaki fail-OPEN'ların TERSİ): bir
// hata/erişilemezlik durumunda `false` (ücretsiz kullanıcı) varsayılır,
// `true` DEĞİL. planRateLimit.js/quota.js'teki fail-open ilkesi "meşru bir
// kullanıcıyı yanlışlıkla ENGELLEME" riskini önceliklendirir — burada ise
// tersi risk (bir hata sonucu birine YANLIŞLIKLA ücretsiz sınırsız premium
// erişim VERMEK) çok daha ciddi bir gelir/güvenlik sorunu; ücretsiz
// kullanıcı deneyimi zaten TAM kullanılabilir (yalnızca 3 plan/15 mesaj
// sınırına tabi), bu yüzden "false" varsayımı kimseyi gerçekten ENGELLEMEZ.
export async function isPremiumUser(userId) {
  if (!userId) return false;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("user_entitlements").select("is_premium").eq("user_id", userId).maybeSingle();
    if (error || !data) return false;
    return Boolean(data.is_premium);
  } catch {
    return false;
  }
}
