// PDF içe aktarma — metni pdfjs-dist ile çıkarır (yalnızca METİN ÇIKARIMI;
// yapısal ayrıştırma artık /api/parse-file üzerinden Gemini'de yapılır, bkz.
// ManualPlanBuilder.jsx handleUniversalFileUpload). DÜRÜSTLÜK NOTU: bu
// yalnızca PDF'in metin katmanını okur; taranmış/görsel (fotoğraflanmış)
// PDF'lerde güvenilir sonuç VERMEZ (Gemini'ye boş/anlamsız metin gider) — bu
// sınır kullanıcıya ImportFormatModal'da açıkça belirtilir.
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
