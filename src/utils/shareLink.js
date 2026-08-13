// Nexus link paylaşımı — TEK yerden URL/mesaj üretimi (TemplateDetailModal.jsx
// VE SharedTemplateView.jsx'in "Linki Kopyala" aksiyonları bunu paylaşır).
//
// DOMAIN NOTU: `routinix.app` gibi sabit bir alan adı BİLEREK yazılmaz — bu
// projenin GERÇEKTEN o alan adına deploy edildiğini doğrulayamam (yanlışsa
// paylaşılan link kırık olur). `window.location.origin` her zaman o an
// çalışan GERÇEK adresi verir — yerelde (localhost:5173), önizlemede
// (*.vercel.app) veya gerçek prod alan adında, her ortamda doğru sonucu üretir.
export function buildTemplateShareUrl(template) {
  return `${window.location.origin}/t/${template.slug || template.id}`;
}
