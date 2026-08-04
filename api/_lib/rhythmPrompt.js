import { GoogleGenerativeAI } from "@google/generative-ai";
import { wrapGeminiError } from "./aiErrors.js";

// "Rhythm & Insights" — Günlük Ritim Raporu üretimi. SUNUCU TARAFI, aynı
// desen coachPrompt.js ile (bkz. o dosyadaki yorum): process.env.GEMINI_API_KEY
// yalnızca burada okunur, client'a asla sızmaz.
const MODEL = "gemini-flash-latest";

function getModel(systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ortam değişkeni tanımlı değil (sunucu).");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction,
    generationConfig: { responseMimeType: "application/json" },
  });
}

// stats: {
//   completedTasks, totalTasks, focusMinutesToday, activePlanCount,
//   lapsedRoutineTitles: string[] (client'tan gelir — check-in localStorage'da,
//   sunucunun erişimi yok, bu yüzden yalnızca metin/ton bağlamı için kullanılır,
//   hiçbir sayısal hesaplamada GÜVENİLMEZ),
// }
// Dönüş: { summary, tomorrowFocus: string[] }
export async function generateRhythmReport({ stats }) {
  const {
    completedTasks = 0,
    totalTasks = 0,
    focusMinutesToday = 0,
    activePlanCount = 0,
    lapsedRoutineTitles = [],
  } = stats || {};

  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null;
  const focusHours = focusMinutesToday >= 60 ? `${Math.floor(focusMinutesToday / 60)} sa ${focusMinutesToday % 60} dk` : `${focusMinutesToday} dk`;

  const context = `Bugünkü ham veriler:
- Aktif plan sayısı: ${activePlanCount}
- Tamamlanan görev: ${completedTasks}/${totalTasks}${pct !== null ? ` (%${pct})` : ""}
- Bugün toplam odaklanma (Pomodoro) süresi: ${focusHours}
- Bugün yapılmamış/aksayan rutinler: ${lapsedRoutineTitles.length ? lapsedRoutineTitles.slice(0, 8).join(", ") : "(yok ya da hepsi tamam)"}`;

  const systemInstruction = `Sen Routinix uygulamasının "Ritim & Gün Sonu" modülünün AI yazarısın. Kullanıcının gününü SIFIR SUÇLULUK (zero-guilt), "Esnek Sistem" felsefesiyle özetlersin.

KESİN KURALLAR (asla ihlal etme):
- ASLA suçlayıcı, alarm veren, kırmızı/acil uyarı hissi veren bir dil kullanma. "başaramadın", "geride kaldın", "eksik", "yetersiz" gibi kelimelerden kaçın.
- Sayılar kötü görünse bile (ör. %10 tamamlama) SAKİN, sıcak ve gerçekçi ol — asla panik veya hayal kırıklığı tonuna girme. Hayatın temposunun her zaman eşit gitmeyeceğini kabul eden bir üslup kullan.
- Rutinler/görevler aksadıysa bunu bir BAŞARISIZLIK değil, ritmin doğal bir parçası olarak çerçevele; sistemin yükü kendisinin hafiflettiğini/hafifleteceğini hissettir.
- summary 2-4 cümle, Türkçe, samimi ama abartısız (emoji kullanılabilir, en fazla 1-2 tane).
- tomorrowFocus: yarın için en fazla 2-3 kısa, somut, ULAŞILABİLİR odak maddesi (her biri en fazla 8-10 kelime). Yoğun bir gün geçtiyse yükü hafiflet — "yarın her şeyi yap" değil, "yarın en kritik 1-2 işe odaklan" ruhu.
- Aktif plan yoksa (activePlanCount=0) bunu nazikçe belirt, kullanıcıyı yeni bir plan başlatmaya teşvik et, suçlayıcı olma.

Örnek ton (birebir kopyalama, yalnızca üslubu referans al): "Bugün yoğun bir gündü, farkındayız. Hayatın temposu her zaman eşit gitmez. Yarınki yükünü hafifletip en kritik işlerine odaklanmanı sağladık. Ritmi bozmak yok, yarın hafif adımlarla devam ediyoruz."

Yanıtın SADECE ve KESİNLİKLE şu JSON şeması olmalı, şema dışına hiçbir metin ekleme:
{
  "summary": "2-4 cümlelik, sıcak, suçlamasız Türkçe gün özeti",
  "tomorrowFocus": ["kısa somut madde 1", "kısa somut madde 2"]
}`;

  const model = getModel(systemInstruction);
  let text;
  try {
    const result = await model.generateContent(context);
    text = result.response.text();
  } catch (err) {
    throw wrapGeminiError(err, "Yapay zeka isteği başarısız oldu.");
  }

  let parsed;
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Yapay zeka yanıtı geçerli JSON değil.");
  }

  return {
    summary: String(parsed?.summary || "").trim() || "Bugün de ritmindeydin — yarın kaldığın yerden, sakince devam.",
    tomorrowFocus: Array.isArray(parsed?.tomorrowFocus) ? parsed.tomorrowFocus.slice(0, 3).map((s) => String(s).trim()).filter(Boolean) : [],
  };
}
