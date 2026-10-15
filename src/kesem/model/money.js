// Türkiye para biçimi: 1.234,50 ₺ — tutarlar kuruş (tam sayı).
const SYMBOLS = { TRY: "₺", EUR: "€", USD: "$", GBP: "£" };
const NBSP = " ";

export const currencySymbol = (c = "TRY") => SYMBOLS[c] || c;

function group(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatMoney(minor, currency = "TRY", { sign = false, hideZeroDecimals = false } = {}) {
  const n = Number.isFinite(minor) ? Math.round(minor) : 0;
  const neg = n < 0;
  const abs = Math.abs(n);
  const lira = Math.floor(abs / 100);
  const kurus = abs % 100;
  let s = group(String(lira));
  if (!(hideZeroDecimals && kurus === 0)) s += "," + String(kurus).padStart(2, "0");
  const prefix = neg ? "−" : sign && n > 0 ? "+" : "";
  return `${prefix}${s}${NBSP}${currencySymbol(currency)}`;
}

// Tuş takımı girdisi ("1234,5") → kuruş. Geçersiz/boş → 0.
export function parseAmountInput(str) {
  if (!str) return 0;
  const [i = "0", d = ""] = str.split(",");
  const lira = parseInt(i || "0", 10) || 0;
  const kurus = parseInt((d + "00").slice(0, 2), 10) || 0;
  return lira * 100 + kurus;
}

export function minorToInput(minor) {
  if (!minor) return "";
  const lira = Math.floor(minor / 100);
  const kurus = minor % 100;
  return kurus ? `${lira},${String(kurus).padStart(2, "0").replace(/0$/, "")}` : String(lira);
}

// Girdi dizesine bir tuş uygula — sınırlar: 9 tam hane, 2 ondalık.
export function pressKey(cur, key) {
  if (key === "back") return cur.slice(0, -1);
  if (key === ",") {
    if (cur.includes(",")) return cur;
    return (cur || "0") + ",";
  }
  // rakam
  const [i, d] = cur.split(",");
  if (cur.includes(",")) return d.length >= 2 ? cur : cur + key;
  if (i.length >= 9) return cur;
  if (i === "0") return key === "0" ? cur : key;
  return cur + key;
}

// Girdi dizesini ekranda gruplu göster ("1234,5" → "1.234,5").
export function displayInput(str) {
  if (!str) return "0";
  const [i, d] = str.split(",");
  return group(i || "0") + (str.includes(",") ? "," + (d ?? "") : "");
}

// ---- Parça 2: çoklu para birimi (manuel kur) ----
export const BASE_CURRENCY = "TRY";
export const CURRENCIES = ["TRY", "USD", "EUR"];
export const CURRENCY_NAMES = { TRY: "Türk Lirası", USD: "ABD Doları", EUR: "Euro" };

// rates: { USD: { rate: 34.5, updatedAt }, ... } — 1 birim = `rate` ₺. TRY her zaman 1.
export const rateOf = (cur, rates) => (cur === BASE_CURRENCY ? 1 : rates?.[cur]?.rate > 0 ? rates[cur].rate : null);

// minor (kuruş/cent) → hedef para birimi minor. Kur yoksa null.
export function convertMinor(minor, from, to, rates) {
  if (from === to) return minor;
  const rf = rateOf(from, rates);
  const rt = rateOf(to, rates);
  if (!rf || !rt) return null;
  return Math.round((minor * rf) / rt);
}

// Bir işlemin/kaydın ₺ karşılığı: önce kayıtlı `baseMinor`, yoksa TRY ise kendisi.
export const baseOf = (rec, rates) => {
  if (rec.baseMinor != null) return rec.baseMinor;
  const c = rec.currency || BASE_CURRENCY;
  if (c === BASE_CURRENCY) return rec.amountMinor;
  return convertMinor(rec.amountMinor, c, BASE_CURRENCY, rates) ?? rec.amountMinor;
};

export const formatRate = (r) => (r ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(r) : "—");

// ---- Parça 3: gizlilik maskesi + kompakt biçim ----
let maskOn = false;
export const setMoneyMask = (v) => { maskOn = !!v; };
// Metin bağlamları (bildirim şeridi, aria-label, dışa aktarma DEĞİL): gizlilik modunda maskeli.
export function formatMoneyText(minor, currency = "TRY", opts) {
  return maskOn ? `••••${NBSP}${currencySymbol(currency)}` : formatMoney(minor, currency, opts);
}
// Takvim hücresi gibi dar yerler için: 850 · 1,2B · 3,4M  (Türkçe: B = bin)
export function formatCompact(minor) {
  const v = Math.abs(minor) / 100;
  const f = (n) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
  if (v >= 1e6) return f(v / 1e6) + "M";
  if (v >= 1e3) return f(v / 1e3) + "B";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(v);
}
