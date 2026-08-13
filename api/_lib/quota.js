import { getSupabaseAdmin } from "./supabaseAdmin.js";

// AI Koç ÖMÜR BOYU deneme hakkı — SUNUCU TARAFI, service_role ile.
// Eski sistem (user_quotas) GÜNLÜK sıfırlanıyordu (100/gün) — bu, iç
// test/tanıtım döneminde "herkes kota'ya takılmasın" diye bilinçli bir
// gevşetmeydi. Proje artık dışa açılıyor: gerçek bir freemium modeli
// gerekiyor — kullanıcı başına TOPLAM TRIAL_LIMIT mesaj, hiç sıfırlanmaz.
// Bkz. supabase/ai_trial_limit.sql (yeni public.user_ai_trial tablosu +
// increment_user_trial_usage RPC'si — bu SQL'in Supabase'de çalıştırılmış
// olması GEREKİR, aksi halde aşağıdaki fallback yola düşülür).
//
// Pre-launch freemium kararı: 20 → 15 (bkz. entitlements.js — Premium
// kullanıcılar zaten bu sayaca HİÇ takılmaz, aşağıdaki `isUnlimited`
// parametresi buna admin İLE AYNI şekilde bakar).
export const TRIAL_LIMIT = 15;

// Kullanıcının satırını getirir; yoksa 0 kullanımla oluşturur. Döner: kalan hak.
// `isUnlimited` true ise (admin E-POSTA allowlist'i VEYA user_entitlements.
// is_premium — ikisi de çağıran tarafta, bkz. coach-action.js, birleştirilip
// TEK bayrak olarak buraya geçilir) veritabanına hiç gitmeden Infinity
// döner — sayaç hiç oluşturulmaz/tüketilmez.
export async function getRemaining(userId, isUnlimited = false) {
  if (isUnlimited) return Infinity;

  const admin = getSupabaseAdmin();

  const { data: existing, error: selErr } = await admin
    .from("user_ai_trial")
    .select("messages_used")
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return Math.max(0, TRIAL_LIMIT - existing.messages_used);

  const { error: insErr } = await admin.from("user_ai_trial").insert({ user_id: userId, messages_used: 0 });
  if (insErr) throw insErr;
  return TRIAL_LIMIT;
}

// Başarılı bir aksiyondan SONRA çağrılır — kullanımı 1 artırır (ömür boyu
// toplam). Yarış durumuna karşı DB seviyesinde koşullu update kullanır.
// Döner: artıştan sonraki kalan hak.
export async function consumeOne(userId, isUnlimited = false) {
  if (isUnlimited) return Infinity;

  const admin = getSupabaseAdmin();

  // Satır yoksa önce oluştur.
  await getRemaining(userId);

  const { data, error } = await admin.rpc("increment_user_trial_usage", {
    p_user_id: userId,
    p_trial_limit: TRIAL_LIMIT,
  });
  if (!error && typeof data === "number") return Math.max(0, TRIAL_LIMIT - data);

  // rpc fonksiyonu henüz kurulmadıysa (bkz. ai_trial_limit.sql) güvenli bir
  // fallback: satırı oku, limitin üstüne çıkarmadan manuel artır.
  const { data: row, error: readErr } = await admin.from("user_ai_trial").select("messages_used").eq("user_id", userId).single();
  if (readErr) throw readErr;

  const nextUsed = Math.min(TRIAL_LIMIT, row.messages_used + 1);
  const { error: updErr } = await admin
    .from("user_ai_trial")
    .update({ messages_used: nextUsed, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (updErr) throw updErr;
  return Math.max(0, TRIAL_LIMIT - nextUsed);
}
