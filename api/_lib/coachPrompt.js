import { GoogleGenerativeAI } from "@google/generative-ai";
import { wrapGeminiError } from "./aiErrors.js";

// AI Koç'un serbest metin niyet tespiti — SUNUCU TARAFI port'u. Eskiden
// src/services/aiPipelineService.js içinde tarayıcıdan VITE_GEMINI_API_KEY ile
// doğrudan çağrılıyordu (anahtar client bundle'ına gömülüyordu — güvensiz).
// Artık yalnızca burada, process.env.GEMINI_API_KEY (VITE_ önekSİZ, yalnızca
// sunucuda okunur) ile çalışır.
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

// plans: [{ id, title, mode, total_days, tasks: [...] }] — service_role ile
// önceden kullanıcıya ait olduğu doğrulanmış planlar (bkz. api/coach-action.js).
// Dönüş: { reply, intent, targetPlanId, mutations, newTasks }
export async function runCoachIntent({ message, plans = [] }) {
  const context =
    plans
      .map((p) => {
        const tasks = (p.tasks || [])
          .slice()
          .sort((a, b) => (a.is_completed === b.is_completed ? a.day_number - b.day_number : a.is_completed ? 1 : -1))
          .slice(0, 25)
          .map(
            (t) =>
              `${t.day_number}|${t.id}|${t.title}|${t.duration_min ?? "-"}dk|${t.priority ?? "-"}|${t.is_completed ? "tamam" : "bekliyor"}`
          )
          .join("\n");
        return `PLAN[${p.id}] "${p.title}" (${p.mode || "general"}, ${p.total_days ?? "?"} gün)\nformat → gün|task_id|başlık|süre|öncelik|durum\n${tasks || "(görev yok)"}`;
      })
      .join("\n\n") || "(kullanıcının hiç planı yok)";

  const systemInstruction = `Sen Routinix uygulamasının kişisel AI Koçusun — şık, özgüvenli, odaklı bir beyaz yakalı performans dili kullanırsın (asla soğuk mühendislik jargonu ya da abartılı savaş ağzı değil).

Sana kullanıcının TÜM planları ve her plandaki GERÇEK görevlerin (task) id'leri veriliyor. Kullanıcının serbest metin isteğini analiz edip hangi eylemi istediğini (niyet) tespit et ve gerekiyorsa somut güncellemeler üret.

KESİN KURALLAR:
- mutations[].task_id alanında YALNIZCA sana verilen context'teki gerçek id'leri kullan. Böyle bir id yoksa veya emin değilsen o görevi mutations'a ekleme, UYDURMA.
- Kullanıcı hangi plandan bahsettiği belirsizse: tek planı varsa onu hedefle; birden fazla planı varsa başlık/bağlamdan en olası olanı seç (target_plan_id). Hiçbir şekilde emin olamıyorsan target_plan_id'yi null bırak ve reply içinde kibarca hangi planı kastettiğini sor.
- "süreyi azalt / hafiflet / kolaylaştır" → ilgili (belirtilmemişse o planın tamamlanmamış) görevlerinin duration_min'ini makul bir oranda (örn %20-40) düşür.
- "yoğunlaştır / sıkılaştır / hızlandır" → duration_min'i hafifçe düşür (örn %10-20) ve/veya priority'yi bir kademe yükselt (Düşük→Orta→Yüksek).
- "X görevi/aktivitesi ekle" → new_tasks içine title + kısa detail + gerçekçi duration_min + uygun bir day_number ile yeni görev tanımla (day_number belirtilmemişse plandaki en yakın uygun güne ya da son güne ekle).
- "günü kaydır / ertele / yarına al" → ilgili günün tamamlanmamış görevlerinin mutations[].fields.day_number'ını hedef güne taşı.
- "muadil öner" gibi tamamen bilgilendirici/istişari isteklerde mutations ve new_tasks BOŞ kalabilir, yalnızca reply doldurulur — bu geçerli bir yanıttır.
- Plan bağlamıyla alakasız (genel sohbet, konu dışı soru) ya da ne istendiği gerçekten anlaşılmayan isteklerde intent'i "unclear" yap, mutations/new_tasks'i boş bırak, reply'de kısaca ne yapabileceğini hatırlat.
- reply KISA olsun (1-3 cümle), sıcak ve motive edici ama abartısız bir üslupla, Türkçe yaz.

Yanıtın SADECE ve KESİNLİKLE şu JSON şeması olmalı, şema dışına hiçbir metin ekleme:
{
  "reply": "kullanıcıya gösterilecek kısa Türkçe yanıt",
  "intent": "lighten" | "intensify" | "postpone" | "add_task" | "update_task" | "info" | "unclear",
  "target_plan_id": "uuid ya da null",
  "mutations": [ { "task_id": "context'teki gerçek id", "fields": { "duration_min": 30, "priority": "Yüksek", "day_number": 5 } } ],
  "new_tasks": [ { "day_number": 3, "title": "...", "detail": "...", "duration_min": 30, "priority": "Orta" } ]
}
fields ve new_tasks nesnelerinde yalnızca gerçekten değişen/gerekli alanları doldur.`;

  const userPrompt = `Kullanıcının planları:\n${context}\n\nKullanıcının mesajı: "${String(message || "").trim()}"`;

  const model = getModel(systemInstruction);
  let text;
  try {
    const result = await model.generateContent(userPrompt);
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
    reply: String(parsed?.reply || "").trim() || "Anladım, hemen ilgileniyorum.",
    intent: parsed?.intent || "unclear",
    targetPlanId: parsed?.target_plan_id || null,
    mutations: Array.isArray(parsed?.mutations) ? parsed.mutations.slice(0, 50) : [],
    newTasks: Array.isArray(parsed?.new_tasks) ? parsed.new_tasks.slice(0, 20) : [],
  };
}
