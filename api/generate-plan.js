import { getUserFromRequest } from "./_lib/supabaseAdmin.js";
import { generateOnboardingQuestions, createEnrichedPlan, fetchNextWeekTasks } from "./_lib/planPrompt.js";
import { checkPlanRateLimit, logApiRequest } from "./_lib/planRateLimit.js";
import { classifyGeminiError } from "./_lib/aiErrors.js";

// Plan üretim pipeline'ının TEK sunucu tarafı giriş noktası. Eskiden client
// (anon key) VITE_GEMINI_API_KEY ile Gemini'yi doğrudan çağırıyordu — anahtar
// tarayıcı bundle'ına gömülüyordu. Artık:
//   1) İstek JWT ile doğrulanır (Authorization: Bearer <access_token>) —
//      oturum açmamış kullanıcı bu endpoint'i tüketemez.
//   2) Gemini çağrısı yalnızca burada, process.env.GEMINI_API_KEY (VITE_
//      önekSİZ, yalnızca sunucu) ile yapılır (bkz. api/_lib/planPrompt.js).
// action: "onboarding_questions" | "create_plan" | "next_week"
//
// FUNCTION_INVOCATION_FAILED SERTLEŞTİRMESİ: bu dosyanın ÖNCEKİ sürümünde
// getUserFromRequest(req) ve checkPlanRateLimit(user.id) çağrıları try/catch
// DIŞINDAYDI — ikisi de (env değişkeni eksikse, ya da plan_rate_limit.sql
// henüz Supabase'de çalıştırılmadıysa "tablo yok" hatasıyla) SENKRON/rejected-
// promise olarak fırlayabiliyordu; yakalanmayan bir istisna, Vercel'in
// fonksiyonu JSON DEĞİL kendi ham hata sayfasıyla (FUNCTION_INVOCATION_FAILED)
// öldürmesine yol açar — istemci bunu "Beklenmedik bir sunucu yanıtı alındı."
// olarak görür. Artık TÜM handler gövdesi TEK bir try/catch içinde; hiçbir
// alt-adım (auth/rate-limit/Gemini) uncaught şekilde dışarı sızamaz.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Yalnızca POST desteklenir." });
  }

  // 1) API KEY KONTROLÜ — Gemini'ye hiç gitmeden ÖNCE, en erken noktada.
  // planPrompt.js'in kendi getModel()'i de aynı kontrolü yapıyor, ama o
  // noktaya varmadan (auth/rate-limit adımlarını boşuna çalıştırmadan) hızlı
  // ve NET bir teşhis için burada da açıkça kontrol edilir.
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
    // AI plan üretimi anonim (misafir) oturumlara KAPALI — client tarafındaki
    // gate (usePlanStudio.js) yalnızca UX'tir, GERÇEK sınır burasıdır:
    // `is_anonymous` JWT'den doğrulanır, client'ın gönderdiği hiçbir alana
    // güvenilmez.
    if (user.is_anonymous) {
      return res.status(403).json({ ok: false, message: "403 Forbidden - Login Required: AI ile plan oluşturmak için ücretsiz hesabını tamamlaman gerekiyor." });
    }

    const { action, payload } = req.body || {};
    if (!action || typeof action !== "string") {
      return res.status(400).json({ ok: false, message: "'action' alanı zorunlu." });
    }

    // GÜVENLİK/BÜTÇE: bu üç action da GERÇEK, ücretli Gemini çağrısı yapar.
    // Çok katmanlı hız sınırı (kullanıcı bazlı RPM/RPH/RPD + sistem geneli
    // Global Günlük Tavan) — bkz. api/_lib/planRateLimit.js. Bu kontrolün
    // KENDİSİ hiçbir zaman fırlatmaz (fail-open, bkz. o dosyadaki yorum).
    const limitCheck = await checkPlanRateLimit(user.id);
    if (!limitCheck.allowed) {
      if (limitCheck.retryAfterSec) res.setHeader("Retry-After", String(limitCheck.retryAfterSec));
      return res.status(429).json({ ok: false, message: limitCheck.message });
    }

    // "Rezervasyon önce, pahalı iş sonra" — kontrolü geçer geçmez, Gemini'ye
    // gitmeden ÖNCE loglanır. logApiRequest de asla fırlatmaz (bkz. o dosya).
    await logApiRequest(user.id, "generate-plan");

    let data;
    if (action === "onboarding_questions") {
      data = await generateOnboardingQuestions(payload);
    } else if (action === "create_plan") {
      data = await createEnrichedPlan(payload);
    } else if (action === "next_week") {
      data = await fetchNextWeekTasks(payload);
    } else {
      return res.status(400).json({ ok: false, message: `Bilinmeyen action: ${action}` });
    }

    // TANIMSIZ NESNE KORUMASI: Gemini teorik olarak boş/eksik bir yanıt
    // üretebilir (planPrompt.js kendi JSON.parse'ını zaten try/catch'liyor,
    // ama burada da "data hiç dönmedi" durumuna karşı son bir güvence).
    if (!data || typeof data !== "object") {
      // eslint-disable-next-line no-console
      console.error("[generate-plan] Gemini Error Details:", "action:", action, "beklenmeyen/boş yanıt:", data);
      return res.status(502).json({ ok: false, message: "Yapay zeka geçerli bir yanıt üretemedi, tekrar dener misin?" });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    // İSTENEN log biçimi + ek bağlam (status/stack sunucu logunda kalır,
    // istemciye ASLA yansımaz — bkz. classifyGeminiError).
    // eslint-disable-next-line no-console
    console.error("Gemini Error Details:", serializeError(err));
    const { httpStatus, message } = classifyGeminiError(err);
    return res.status(httpStatus).json({ ok: false, message });
  }
}

// console.error'a HER ZAMAN serileştirilebilir, anlamlı bir obje versin —
// bazı hata türleri (ör. AbortError, bazı SDK hataları) doğrudan
// console.error(err) ile Node'da "[object Object]" ya da eksik bilgi
// gösterebilir; burada name/message/status/stack açıkça çıkarılır.
function serializeError(err) {
  if (!err || typeof err !== "object") return { raw: String(err) };
  return { name: err.name, message: err.message, status: err.status, stack: err.stack };
}
