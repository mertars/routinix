// Uzun rutin metnini eylem odaklı kısa etikete indirger + içeriğe göre emoji
// seçer. RoutinesPopover.jsx ve PlanBoard.jsx (Rutin rozetleri) ortak kullanır.
const KEYWORD_EMOJI = [
  [/(plaj|deniz|kumsal|koy|tekne)/i, "🏖️"],
  [/(sabah|erken|uyan|kalk)/i, "🌅"],
  [/(koş|kardiyo|yürü|cardio)/i, "🏃"],
  [/(\bsu\b|hidra|matara)/i, "💧"],
  [/(kitap|oku|makale|döküman)/i, "📚"],
  [/(kod|yazılım|program|docker|git|api)/i, "💻"],
  [/(kelime|anki|srs|tekrar|spaced)/i, "🧠"],
  [/(beslen|protein|öğün|yemek|diyet|kalori)/i, "🥗"],
  [/(uyku|dinlen|toparlan|recovery)/i, "😴"],
  [/(esne|mobility|ısın|stretch)/i, "🤸"],
  [/(medita|nefes|zihin|farkındalık)/i, "🧘"],
  [/(pratik|egzersiz|çalış|antren)/i, "✍️"],
  [/(fotoğraf|gez|rota|ziyaret)/i, "📍"],
];

export function routineEmoji(text) {
  for (const [re, e] of KEYWORD_EMOJI) if (re.test(text)) return e;
  return "🔁";
}

export function routineMicroLabel(text) {
  let s = (text || "").trim();
  s = s.replace(/^[^:]{0,22}:\s*/, ""); // "Sabah (15 dk): ..." önekini at
  s = s.split(/[.;]|\s[—-]\s/)[0].trim(); // ilk cümle/clause
  if (s.length > 34) s = s.slice(0, 33).trim() + "…";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
