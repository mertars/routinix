// GuidedTemplateForm.jsx'in 4 rehberli sorusunun cevaplarını, başlıklarla
// süslenmiş, akıcı bir Markdown metnine dönüştürür ("Story Merger"). Saf
// fonksiyon — DOM/React bağımsız, hem client (önizleme) hem gerektiğinde
// başka bir yerde (ör. ileride bir sunucu tarafı doğrulama) yeniden
// kullanılabilir.
const SECTIONS = [
  { key: "impact", title: "Hayatıma Katkısı" },
  { key: "process", title: "Süreç Nasıl İlerledi" },
  { key: "prosCons", title: "Artıları & Eksileri" },
  { key: "tips", title: "Tavsiyeler & Püf Noktaları" },
];

// answers: { impact, process, prosCons, tips } — dördü de düz metin.
// Dönüş: hazır gösterime uygun Markdown string (## başlıklar + paragraflar).
export function formatTemplateStory(answers = {}) {
  const parts = [];
  for (const { key, title } of SECTIONS) {
    const text = (answers[key] || "").trim();
    if (!text) continue;
    parts.push(`## ${title}\n${text}`);
  }
  return parts.join("\n\n");
}

// Basit, bağımlılıksız bir Markdown→JSX dönüştürücü — yalnızca bu modülün
// ÜRETTİĞİ kısıtlı şema (## başlıklar + düz paragraflar, "+"/"-" ile
// başlayan satırlar) için yeterlidir; genel amaçlı bir Markdown render
// kütüphanesi eklemekten kaçınmak için (yeni bağımlılık, gereksiz genişlik)
// bilerek minimal tutuldu. `key`, çağıran yerde React listesi için eklenir.
export function parseStorySections(markdown) {
  if (!markdown) return [];
  return markdown
    .split(/\n(?=## )/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [firstLine, ...rest] = block.split("\n");
      const title = firstLine.replace(/^##\s*/, "");
      const body = rest.join("\n").trim();
      return { title, body };
    });
}
