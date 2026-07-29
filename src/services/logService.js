import { supabase } from "../lib/supabaseClient";

// logger.js'in sendToExternalService placeholder'ının kalıcı hedefi: warn/error
// seviyesindeki loglar burada public.logs tablosuna yazılır (bkz. migration.sql
// bölüm 6). Ağır bir servise (Sentry vb.) ihtiyaç duymadan mevcut Supabase
// altyapısını kullanır — basit bir "hata geçmişi" için yeterlidir.
//
// GÜVENLİK/SPAM KORUMASI (Rate Limiter + Debounce + Circuit Breaker):
// İstemci kötü niyetli ya da bozuk bir bileşen (örn. bir render döngüsünde
// her seferinde aynı hatayı fırlatan useEffect) tarafından `logs` tablosuna
// sınırsız/log-injection tarzı yazım yapamasın diye üç katman var:
//   1) Debounce  — aynı scope+mesaj DUPLICATE_SUPPRESS_MS içinde tekrar
//      gelirse yalnızca İLKİ yazılır, gerisi sessizce yutulur.
//   2) Rate limit — dakikada en fazla MAX_PER_WINDOW log; aşımda pencere
//      dolana kadar hiçbir şey yazılmaz (bir kez konsola uyarı basılır).
//   3) Circuit breaker — insertLog art arda BREAKER_FAILURE_THRESHOLD kez
//      başarısız olursa (örn. tablo/ağ sorunu), BREAKER_COOLDOWN_MS boyunca
//      hiç denemez — bozuk bir bağlantıyı sonsuz döngüyle hammering'den korur.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const DUPLICATE_SUPPRESS_MS = 10_000;
const BREAKER_FAILURE_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 30_000;

let windowStart = Date.now();
let windowCount = 0;
let windowLimitWarned = false;

const recentKeys = new Map(); // "scope|message" -> son gönderim zamanı (ms)

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

function withinRateLimit() {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
    windowLimitWarned = false;
  }
  windowCount += 1;
  if (windowCount > MAX_PER_WINDOW) {
    if (!windowLimitWarned) {
      windowLimitWarned = true;
      // eslint-disable-next-line no-console
      console.warn(`[LOGS] Dakikada ${MAX_PER_WINDOW} log sınırına ulaşıldı — bu pencerede fazlası yok sayılıyor.`);
    }
    return false;
  }
  return true;
}

function isDuplicateBurst(logEntry) {
  const key = `${logEntry.scope}|${logEntry.message}`;
  const now = Date.now();
  const last = recentKeys.get(key);
  recentKeys.set(key, now);
  if (recentKeys.size > 200) {
    for (const [k, t] of recentKeys) if (now - t > DUPLICATE_SUPPRESS_MS) recentKeys.delete(k);
  }
  return last !== undefined && now - last < DUPLICATE_SUPPRESS_MS;
}

export async function insertLog(logEntry) {
  const now = Date.now();

  // Circuit breaker açıksa (yakın zamanda art arda hata aldıysak) hiç deneme.
  if (now < breakerOpenUntil) return;

  // Debounce: aynı scope+mesaj kısa sürede tekrarlanıyorsa yalnızca ilkini yaz.
  if (isDuplicateBurst(logEntry)) return;

  // Rate limit: dakikada MAX_PER_WINDOW ile sınırla.
  if (!withinRateLimit()) return;

  const { error } = await supabase.from("logs").insert({
    user_id: logEntry.userId ?? null,
    level: logEntry.level,
    scope: logEntry.scope,
    message: logEntry.message,
    data: logEntry.data ?? null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    url: typeof window !== "undefined" ? window.location.href : null,
  });

  if (error) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= BREAKER_FAILURE_THRESHOLD) {
      breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
      consecutiveFailures = 0;
    }
    // logger.error çağırmak burada sonsuz döngüye yol açar (sendToExternalService
    // tekrar insertLog'u tetikler) — bilerek çıplak console.error kullanılıyor.
    // eslint-disable-next-line no-console
    console.error("[LOGS] Supabase'e log yazılamadı:", error);
  } else {
    consecutiveFailures = 0;
  }
}
