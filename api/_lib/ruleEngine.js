// Zero-AI Rule Engine — AI Koç'un serbest metin girişinde, mesaj zaten var
// olan bir HAZIR AKSİYONLA (lighten/intensify/postponeToday/analyze —
// aiCoachService.js'teki SAF/deterministik fonksiyonlar) BİREBİR eşleşiyorsa
// Gemini'ye HİÇ gitmeden doğrudan o aksiyonu çalıştırır. Maliyet: 0 TL,
// gecikme: ~0ms (network round-trip yok).
//
// KAPSAM BİLİNÇLİ OLARAK DAR TUTULDU: yalnızca ZATEN deterministik bir
// karşılığı olan (DB şemasında/mevcut kodda gerçekten var olan) aksiyonlar
// eşleştirilir — "arşive taşı" (tasks tablosunda `archived` kolonu YOK) ve
// "görev sırasını değiştir" (açık bir `sort_order` kolonu YOK) BİLEREK
// buraya EKLENMEDİ. Bunlar gerçek bir ürün/şema kararı gerektirir (yeni
// kolon + RLS policy + UI); var olmayan bir alanı "destekliyormuş gibi"
// sessizce yutup hiçbir şey yapmamak, kullanıcıya YALAN söylemek olurdu.
//
// YANLIŞ EŞLEŞME RİSKİ: burada NLP/embedding YOK, düz anahtar kelime +
// olumsuzluk koruması var. Bu bilinçli bir ödünleşim — YANLIŞ bir
// deterministik aksiyonu SESSİZCE çalıştırmak (AI'ın en azından "emin
// değilim" diyebildiği bir durumdan) çok daha kötü bir kullanıcı deneyimi.
// Bu yüzden kurallar KASITLI OLARAK dar/kısa mesajlarla sınırlı ve emin
// olunamayan HER durumda `null` dönüp AI'a (coachPrompt.js) devrediyor —
// "yanlışlıkla AI'ya git" her zaman "yanlışlıkla yanlış aksiyonu çalıştır"dan
// güvenlidir.
const NEGATION_WORDS = ["değil", "istemiyorum", "yapma", "sanmıyorum", "hayır", "yapmayalım", "etme"];
// Birden fazla farklı aksiyonun anahtar kelimesi AYNI ANDA geçiyorsa (ör.
// "hafiflet ama sıkılaştırma da düşünüyorum") bu KARIŞIK/belirsiz bir
// istek — deterministik EŞLEŞTİRME YAPILMAZ, AI'a devredilir.
const RULES = [
  {
    action: "postponeToday",
    // aiCoachService.postponeDayTasks + findTodayDay — "Bugün Çok Yoruldum" quick action'ıyla AYNI.
    patterns: [/bugün.{0,15}(kaydır|ertele|atla|pas geç)/i, /yarına (kaydır|ertele|at)/i, /bugün çok yoruldum/i, /dinlenmeye al/i, /bugünü (atla|geç)/i],
  },
  {
    action: "lighten",
    // aiCoachService.lightenTasks — "Planı Hafiflet" quick action'ıyla AYNI.
    patterns: [/\bhafiflet/i, /yük\w*.{0,12}azalt/i, /\bkolaylaştır/i],
  },
  {
    action: "intensify",
    // aiCoachService.intensifyTasks — "Tempoyu Sıkılaştır" quick action'ıyla AYNI.
    patterns: [/sıkılaştır/i, /yoğunlaştır/i, /\bhızlandır/i, /\bzorlaştır/i],
  },
  {
    action: "analyze",
    // aiCoachService.analyzeProgress — "Gidişatımı Analiz Et" quick action'ıyla AYNI.
    patterns: [/gidişat/i, /nasıl gidiyor/i, /durumum ne/i, /ilerlemem/i],
  },
];

const MAX_WORDS = 14; // uzun/çok cümlecikli mesajlar nüans taşıyabilir — deterministik eşleştirme yapma.

// Rule engine'in KAPSAMADIĞI (add_task/delete_task/resize_plan gibi) bir
// niyetin sinyali de mesajda varsa, BİR rule kelimesi eşleşmiş olsa bile
// BİLEREK AI'a devredilir. Örnek: "hafiflet ama 3. güne yeni görev de ekle"
// — "hafiflet" eşleşir ama mesaj AYNI ZAMANDA add_task istiyor; yalnızca
// lighten'ı çalıştırıp "ekle" kısmını sessizce yok saymak YANLIŞ bir
// deterministik aksiyon olurdu.
const OTHER_INTENT_WORDS = ["ekle", "sil", "kaldır", "çıkar", "uzat", "kısalt", "indir", "değiştir"];

// message: kullanıcının ham serbest metni. Döner: "lighten" | "intensify" |
// "postponeToday" | "analyze" | null (eşleşme yok -> coach-action.js AI'a devreder).
export function matchDeterministicIntent(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!text) return null;
  if (text.split(/\s+/).length > MAX_WORDS) return null;
  if (NEGATION_WORDS.some((w) => text.includes(w))) return null;
  if (OTHER_INTENT_WORDS.some((w) => text.includes(w))) return null;

  const matchedActions = RULES.filter((r) => r.patterns.some((p) => p.test(text))).map((r) => r.action);
  if (matchedActions.length !== 1) return null; // 0 eşleşme YA DA karışık/belirsiz (>1) -> AI'a devret.
  return matchedActions[0];
}
