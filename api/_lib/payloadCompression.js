// Dynamic Prompt & Payload Compression — DÜRÜST DURUM TESPİTİ:
// Bu dosyanın var olma sebebi, İLERİDE bir geliştiricinin bir prompt'a HAM
// bir JS nesnesini `JSON.stringify(obj)` ile gömme isteğine düşmesi
// durumunda hazır, test edilmiş bir yardımcı bulunmasıdır — BUGÜN için
// ölçülebilir bir tasarruf VAAT ETMİYORUZ, çünkü projedeki 5 Gemini
// çağrısının (coachPrompt.js/planPrompt.js/rhythmPrompt.js) HİÇBİRİ ham
// JSON.stringify çıktısı göndermiyor (grep ile doğrulandı: `api/_lib/`
// içinde SIFIR `JSON.stringify` çağrısı var). Context builder'ların hepsi
// (describeTargetPlan, describeOtherPlan, describeUserInput, rhythm
// context'i) ZATEN elle yazılmış, kompakt, pipe/virgülle ayrılmış düz
// metin üretiyor — "gereksiz boşluk/null alan/uzun anahtar ismi" temizliği
// istenen bir problemi ÇÖZMÜYOR, çünkü o problem bu kod tabanında YOK.
//
// Bu yüzden bu modülü ("her API çağrısından önce otomatik sıkıştır" gibi
// genel bir katman olarak) HERKESE ZORUNLU KILMADIK — yalnızca ihtiyaç
// duyulursa kullanılacak bir yardımcı olarak sunuyoruz.
export function compactJson(value) {
  // JSON.stringify(value) (boşluksuz/varsayılan) zaten "minified" — asıl
  // kazanç null/undefined alanları VE boş dizi/nesneleri BUDAMAKTAN gelir,
  // çünkü bunlar model için bilgi taşımaz ama anahtar adı + noktalama için
  // token harcatır.
  const prune = (v) => {
    if (Array.isArray(v)) {
      const arr = v.map(prune).filter((x) => x !== undefined);
      return arr.length ? arr : undefined;
    }
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, val] of Object.entries(v)) {
        const p = prune(val);
        if (p !== undefined && p !== null && p !== "") out[k] = p;
      }
      return Object.keys(out).length ? out : undefined;
    }
    return v;
  };
  return JSON.stringify(prune(value) ?? {});
}

// Sistem talimatlarındaki dolgu kelime/bağlaç temizliği BİLEREK OTOMATİK
// UYGULANMADI. planPrompt.js/coachPrompt.js/rhythmPrompt.js'teki persona ve
// kural metinleri özenle yazılmış doğal Türkçe — modelin niyeti/kuralları
// doğru anlaması bu netliğe dayanıyor. Körlemesine bir "filler word
// stripper" ("kaliteden ödün vermeden" şartını ihlal etme riskiyle) bu
// metinleri telgraf-diline çevirebilir; bunun net faydası (tahminen input
// token'larının zaten küçük bir payı, bkz. proje sohbet geçmişindeki ölçüm:
// input 500-3200 token aralığında, dominant maliyet zaten output+thinking
// idi) ile kalite riski dengeli değil. Eğer ileride denenirse: DEĞİŞİKLİĞİ
// A/B test et (aynı goal'le eski/yeni prompt'u karşılaştır, JSON doğruluğu +
// içerik kalitesini gözden geçir) — bu dosyadaki test script'leri (bkz.
// proje geçmişi) aynı yöntemle tekrar kullanılabilir.
