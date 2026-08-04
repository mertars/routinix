import { getSupabaseAdmin } from "./supabaseAdmin.js";

// Basit, sunucu tarafı "soğuma süresi" — PAHALI (Gemini çağrısı yapan) bir
// uç noktanın bir kullanıcı tarafından art arda/döngüyle çağrılmasını
// engeller. AI Koç'un user_ai_trial'ından (quota.js) KASITLI olarak FARKLI:
// o gerçek bir ömür-boyu "hak" sayacı; bu yalnızca "çok hızlı art arda"
// isteği reddeder — normal kullanım hızında (kullanıcı bir yanıtı bekleyip
// sonra bir sonraki adıma geçtiği için) görünmez, yalnızca bir spam
// döngüsünü/scripti ilk birkaç denemede durdurur. Bkz.
// supabase/ai_generation_cooldown.sql (public.user_ai_cooldown tablosu).
//
// Döner: true = izin verildi (ve son çağrı zamanı güncellendi), false =
// henüz soğumadı (çağıran 429 dönmeli, DB'ye/Gemini'ye HİÇ gidilmemeli).
export async function checkCooldown(userId, minMs = 3000) {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("user_ai_cooldown").select("last_call_at").eq("user_id", userId).maybeSingle();

  const now = Date.now();
  if (data && now - new Date(data.last_call_at).getTime() < minMs) {
    return false;
  }

  await admin.from("user_ai_cooldown").upsert({ user_id: userId, last_call_at: new Date().toISOString() });
  return true;
}
