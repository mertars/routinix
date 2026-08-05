import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAICacheManager } from "@google/generative-ai/server";

// AI Koç'un system prompt'u için Gemini Context Caching. YALNIZCA coach.intent
// için var — projedeki DİĞER 4 Gemini çağrısının (plan.create, plan.next_week,
// plan.onboarding_questions, rhythm.report) system prompt'u Gemini'nin
// GERÇEK önbellekleme alt sınırının (ölçüldü: 1024 token, altındaki istek
// "Cached content is too small" ile 400 döner) ALTINDA kalıyor:
//   coach ~1426 token (SINIRI GEÇER) · plan.create ~906 · rhythm ~548 ·
//   onboarding ~484 · plan.next_week ~467 (hepsi sınırın ALTINDA)
// Bu yüzden caching bilinçli olarak yalnızca burada uygulanır — diğerlerinde
// zorlamak ya API hatası (400) ya da anlamsız bir egzersiz olurdu.
//
// SERVERLESS GERÇEĞİ: Vercel fonksiyonları çağrılar arası kalıcı bellek
// GARANTİ ETMEZ, ama "sıcak" (warm) örnekler arasında modül seviyesindeki
// değişkenler GERÇEKTE korunur (soğuk başlangıçlar hariç). Bu yüzden cache
// referansı burada modül seviyesinde tutulur: sürekli trafik altında çoğu
// istek sıcak örneğe denk gelip GERÇEK tasarruf sağlar; soğuk başlangıçta
// (ya da TTL dolduğunda) cache yeniden oluşturulur — bu TEK istek normal
// (önbelleksiz) fiyatlandırılır, sonrakiler tekrar ucuzlar. Çok-instance'lı
// yüksek trafikte cache adını Supabase'te TEK bir satırda paylaşarak
// instance'lar arası ORTAK kullanım sağlanabilir (bkz. dosya sonu notu) —
// bu, mevcut trafik hacmi için GEREKLİ olmayan bir sonraki adımdır.
const CACHE_TTL_SECONDS = 3300; // ~55 dk
const MODEL = "gemini-flash-lite-latest";

let cachedHandle = null; // { name, model, expiresAtMs, systemInstruction }

async function ensureCache(systemInstruction) {
  const now = Date.now();
  // systemInstruction karşılaştırması: coachPrompt.js'i deploy ettiğimizde
  // (ör. yeni bir kural eklendiğinde) eski cache'in İÇERİĞİ artık güncel
  // metinle eşleşmez — bu kontrol olmadan, yeni koddan gelen bir istek
  // YANLIŞLIKLA eski/güncel-olmayan bir sistem promptunu kullanmaya devam
  // ederdi (soğuk başlangıca kadar fark edilmezdi).
  if (cachedHandle && cachedHandle.expiresAtMs > now && cachedHandle.systemInstruction === systemInstruction) {
    return cachedHandle;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const cacheManager = new GoogleAICacheManager(apiKey);
  const cache = await cacheManager.create({
    model: `models/${MODEL}`,
    systemInstruction,
    ttlSeconds: CACHE_TTL_SECONDS,
  });
  // TTL'den 2 dakika ERKEN süresi dolmuş SAY — tam sınırda bir isteğin
  // "cache bulundu ama sunucu tarafında az önce süresi dolmuş" yarışına
  // düşüp 404 almasını önler.
  //
  // ÖNEMLİ: getGenerativeModelFromCachedContent SADECE `name` ile ("Cached
  // content must contain a `model` field" hatası, GERÇEK testte yakalandı)
  // ÇALIŞMIYOR — dönen nesnede `model` alanı da olmak ZORUNDA. Bu yüzden
  // yalnızca `cache.name` değil, `{ name, model }` birlikte saklanır.
  cachedHandle = { name: cache.name, model: cache.model, expiresAtMs: now + (CACHE_TTL_SECONDS - 120) * 1000, systemInstruction };
  return cachedHandle;
}

// Döner: normal GenerativeModel ile AYNI arayüze sahip bir model — çağıran
// kod (coachPrompt.js) `model.generateContent(userPrompt)`'u hiç değişmeden
// kullanmaya devam eder, caching tamamen bu fonksiyonun ARKASINDA gizli.
//
// FAIL-OPEN: cache oluşturma/okuma herhangi bir sebeple başarısız olursa
// (ör. Google tarafında geçici bir sorun), AI Koç'un TAMAMEN çökmesi
// YERİNE cache'siz (ama hâlâ çalışan, hâlâ flash-lite ile ucuz) bir modele
// sessizce geri düşülür — bir maliyet-optimizasyonu katmanı, çekirdek
// özelliği ASLA kesmemeli.
export async function getCachedCoachModel(systemInstruction, { maxOutputTokens = 3072 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const handle = await ensureCache(systemInstruction);
    return genAI.getGenerativeModelFromCachedContent(
      { name: handle.name, model: handle.model },
      { generationConfig: { responseMimeType: "application/json", maxOutputTokens } }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[coachCache] Cache kullanılamadı, cache'siz modele düşülüyor:", err?.message);
    cachedHandle = null;
    return genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction,
      generationConfig: { responseMimeType: "application/json", maxOutputTokens },
    });
  }
}

// ÖLÇEKLENDİRME NOTU (şimdi GEREKMİYOR, ileride trafik büyürse):
// Yukarıdaki `cachedHandle` yalnızca TEK bir sıcak instance içinde
// paylaşılır. Çok sayıda eşzamanlı soğuk başlangıç/instance'ta her biri
// kendi cache'ini oluşturur (hâlâ ÇALIŞIR, hâlâ ucuzdur, ama tam optimal
// paylaşım değildir). Instance'lar arası TEK bir cache paylaşmak için:
// cache adını (`cache.name`) küçük bir `system_cache` tablosuna
// (Supabase, tek satır: id/cache_name/expires_at) yaz, `ensureCache`
// önce oradan okusun, süresi dolmuşsa yeni cache oluşturup satırı
// güncellesin (ON CONFLICT UPDATE). Bu, ekstra bir DB round-trip
// pahasına gelir — mevcut trafik hacminde bu maliyet, kazanılacak
// ek tasarruftan muhtemelen daha yüksektir.
