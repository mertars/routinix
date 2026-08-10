// Dinamik "Ek İstek / Soru" Alanı (Smart Prompt Assistant) — TEK doğruluk
// kaynağı. constants.js'teki 4 GERÇEK kategoriye (software/fitness/vacation/
// general) göre anahtarlanır — CategoryIntro.jsx'in "Eklemek istediğin bir
// şey var mı?" kutusu (extraNote) buradan okur: mikro rehber metni, ilham
// verici placeholder ve tıklanınca kutuya EKLENEN neon öneri çipleri.
//
// NOT: kullanıcının verdiği "Study" örnek çip seti (Yanlış Soru Analizi/Gece
// Tekrarı/Telefon Detoksu) sınav/tekrar odaklı olduğundan "general" (Öğrenme
// & Diğer — dil/sınav/meta-learning) kategorisine, "software" (Yazılım &
// Mühendislik) ise kendi kodlama-özel setine ayrıldı; "vacation" için ayrı
// bir set eklendi (kullanıcı örneklerinde yoktu).
export const SUGGESTIONS_BY_CATEGORY = {
  fitness: {
    guide: "Antrenmanına özel detaylar ekle — beslenme, kardiyo, form kontrolü...",
    placeholder: "Örn: Haftada 2 gün kardiyo istiyorum, dizimi zorlamayan hareketler seç...",
    chips: [
      { label: "+ Su & Kreatin Takibi", insertText: "Günlük su ve kreatin takibimi de plana dahil et." },
      { label: "+ Kardiyo Bloğu", insertText: "Haftaya en az 2 kardiyo bloğu ekle." },
      { label: "+ Forma Uygun Video", insertText: "Her antrenmana form kontrolü için örnek video/gösterim öner." },
    ],
  },
  software: {
    guide: "Çalışma ritmine özel detaylar ekle — kaynak tercihi, tekrar, mola düzeni...",
    placeholder: "Örn: Sabahları daha verimliyim, akşamları sadece hafif tekrar istiyorum...",
    chips: [
      { label: "+ Kod Review Molası", insertText: "Haftaya kendi kodumu gözden geçireceğim bir kod review bloğu ekle." },
      { label: "+ Hata Ayıklama Pratiği", insertText: "Gerçek hatalar üzerinden debug pratiği yapacağım görevler ekle." },
      { label: "+ Teknik Makale Okuma", insertText: "Her hafta bir teknik makale/dokümantasyon okuma görevi ekle." },
    ],
  },
  vacation: {
    guide: "Gezinle ilgili tercihlerini ekle — bütçe, tempo, ilgi alanların...",
    placeholder: "Örn: Bütçem sınırlı, yürüyerek gezmeyi seviyorum, müzeleri kaçırma...",
    chips: [
      { label: "+ Bütçe Dostu Rota", insertText: "Rotayı bütçe dostu seçeneklere göre kurgula." },
      { label: "+ Yerel Lezzet Molası", insertText: "Her güne yerel bir lezzeti deneyeceğim bir mola ekle." },
      { label: "+ Fotoğraf Noktaları", insertText: "Manzaralı fotoğraf noktalarını rotaya işle." },
    ],
  },
  general: {
    guide: "Planına özel detay, kısıtlama ya da çalışma tercihini ekle...",
    placeholder: "Örn: Hafta sonları müsait değilim, tekrarları akşama bırakmak istiyorum...",
    chips: [
      { label: "+ Yanlış Soru Analizi", insertText: "Yanlış yaptığım soruları analiz edeceğim bir bloğu her haftaya ekle." },
      { label: "+ Gece Tekrarı", insertText: "Günün sonunda kısa bir gece tekrarı görevi ekle." },
      { label: "+ Telefon Detoksu", insertText: "Odak bloklarında telefon detoksu hatırlatıcısı ekle." },
    ],
  },
};

export function getPromptSuggestions(category) {
  return SUGGESTIONS_BY_CATEGORY[category] || SUGGESTIONS_BY_CATEGORY.general;
}
