import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

// Sosyal medya (WhatsApp/Telegram/X/Instagram DM/Discord/LinkedIn) link
// önizleme kartları — bu ENDPOINT'e YALNIZCA vercel.json'daki rewrite
// kuralı, İSTEK ATAN'IN User-Agent'ı bilinen bir bot/crawler'a UYARSA
// yönlendirir (bkz. vercel.json "has" koşulu). Normal tarayıcılar bu
// fonksiyonu HİÇ görmez, her zamanki gibi statik SPA'yı alır.
//
// NEDEN GEREKLİ (SharedTemplateView.jsx'te `document.title` YETMEZ):
// Routinix salt client-side render edilen bir SPA'dır (SSR/prerender yok).
// Facebook/Twitter/WhatsApp gibi crawler'lar sayfayı JavaScript ÇALIŞTIRMADAN
// ham HTML olarak okur — React mount olup `<meta>` etiketlerini güncellemeden
// ÇOK ÖNCE crawler zaten okumayı bitirmiş olur. Gerçek bir çözüm ya tam
// SSR/prerender (bu projenin mimarisi için orantısız bir değişiklik) ya da
// burada yapılan: crawler'a ÖZEL, doğru <meta> etiketleriyle GERÇEK bir HTML
// yanıtı üretmek.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  const slug = (req.query.slug || "").toString();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const pageUrl = `https://${host}/t/${encodeURIComponent(slug)}`;

  let template = null;
  if (slug) {
    try {
      const admin = getSupabaseAdmin();
      const column = UUID_RE.test(slug) ? "id" : "slug";
      const { data } = await admin.from("templates").select("title, cover_url").eq(column, slug).maybeSingle();
      template = data || null;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[og-template] hata:", err?.message);
    }
  }

  const title = template ? `${template.title} - Routinix Nexus Yol Haritası` : "Routinix Nexus Yol Haritası";
  const description = "Hesap açma şartı yok. Anında incele, düzenle veya PDF olarak indir.";
  // Kapak fotoğrafı — CoverPattern.jsx ile AYNI Picsum seed mantığı (bkz. o
  // dosyanın yorumu): seed-URL'ler tasarım gereği asla 404 vermez.
  const image = `https://picsum.photos/seed/${encodeURIComponent(template?.cover_url || "routinix-nexus")}/1200/630`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  res.status(200).send(`<!doctype html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta property="og:site_name" content="Routinix Execution Engine" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<a href="${escapeHtml(pageUrl)}">Routinix Nexus'ta görüntüle →</a>
</body>
</html>`);
}
