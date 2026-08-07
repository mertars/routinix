import { wrapGeminiError } from "./aiErrors.js";
import { getRoutedModel } from "./geminiRouter.js";

// Evrensel dosya içe aktarma — Studio Builder'a yüklenen JSON/Markdown/TXT/
// CSV/PDF-metni/ICS içeriğini SABİT bir plan şemasına çevirir. Format ne
// olursa olsun AYNI system instruction kullanılır — Gemini içeriği anlayıp
// yorumlar, biz her format için ayrı regex/parser BAKIMLAMAYIZ (bkz.
// api/parse-file.js dosya başı yorumu: eski src/utils/planImportParsers.js
// bu yüzden tamamen kaldırıldı).
const SYSTEM_INSTRUCTION = `Sen bir plan ve görev dönüştürücüsün. Verilen metin veya dosya içeriği ne olursa olsun (Markdown, ham JSON, PDF metni, CSV veya düz liste), içeriği analiz et ve strictly aşağıdaki JSON şemasına dönüştür:
{
  "title": "Plan Başlığı",
  "days": [
    {
      "dayNumber": 1,
      "title": "1. Gün / Faz Başlığı",
      "tasks": [
        { "title": "Görev Açıklaması", "priority": "high" | "medium" | "low" }
      ]
    }
  ]
}`;

// Aşırı büyük içerik (ör. çok sayfalı bir PDF'in çıkardığı metin) hem
// gereksiz token maliyeti hem de model bağlam sınırını zorlama riski taşır.
// api/parse-file.js zaten MAX_FILE_CONTENT_CHARS ile çok daha büyük gövdeleri
// tamamen reddediyor — burası, kabul edilen ama yine de büyük içeriği modele
// göndermeden ÖNCE makul bir üst sınırda kırpan İKİNCİ, daha sıkı bir tampon.
const MAX_CONTENT_CHARS = 60000;

function buildUserPrompt(fileContent, fileType) {
  const raw = String(fileContent || "");
  const truncated = raw.length > MAX_CONTENT_CHARS;
  const content = truncated ? raw.slice(0, MAX_CONTENT_CHARS) : raw;
  const lines = [`Dosya türü: .${String(fileType || "").replace(/^\./, "")}`];
  if (truncated) {
    lines.push(`NOT: İçerik ${MAX_CONTENT_CHARS} karakterde kesildi — yalnızca bu kısmi içerikten en iyi sonucu üret.`);
  }
  lines.push("--- DOSYA İÇERİĞİ ---");
  lines.push(content);
  return lines.join("\n");
}

// Döner: { title, days: [{dayNumber, title, tasks: [{title, priority}]}] } —
// responseSchema (bkz. api/_lib/geminiRouter.js FILE_PARSE_SCHEMA) ile
// ZORUNLU kılınmış sabit şekil; ekstra doğrulama api/parse-file.js'te.
export async function parseFileToPlan({ fileContent, fileType }) {
  const model = getRoutedModel("file.parse", SYSTEM_INSTRUCTION);
  const userPrompt = buildUserPrompt(fileContent, fileType);

  let text;
  try {
    const result = await model.generateContent(userPrompt);
    text = result.response.text();
  } catch (err) {
    throw wrapGeminiError(err, "Dosya ayrıştırma başarısız oldu (Gemini SDK hatası).");
  }

  try {
    // responseMimeType/responseSchema olsa da olası kod-bloğu sarmalarına
    // karşı güvenli parse (planPrompt.js'teki runJson İLE AYNI savunma).
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Dosya ayrıştırma yanıtı geçerli JSON değil.");
  }
}
