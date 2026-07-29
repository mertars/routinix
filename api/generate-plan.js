import { getUserFromRequest } from "./_lib/supabaseAdmin.js";
import { generateOnboardingQuestions, createEnrichedPlan, fetchNextWeekTasks } from "./_lib/planPrompt.js";

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

  const { action, payload } = req.body || {};
  if (!action) {
    return res.status(400).json({ ok: false, message: "'action' alanı zorunlu." });
  }

  try {
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
    return res.status(500).json({ ok: false, message: err?.message || "Plan üretilirken beklenmedik bir hata oluştu." });
  }
}
