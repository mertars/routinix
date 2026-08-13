import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// Sunucu fonksiyonundan (Vercel) daha erken, KONTROLLÜ bir zaman aşımı —
// aiPipelineService.js'teki AYNI gerekçe: Gemini asılı kalırsa, kullanıcı
// sonsuz yüklemede kalmak yerine net bir "zaman aşımı" mesajı görür. Bu
// dosya ÖNCEDEN bu korumaya sahip DEĞİLDİ (pre-launch denetiminde bulunan
// tek gerçek eksik — diğer 3 AI servis dosyası zaten bu deseni kullanıyordu)
// — file.parse de 8192 token'a kadar çıkabildiğinden (bkz. geminiRouter.js
// FILE_PARSE_SCHEMA) plan.create ile AYNI süre kullanılır.
const REQUEST_TIMEOUT_MS = 35_000;

// Studio Builder'ın dosya içe aktarma akışının TEK client-side giriş noktası
// — planEditService.js İLE AYNI desen: JWT ile /api/parse-file sunucu
// fonksiyonuna gidilir (Gemini API anahtarı yalnızca sunucuda okunur).
// Döner: { title, days: [{dayNumber, title, tasks: [{title, priority}]}] } —
// Gemini'nin responseSchema'sıyla ZORUNLU kılınmış sabit şekil (bkz.
// api/_lib/geminiRouter.js FILE_PARSE_SCHEMA). Bu şekli builder'ın kendi
// PlanState'ine (days OBJESİ, Türkçe öncelik rozetleri) çevirmek çağıran
// tarafın (ManualPlanBuilder.jsx) işi — bu servis yalnızca ham yanıtı taşır.
export async function parseFileWithGemini(fileContent, fileType) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Devam etmek için giriş yapmalısın.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch("/api/parse-file", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fileContent, fileType }),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    logger.error("PARSE_FILE", `Dosya ayrıştırılamadı (${timedOut ? "zaman aşımı" : "sunucuya ulaşılamadı"})`, { fileType, error: err?.message });
    throw new Error(timedOut ? "Yapay zeka yanıt vermekte gecikti, lütfen tekrar dener misin?" : "Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dener misin?");
  } finally {
    clearTimeout(timeoutId);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || !body?.ok) {
    const message = body?.message || "Dosya ayrıştırılırken bir sorun oluştu. Tekrar dener misin?";
    logger.error("PARSE_FILE", "Dosya ayrıştırılamadı", { fileType, status: res.status, message });
    throw new Error(message);
  }

  return body.data;
}
