import { getSupabaseAdmin } from "./supabaseAdmin.js";

// AI Koç günlük hak motoru — SUNUCU TARAFI. Eskiden localStorage'da tutulan
// sayaç, kullanıcı DevTools'tan localStorage.clear()/manuel silme ile
// sıfırlanabildiği için güvensizdi. Artık tek kaynak public.user_quotas
// tablosu; yalnızca bu dosya (service_role ile) yazabilir.
export const DAILY_LIMIT = 3;

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Bugünün satırını getirir; yoksa DAILY_LIMIT ile oluşturur. Döner: kalan hak.
// `isAdmin` true ise (bkz. adminAccess.js — YALNIZCA JWT'den doğrulanmış
// user.email'e göre sunucu tarafında hesaplanır) veritabanına hiç gitmeden
// Infinity döner — admin hesapları için günlük sayaç hiç oluşturulmaz/tüketilmez.
export async function getRemaining(userId, isAdmin = false) {
  if (isAdmin) return Infinity;

  const admin = getSupabaseAdmin();
  const date = todayDate();

  const { data: existing, error: selErr } = await admin
    .from("user_quotas")
    .select("remaining_usage")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.remaining_usage;

  const { data: created, error: insErr } = await admin
    .from("user_quotas")
    .insert({ user_id: userId, date, remaining_usage: DAILY_LIMIT })
    .select("remaining_usage")
    .single();
  if (insErr) throw insErr;
  return created.remaining_usage;
}

// Başarılı bir aksiyondan SONRA çağrılır — hakkı 1 azaltır. Yarış durumuna
// (aynı anda iki istek) karşı DB seviyesinde koşullu update kullanır: yalnızca
// remaining_usage > 0 iken düşer, aksi halde satırı olduğu gibi bırakır.
// Döner: düşümden sonraki kalan hak.
export async function consumeOne(userId, isAdmin = false) {
  if (isAdmin) return Infinity;

  const admin = getSupabaseAdmin();
  const date = todayDate();

  // Satır yoksa önce oluştur (limit ile).
  await getRemaining(userId);

  const { data, error } = await admin.rpc("decrement_user_quota", { p_user_id: userId, p_date: date });
  if (!error && typeof data === "number") return data;

  // rpc fonksiyonu henüz kurulmadıysa (bkz. migration.sql) güvenli bir
  // fallback: satırı oku, 0'ın altına düşürmeden manuel azalt.
  const { data: row, error: readErr } = await admin
    .from("user_quotas")
    .select("remaining_usage")
    .eq("user_id", userId)
    .eq("date", date)
    .single();
  if (readErr) throw readErr;

  const next = Math.max(0, row.remaining_usage - 1);
  const { error: updErr } = await admin
    .from("user_quotas")
    .update({ remaining_usage: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("date", date);
  if (updErr) throw updErr;
  return next;
}
