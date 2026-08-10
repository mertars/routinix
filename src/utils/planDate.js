// Dinamik Gün/Tarih Bağlama Sistemi — TEK doğruluk kaynağı (saf tarih
// matematiği). usePlanDate.js (tikleyen React hook'u) ve usePlanStudio.js
// (start_date'i DB'ye yazan aksiyon) İKİSİ de buradan okur.
const DAY_MS = 24 * 60 * 60 * 1000;

// Postgres `date` tipi "YYYY-MM-DD" döner — `new Date("YYYY-MM-DD")` bunu
// UTC gece yarısı olarak ayrıştırır ve negatif UTC ofsetli saat dilimlerinde
// yerel saate çevrilince BİR GÜN GERİ kayar. icsExport.js'teki AYNI, yerel
// `Date` aritmetiği (yıl/ay/gün ile inşa + setDate) burada da kullanılıyor.
export function parseDateOnly(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// N. günün GERÇEK takvim tarihi: start_date + (N-1) gün.
export function dayNumberToDate(startDateStr, dayNumber) {
  const d = parseDateOnly(startDateStr);
  d.setDate(d.getDate() + Math.max(0, (dayNumber || 1) - 1));
  return d;
}

// Bugün planın kaçıncı günü — yerel gece yarısına göre normalize edilir,
// böylece hesap `new Date()`'in saatine değil yalnızca GÜNÜNE bakar (00:00'ı
// geçince otomatik bir sonraki güne geçer, bkz. usePlanDate.js'in gece yarısı
// zamanlayıcısı).
export function computeCurrentDayNumber(startDateStr) {
  if (!startDateStr) return 1;
  const start = parseDateOnly(startDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - start) / DAY_MS);
  return Math.max(1, diffDays + 1);
}

// Bir sonraki yerel gece yarısına kaç ms kaldığı — birkaç saniyelik güvenlik
// payıyla (tam 00:00:00'da bazı tarayıcılarda setTimeout birkaç ms erken
// tetiklenip henüz "dünün" gününü hesaplayabiliyor).
export function msUntilNextLocalMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
  return next.getTime() - now.getTime();
}

// Tarih Kaydırma (Cascading Shift): kullanıcı N. gündeki tarih seçiciden
// tarihi selectedDateStr'e değiştirdiğinde, TÜM planın (1. günden itibaren)
// buna göre kaymasını sağlayan YENİ start_date'i hesaplar —
// newStartDate = selectedDate - (N-1) gün.
export function shiftStartDateForDay(dayNumber, selectedDateStr) {
  const selected = parseDateOnly(selectedDateStr);
  selected.setDate(selected.getDate() - Math.max(0, (dayNumber || 1) - 1));
  return formatDateOnly(selected);
}
