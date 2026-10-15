// Türkiye tarih/saat biçimi — 24 saat, Türkçe ay/gün adları.
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const p2 = (n) => String(n).padStart(2, "0");

export const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const formatTime = (ts) => {
  const d = new Date(ts);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
export const monthKey = (ts) => dayKey(ts).slice(0, 7);
export const monthLabel = (ts) => {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const shiftMonth = (ts, delta) => {
  const d = new Date(ts);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return d.getTime();
};
export const monthRange = (ts) => {
  const d = new Date(ts);
  const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return [from, to];
};

export function dayLabel(ts, now = Date.now()) {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Dün";
  const d = new Date(ts);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const y = d.getFullYear() !== new Date(now).getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${base}${y} ${DAYS[d.getDay()]}`;
}

export function dateTimeLabel(ts, now = Date.now()) {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);
  const d = new Date(ts);
  const date = diff === 0 ? "Bugün" : diff === 1 ? "Dün" : `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return `${date} ${formatTime(ts)}`;
}

export function fullDateTime(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${DAYS[d.getDay()]} · ${formatTime(ts)}`;
}

export const withTime = (dayTs, h, m) => {
  const d = new Date(dayTs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

// <input type="date"> için "YYYY-MM-DD" ↔ gün başı
export const toDateInput = (ts) => dayKey(ts);
export const fromDateInput = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

export const trLower = (s) => (s || "").toLocaleLowerCase("tr-TR");

// ---- Parça 2: dönem (maaş günü), ay toplama, göreli gün ----
export const addDays = (ts, n) => {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
};
// Ay ekle; gün, ANCAK başlangıç gününe göre kısaltılır (31 Oca → 28 Şub → 31 Mar).
export const addMonthsClamped = (ts, n) => {
  const d = new Date(ts);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes(), 0, 0);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return t.getTime();
};
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

// Bütçe dönemi: ay başlangıç günü (1–28, maaş günü) → [başlangıç, bitiş).
export function periodRange(ts, startDay = 1) {
  const d = new Date(ts);
  let y = d.getFullYear();
  let m = d.getMonth();
  if (d.getDate() < startDay) m -= 1;
  return [new Date(y, m, startDay).getTime(), new Date(y, m + 1, startDay).getTime()];
}
// Dönemi `delta` dönem kaydır; dönemin BAŞLANGIÇ gününü korur (maaş günü 25 → 25. günden başlar).
export const shiftPeriod = (ts, delta, startDay = 1) => {
  const from = new Date(periodRange(ts, startDay)[0]);
  return new Date(from.getFullYear(), from.getMonth() + delta, startDay).getTime();
};
export function periodLabel(ts, startDay = 1) {
  if (startDay === 1) return monthLabel(ts);
  const [from, to] = periodRange(ts, startDay);
  const f = new Date(from);
  const t = new Date(to - 86400000);
  return `${f.getDate()} ${MONTHS[f.getMonth()].slice(0, 3)} – ${t.getDate()} ${MONTHS[t.getMonth()].slice(0, 3)}`;
}
export function relativeDayLabel(days) {
  if (days === 0) return "Bugün";
  if (days === 1) return "Yarın";
  if (days > 1) return `${days} gün sonra`;
  return `${-days} gün gecikti`;
}
export const shortDate = (ts) => {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};
export const longMonthYear = (ts) => monthLabel(ts);
