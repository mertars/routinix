import { getUserFromRequest } from "./_lib/supabaseAdmin.js";
import { generateOnboardingQuestions, createEnrichedPlan, fetchNextWeekTasks } from "./_lib/planPrompt.js";
import { checkPlanRateLimit, logApiRequest } from "./_lib/planRateLimit.js";

// Plan üretim pipeline'ının TEK sunucu tarafı giriş noktası. Eskiden client
// (anon key) VITE_GEMINI_API_KEY ile Gemini'yi doğrudan çağırıyordu — anahtar
// tarayıcı bundle'ına gömülüyordu. Artık:
//   1) İstek JWT ile doğrulanır (Authorization: Bearer <access_token>) —
//      oturum açmamış kullanıcı bu endpoint'i tüketemez.
//   2) Gemini çağrısı yalnızca burada, process.env.GEMINI_API_KEY (VITE_
//      önekSİZ, yalnızca sunucu) ile yapılır (bkz. api/_lib/planPrompt.js).
// action: "onboarding_questions" | "create_plan" | "next_week"
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Yalnızca POST desteklenir." });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ ok: false, message: "Oturum doğrulanamadı, tekrar giriş yapar mısın?" });
  }
  // AI plan üretimi anonim (misafir) oturumlara KAPALI — client tarafındaki
  // gate (usePlanStudio.js) yalnızca UX'tir, GERÇEK sınır burasıdır: `is_anonymous`
  // JWT'den doğrulanır, client'ın gönderdiği hiçbir alana güvenilmez.
  if (user.is_anonymous) {
    return res.status(403).json({ ok: false, message: "403 Forbidden - Login Required: AI ile plan oluşturmak için ücretsiz hesabını tamamlaman gerekiyor." });
  }

  const { action, payload } = req.body || {};
  if (!action) {
    return res.status(400).json({ ok: false, message: "'action' alanı zorunlu." });
  }

  // GÜVENLİK/BÜTÇE: bu üç action da GERÇEK, ücretli Gemini çağrısı yapar.
  // Çok katmanlı hız sınırı (kullanıcı bazlı RPM/RPH/RPD + sistem geneli
  // Global Günlük Tavan) — bkz. api/_lib/planRateLimit.js dosya başı yorumu.
  // 10 aktif plan limiti burada işe yaramaz (create_plan'ın SONUCU client
  // tarafında hiç kaydedilmeden atılabilir, plans tablosuna hiç yazılmadan
  // AI çağrısı zaten yapılmış/ücretlendirilmiş olur) — bu yüzden ayrı,
  // istek-seviyesinde bir koruma gerekiyordu.
  const limitCheck = await checkPlanRateLimit(user.id);
  if (!limitCheck.allowed) {
    if (limitCheck.retryAfterSec) res.setHeader("Retry-After", String(limitCheck.retryAfterSec));
    return res.status(429).json({ ok: false, message: limitCheck.message });
  }

  try {
    // "Rezervasyon önce, pahalı iş sonra": kontrolü geçer geçmez (Gemini'ye
    // gitmeden ÖNCE) loglanır — eşzamanlı isteklerin ikisinin de aynı anda
    // kontrolü geçip limiti aşması riskini pratik olarak azaltır.
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

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[generate-plan] hata:", action, err?.message, err?.stack);
    // GÜVENLİK: ham err.message istemciye YANSITILMAZ — Gemini SDK'sından
    // gelen bir hata (ör. kota/kimlik doğrulama hatası) teorik olarak istek
    // detayı/iç yapı bilgisi taşıyabilir. coach-action.js ve rhythm-report.js
    // ile AYNI desen: tam detay yalnızca sunucu logunda (console.error),
    // istemciye her zaman sabit, güvenli bir mesaj döner.
    return res.status(500).json({ ok: false, message: "Plan üretilirken beklenmedik bir hata oluştu." });
  }
}
