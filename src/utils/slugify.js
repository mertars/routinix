// Türkçe başlıklardan okunabilir link slug'ı üretir — "14 Günlük Derin Odak
// Mimarisi" -> "14-gunluk-derin-odak-mimarisi". Türkçe karakterler önce ELLE
// eşlenir (ç/ğ/ı/ö/ş/ü) — `"İ".toLowerCase()` gibi JS'in yerleşik
// `toLowerCase()`'i Türkçe büyük/küçük harf kurallarını doğru uygulamaz
// (`"İ".toLowerCase()` "i" değil "i̇" — noktalı bileşik karakter döner),
// bu yüzden haritalama toLowerCase'DEN ÖNCE yapılır.
const TR_MAP = { ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u" };

export function slugify(text, maxLength = 60) {
  if (!text) return "";
  return text
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // kalan aksanları (Türkçe dışı diller vb.) temizle
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, ""); // slice sonrası yarım kalan "-" varsa temizle
}
