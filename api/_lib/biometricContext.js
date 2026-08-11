import { getSupabaseAdmin } from "./supabaseAdmin.js";

// Beslenme & Antrenman Mimarı'nda (bkz. src/components/NutritionArchitectStudio.jsx
// + supabase/migration.sql "19) user_biometric_profiles") kayıtlı biyometrik
// profili, GENEL plan üretim pipeline'ının (planPrompt.js createEnrichedPlan)
// prompt bağlamına enjekte etmek için okur. service_role ile (RLS bypass)
// çalışır — burası zaten JWT ile doğrulanmış `user.id`'yi kullanır, client'ın
// gönderdiği hiçbir alana güvenilmez (bkz. api/generate-plan.js).
//
// FAIL-OPEN: bu bağlam bir ZENGİNLEŞTİRMEDİR, plan üretiminin ÇEKİRDEK
// akışı değil — DB'ye erişilemezse/satır yoksa/herhangi bir hata olursa
// SESSİZCE boş string döner, plan üretimini ASLA engellemez ya da geciktirmez
// (checkPlanRateLimit/logApiRequest'teki AYNI fail-open ilkesi).

const ACTIVITY_LABELS = {
  sedentary: "Sedanter (masa başı, hareketsiz)",
  light: "Hafif aktif (haftada 1-3 gün hafif egzersiz)",
  moderate: "Orta aktif (haftada 3-5 gün egzersiz)",
  active: "Aktif (haftada 6-7 gün egzersiz)",
  very_active: "Çok aktif (günde 2 antrenman / fiziksel iş)",
};

const GOAL_LABELS = {
  bulk: "Kilo alma / Clean Bulk",
  cut: "Kilo verme / Yağ yakımı",
  maintain: "Kilo koruma / Maintenance",
};

export async function fetchBiometricContextText(userId) {
  if (!userId) return "";
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("user_biometric_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error || !data) return "";

    const lines = [];
    if (data.age) lines.push(`Yaş: ${data.age}`);
    if (data.gender && data.gender !== "belirtilmedi") lines.push(`Cinsiyet: ${data.gender}`);
    if (data.height_cm) lines.push(`Boy: ${data.height_cm} cm`);
    if (data.weight_kg) lines.push(`Kilo: ${data.weight_kg} kg`);
    if (data.body_fat_pct) lines.push(`Yağ Oranı: %${data.body_fat_pct}`);
    if (data.activity_level) lines.push(`Aktivite Seviyesi: ${ACTIVITY_LABELS[data.activity_level] || data.activity_level}`);
    if (data.goal) lines.push(`Fitness/Beslenme Hedefi: ${GOAL_LABELS[data.goal] || data.goal}`);
    if (data.daily_calorie_target) lines.push(`Kayıtlı Günlük Kalori Hedefi: ${data.daily_calorie_target} kcal`);
    if (data.protein_g || data.carb_g || data.fat_g) {
      lines.push(`Kayıtlı Makro Hedefleri: Protein ${data.protein_g ?? "?"}g, Karbonhidrat ${data.carb_g ?? "?"}g, Yağ ${data.fat_g ?? "?"}g`);
    }
    if (Array.isArray(data.allergies) && data.allergies.length) lines.push(`Alerjiler/Kısıtlar: ${data.allergies.join(", ")}`);

    if (!lines.length) return "";

    return `\n\nKULLANICININ KAYITLI BİYOMETRİK PROFİLİ (Beslenme & Antrenman Mimarı'ndan) — planı bu verilere göre nokta atışı kişiselleştir, uygunsa (ör. fitness/beslenme/sağlık odaklı bir hedefse) görevlere/hedeflere yansıt:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}
