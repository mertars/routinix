import { supabase } from "../lib/supabaseClient";

// logger.js'in sendToExternalService placeholder'ının kalıcı hedefi: warn/error
// seviyesindeki loglar burada public.logs tablosuna yazılır (bkz. migration.sql
// bölüm 5). Ağır bir servise (Sentry vb.) ihtiyaç duymadan mevcut Supabase
// altyapısını kullanır — basit bir "hata geçmişi" için yeterlidir.
export async function insertLog(logEntry) {
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
    // logger.error çağırmak burada sonsuz döngüye yol açar (sendToExternalService
    // tekrar insertLog'u tetikler) — bilerek çıplak console.error kullanılıyor.
    // eslint-disable-next-line no-console
    console.error("[LOGS] Supabase'e log yazılamadı:", error);
  }
}
