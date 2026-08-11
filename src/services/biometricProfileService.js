import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// Beslenme & Antrenman Mimarı'nın (NutritionArchitectStudio.jsx) biyometrik
// giriş formunun DB kalıcılığı — kullanıcı başına TEK satır (bkz.
// supabase/migration.sql "19) user_biometric_profiles"). RLS "auth.uid() =
// user_id" olduğundan burada anon key + kullanıcı JWT'si yeterli, ayrı bir
// sunucu endpoint'i gerekmez (ör. templates/plans tablolarıyla AYNI desen).

// userId yoksa (misafir/oturum yok) sessizce null döner — çağıran taraf
// (NutritionArchitectStudio) formu boş bırakır, hata GÖSTERMEZ.
export async function fetchBiometricProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from("user_biometric_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) {
    logger.error("BIOMETRIC_PROFILE", "Profil getirilemedi", { error: error.message });
    throw error;
  }
  return data;
}

// profile: { age?, gender?, height_cm?, weight_kg?, body_fat_pct?,
//            activity_level?, goal?, daily_calorie_target?, protein_g?,
//            carb_g?, fat_g?, wake_time?, sleep_time?, budget_level?,
//            allergies?: string[] }
// Kısmi güncellemeyi de destekler — yalnızca VERİLEN alanlar upsert edilir,
// ama Postgres upsert semantiği gereği satır zaten varsa VERİLMEYEN
// alanlar DOKUNULMADAN kalır (bkz. `update` değil `upsert` + onConflict).
export async function saveBiometricProfile(userId, profile) {
  if (!userId) throw new Error("Kaydetmek için giriş yapmalısın.");
  const { data, error } = await supabase
    .from("user_biometric_profiles")
    .upsert({ user_id: userId, ...profile, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) {
    logger.error("BIOMETRIC_PROFILE", "Profil kaydedilemedi", { error: error.message });
    throw error;
  }
  return data;
}
