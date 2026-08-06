import { getSupabaseAdmin, getUserFromRequest } from "./_lib/supabaseAdmin.js";
import { replacePlanContents } from "./_lib/planReplace.js";

// Plan Studio & Editor Engine — "Planı Düzenle" ile açılan Studio Builder'ın
// "Değişiklikleri Kaydet" butonu BURAYA gelir. coach-action.js İLE AYNI
// güvenlik deseni: JWT doğrulanır, plan GERÇEKTEN bu kullanıcıya ait mi
// service_role ile MANUEL kontrol edilir (service_role RLS'i bypass eder),
// ardından tüm mutasyon service_role ile (client'ın anon key'i tasks
// satırlarını silemiyor, bkz. planReplace.js dosya başı yorumu).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Yalnızca POST desteklenir." });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ ok: false, message: "Oturum doğrulanamadı, tekrar giriş yapar mısın?" });
    }
    if (user.is_anonymous) {
      return res.status(403).json({ ok: false, message: "Plan düzenlemek için ücretsiz hesabını tamamlaman gerekiyor." });
    }

    const { planId, builder } = req.body || {};
    if (!planId || !builder) {
      return res.status(400).json({ ok: false, message: "'planId' ve 'builder' alanları zorunlu." });
    }

    const admin = getSupabaseAdmin();

    const { data: plan, error: planErr } = await admin
      .from("plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();
    if (planErr || !plan) {
      return res.status(404).json({ ok: false, message: "Plan bulunamadı ya da bu hesaba ait değil." });
    }

    const result = await replacePlanContents(admin, plan, user.id, builder);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("plan-edit error:", { message: err?.message, stack: err?.stack });
    return res.status(500).json({ ok: false, message: "Plan güncellenirken bir sunucu hatası oluştu. Lütfen tekrar dener misin?" });
  }
}
