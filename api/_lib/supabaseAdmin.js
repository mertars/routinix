import { createClient } from "@supabase/supabase-js";

// Yalnızca sunucu tarafında (Vercel serverless function) kullanılır.
// service_role anahtarı RLS'i bypass eder — bu yüzden bu dosya ASLA client
// koduna (src/) import edilmemeli ve SUPABASE_SERVICE_ROLE_KEY ortam
// değişkeni "VITE_" öneki TAŞIMAMALI (yoksa Vite onu tarayıcı paketine gömer).
let cached = null;

export function getSupabaseAdmin() {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri tanımlı değil.");
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

// İsteğin Authorization: Bearer <token> header'ındaki JWT'yi doğrulayıp
// ilgili kullanıcıyı döner. Geçersiz/eksik token'da null döner (çağıran 401
// dönmeli).
export async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
