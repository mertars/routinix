// PDF içe aktarma — metni pdfjs-dist ile çıkarır. DÜRÜSTLÜK NOTU: bu yalnızca
// PDF'in metin katmanını okur; taranmış/görsel (fotoğraflanmış) PDF'lerde
// veya çok sütunlu karmaşık düzenlerde güvenilir sonuç VERMEZ — en iyi
// sonucu Routinix'in kendi PDF/Markdown/TXT dışa aktarımı gibi düz,
// tek-sütunlu, "Gün N" başlıklı belgelerde verir (bkz. planImportParsers.js
// dosya başı yorumu, aynı ayrıştırıcıyı paylaşır). Bu sınır kullanıcıya
// ImportFormatModal'da açıkça belirtilir.
//
// Dinamik import: pdfjs-dist (~1MB+) yalnızca kullanıcı GERÇEKTEN bir PDF
// seçtiğinde indirilir — Vite bunu ayrı bir chunk'a böler, ana paketi
// büyütmez.
//
// onProgress(percent:number) — her sayfa işlendiğinde çağrılır (0-100).
// Çok sayfalı PDF'lerde UI'da gerçek bir ilerleme çubuğu göstermek için.
export async function extractTextFromPdf(file, onProgress) {
  const pdfjsLib = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // pdfjs metni sabit olmayan "item" parçalarına böler (satır/kelime
    // granülerliği garantili değil) — art arda gelen item'ları birleştirip
    // Y koordinatı belirgin şekilde değiştiğinde yeni satır varsayarak
    // kaba bir satır yapısı yeniden kurulur.
    let lastY = null;
    let line = "";
    const lines = [];
    for (const item of content.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
        lines.push(line);
        line = "";
      }
      line += item.str;
      lastY = item.transform[5];
    }
    if (line) lines.push(line);
    pageTexts.push(lines.join("\n"));
    if (typeof onProgress === "function") onProgress(Math.round((pageNum / pdf.numPages) * 100));
  }
  return pageTexts.join("\n\n");
}
