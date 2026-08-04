import { getSupabaseAdmin } from "./supabaseAdmin.js";

// AI plan üretimi (api/generate-plan.js) için çok katmanlı hız sınırlama —
// hem kullanıcı bazlı (RPM/RPH/RPD) hem sistem geneli (Global Günlük Tavan).
// Tek doğruluk kaynağı: public.api_request_log (bkz. supabase/plan_rate_limit.sql).
//
// SAYIM BİRİMİ: burada sayılan "istek", generate-plan.js'in ÜÇ action'ından
// (onboarding_questions/create_plan/next_week) HERHANGİ biri — yani GERÇEK
// bir Gemini çağrısı. "Planlama" (kullanıcıya gösterilen kavram — "Planla"
// butonuna basmak) tek bir eylem olarak CALLS_PER_PLAN_ACTION kadar istek
// tüketir; limitler bu yüzden çift (6 istek = 3 planlama vb.) tanımlanır.
export const RPM_LIMIT = 6;
export const RPH_LIMIT = 20;
export const RPD_LIMIT = 50;
export const GLOBAL_DAILY_CAP = 1000;
export const CALLS_PER_PLAN_ACTION = 2;

function utcDayStartIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

async function countSince(admin, isoSince, userId) {
  let query = admin.from("api_request_log").select("id", { count: "exact", head: true }).gte("created_at", isoSince);
  if (userId) query = query.eq("user_id", userId);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

// Döner: { allowed: true } YA DA { allowed: false, message, retryAfterSec }.
// GÜVENLİK NOTU: en PAHALI/en geniş kapsamlı kontrol (Global Tavan) İLK
// kontrol edilir — sistem geneli bütçe zaten tükenmişse, tek bir kullanıcının
// kendi (belki hâlâ boş) RPM/RPH/RPD hakkını sorgulamaya bile gerek yok.
//
// FAIL-OPEN, ÇÖKMEZ: bu fonksiyonun KENDİSİ (ör. supabase/plan_rate_limit.sql
// henüz çalıştırılmadıysa "api_request_log tablosu yok" hatası, ya da geçici
// bir DB bağlantı sorunu) bir istisna fırlatırsa, generate-plan.js'i
// FUNCTION_INVOCATION_FAILED ile çökertmek YERİNE isteğe İZİN VERİLİR (hata
// sunucu logunda kalır). Bir alt-sistem arızası, meşru bir kullanıcıyı
// planlamaktan alıkoymamalı — bu, kullanıcının kendi hakkını AŞMASINDAN
// (o durumda bilerek `allowed: false` dönülür) TAMAMEN farklı bir senaryu.
export async function checkPlanRateLimit(userId) {
  try {
    const admin = getSupabaseAdmin();
    const now = Date.now();
    const minuteAgo = new Date(now - 60_000).toISOString();
    const hourAgo = new Date(now - 60 * 60_000).toISOString();
    const dayStart = utcDayStartIso();

    const globalDayCount = await countSince(admin, dayStart, null);
    if (globalDayCount >= GLOBAL_DAILY_CAP) {
      return { allowed: false, message: "Sistem şu anda yoğun talep altında, lütfen daha sonra tekrar deneyin.", retryAfterSec: 3600 };
    }

    const [minuteCount, hourCount, dayCount] = await Promise.all([
      countSince(admin, minuteAgo, userId),
      countSince(admin, hourAgo, userId),
      countSince(admin, dayStart, userId),
    ]);

    if (dayCount >= RPD_LIMIT) {
      return { allowed: false, message: "Günlük planlama limitinize ulaştınız.", retryAfterSec: 86400 };
    }
    if (hourCount >= RPH_LIMIT) {
      return { allowed: false, message: "Saatlik planlama limitinize ulaştınız.", retryAfterSec: 3600 };
    }
    if (minuteCount >= RPM_LIMIT) {
      return { allowed: false, message: "Çok hızlı istek gönderdiniz, lütfen 1 dakika bekleyin.", retryAfterSec: 60 };
    }

    return { allowed: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[planRateLimit] checkPlanRateLimit başarısız (fail-open, istek engellenmedi):", err?.message);
    return { allowed: true };
  }
}

// Rate-limit kontrolü GEÇTİKTEN, ama gerçek Gemini çağrısından ÖNCE çağrılır
// (bkz. api/generate-plan.js) — "önce rezervasyon, sonra pahalı iş" sırası,
// eşzamanlı iki isteğin ikisinin de aynı anda kontrolü geçip limiti aşmasını
// (küçük bir yarış penceresi dışında) pratik olarak engeller.
//
// BİLEREK sessizce yutar (throw ETMEZ): bir sayaç satırının yazılamaması
// (ör. tablo henüz yok) ikincil bir bookkeeping sorunu — asıl plan üretim
// isteğini ASLA kesmemeli/çökertmemeli.
export async function logApiRequest(userId, endpoint = "generate-plan") {
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("api_request_log").insert({ user_id: userId, endpoint });
    if (error) throw error;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[planRateLimit] logApiRequest başarısız (yok sayıldı):", err?.message);
  }
}
