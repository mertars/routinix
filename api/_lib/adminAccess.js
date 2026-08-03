// Admin/sınırsız erişim allowlist'i — SUNUCU TARAFI, SADECE bu dosya
// üzerinden okunur. `ADMIN_EMAILS` ortam değişkeni (VITE_ önekSİZ, yalnızca
// Vercel/sunucu ortamında tanımlı, .env'de) virgülle ayrılmış e-posta
// listesidir.
//
// GÜVENLİK NOTU (neden client'tan bir "role" alanı KABUL EDİLMEZ): Admin
// durumu YALNIZCA getUserFromRequest'in JWT'den doğruladığı `user.email`
// üzerinden hesaplanır — istek body'sinden/header'ından gelen herhangi bir
// "role"/"isAdmin" alanı asla güvenilmez. Aksi halde herkes isteğine
// `role: "admin"` ekleyip günlük kota sistemini tamamen bypass edebilirdi.
export function isAdminUser(user) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return false;
  return list.includes((user?.email || "").toLowerCase());
}
