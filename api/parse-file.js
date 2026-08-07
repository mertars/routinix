import { getUserFromRequest } from "./_lib/supabaseAdmin.js";
import { parseFileToPlan } from "./_lib/fileParsePrompt.js";
import { checkPlanRateLimit, logApiRequest } from "./_lib/planRateLimit.js";
import { classifyGeminiError } from "./_lib/aiErrors.js";

// Studio Builder'ın "Dosya Yükle" akışının TEK sunucu tarafı giriş noktası.
// Öncesinde JSON/Markdown/TXT/CSV/PDF-metni istemci tarafında (src/utils/
// planImportParsers.js — artık SİLİNDİ) sezgisel/regex tabanlı bir motorla
// ayrıştırılıyordu; serbest biçimli, beklenmedik düzendeki dosyalarda
// KIRILGANDI. Artık TÜM format-yapı çözümü BURADA, Gemini'nin Structured
// Output'uyla (JSON Mode + responseSchema, bkz. api/_lib/geminiRouter.js
// FILE_PARSE_SCHEMA) yapılır — istemci yalnızca ham metni okur (PDF için
// pdfjs-dist ile düz metne çevirir, bkz. src/utils/pdfTextExtract.js) ve
// BURAYA gönderir.
//
// generate-plan.js İLE AYNI güvenlik/sağlamlaştırma deseni: JWT zorunlu,
// anonim oturumlara KAPALI (gerçek, ücretli bir Gemini çağrısı), AYNI çok
// katmanlı hız sınırı bütçesini PAYLAŞIR (checkPlanRateLimit userId bazlı,
// api_request_log endpoint'e göre FİLTRELEMEZ — bkz. o dosyanın yorumu, bu
// yüzden generate-plan + parse-file TOPLAM AI kullanımı tek bir bütçeden
// düşer). TÜM handler gövdesi TEK try/catch içinde (FUNCTION_INVOCATION_FAILED'ı
// önlemek için, bkz. generate-plan.js'teki aynı sertleştirme notu).
const ALLOWED_FILE_TYPES = new Set(["json", "markdown", "txt", "csv", "pdf", "ics"]);
// ~120k karaktere kadar kabul edilir (fileParsePrompt.js modele göndermeden
// önce bunu ZATEN 60k'ya kırpar) — bunun ÇOK üzerindeki bir gövde muhtemelen
// bir hata/kötüye kullanım, Gemini'ye gitmeden ÖNCE reddedilir.
const MAX_FILE_CONTENT_CHARS = 120000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Yalnızca POST desteklenir." });
  }

  if (!process.env.GEMINI_API_KEY) {
    // eslint-disable-next-line no-console
    console.error("GEMINI_API_KEY missing");
    return res.status(500).json({ ok: false, message: "Sunucu yapılandırma hatası: yapay zeka servisi kullanılamıyor." });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ ok: false, message: "Oturum doğrulanamadı, tekrar giriş yapar mısın?" });
    }
    // AI destekli dosya ayrıştırma anonim (misafir) oturumlara KAPALI —
    // generate-plan.js'teki AYNI gerekçe: gerçek, ücretli bir Gemini çağrısı.
    if (user.is_anonymous) {
      return res.status(403).json({ ok: false, message: "Dosya içe aktarmak için ücretsiz hesabını tamamlaman gerekiyor." });
    }

    const { fileContent, fileType } = req.body || {};
    if (!fileContent || typeof fileContent !== "string" || !fileContent.trim()) {
      return res.status(400).json({ ok: false, message: "'fileContent' alanı zorunlu ve boş olamaz." });
    }
    if (!fileType || typeof fileType !== "string" || !ALLOWED_FILE_TYPES.has(fileType)) {
      return res.status(400).json({ ok: false, message: `'fileType' şunlardan biri olmalı: ${[...ALLOWED_FILE_TYPES].join(", ")}.` });
    }
    if (fileContent.length > MAX_FILE_CONTENT_CHARS) {
      return res.status(400).json({ ok: false, message: "Dosya içeriği çok büyük — desteklenen üst sınırı aşıyor." });
    }

    // GÜVENLİK/BÜTÇE: generate-plan.js İLE AYNI çok katmanlı hız sınırı
    // (bkz. api/_lib/planRateLimit.js) — bu kontrolün KENDİSİ asla fırlamaz
    // (fail-open).
    const limitCheck = await checkPlanRateLimit(user.id);
    if (!limitCheck.allowed) {
      if (limitCheck.retryAfterSec) res.setHeader("Retry-After", String(limitCheck.retryAfterSec));
      return res.status(429).json({ ok: false, message: limitCheck.message });
    }

    // "Rezervasyon önce, pahalı iş sonra" — generate-plan.js İLE AYNI sıra.
    await logApiRequest(user.id, "parse-file");

    const data = await parseFileToPlan({ fileContent, fileType });

    if (!data || typeof data !== "object" || !Array.isArray(data.days)) {
      // eslint-disable-next-line no-console
      console.error("[parse-file] Gemini Error Details:", "fileType:", fileType, "beklenmeyen/boş yanıt:", data);
      return res.status(502).json({ ok: false, message: "Yapay zeka dosyayı bir plan yapısına dönüştüremedi, tekrar dener misin?" });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Gemini Error Details:", serializeError(err));
    const { httpStatus, message } = classifyGeminiError(err);
    return res.status(httpStatus).json({ ok: false, message });
  }
}

// console.error'a HER ZAMAN serileştirilebilir, anlamlı bir obje versin —
// generate-plan.js'teki AYNI yardımcı (Node'da bazı hata türleri
// console.error(err) ile "[object Object]" gösterebilir).
function serializeError(err) {
  if (!err || typeof err !== "object") return { raw: String(err) };
  return { name: err.name, message: err.message, status: err.status, stack: err.stack };
}
