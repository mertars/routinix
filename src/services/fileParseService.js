import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

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

  let res;
  try {
    res = await fetch("/api/parse-file", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ fileContent, fileType }),
    });
  } catch (err) {
    logger.error("PARSE_FILE", "Sunucuya ulaşılamadı", { fileType, error: err?.message });
    throw new Error("Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dener misin?");
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
