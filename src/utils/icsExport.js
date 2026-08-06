// Studio Builder'ın yerel (henüz kaydedilmemiş olabilir) plan durumunu
// standart bir iCalendar (.ics) dosyasına çevirir — Google/Apple/Outlook
// Takvim'e doğrudan içe aktarılabilir. Kütüphane GEREKMEZ: iCalendar RFC5545
// düz metin bir formattır, burada elle üretilir.
//
// TARİH/SAAT VARSAYIMI (dürüstlük notu — gerçek bir zamanlayıcı DEĞİLDİR):
// planın "1. Gün"ü BUGÜNE bağlanır, sonraki her gün art arda bir sonraki
// takvim gününe düşer (plan hafta içi/sonu ayrımı yapmaz — N gün art arda).
// Bir görevin detayında "🕐 HH:MM" notu varsa (Tarih & Saat özelliği
// açıkken Hızlı Ekle'de girilmiş olabilir) o saatte, yoksa varsayılan olarak
// 09:00'da başlar; süre duration_min'den (yoksa 30dk varsayılan) gelir.
// "Z" (UTC) SONEKİ KULLANILMAZ — takvim olayları kullanıcının kendi yerel
// saatinde ("floating time") yazılır, bu plan-günleri bağlamında doğru
// yorum: sabit bir UTC ana değil, kullanıcının yaşadığı günün saatine göre.
function pad(n) {
  return String(n).padStart(2, "0");
}

function toIcsLocal(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function escapeIcsText(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function extractTimeOfDay(detail) {
  const m = /🕐\s*(\d{1,2}):(\d{2})/.exec(detail || "");
  if (!m) return null;
  const h = Math.min(23, parseInt(m[1], 10));
  const min = Math.min(59, parseInt(m[2], 10));
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return { h, min };
}

// days: { [dayNumber]: [{ title, detail, duration_min, priority, map_search_query }] }
export function buildIcsCalendar({ title, days }) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Routinix//Plan Studio//TR", "CALSCALE:GREGORIAN"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stamp = `${toIcsLocal(new Date())}`;
  const dayNumbers = Object.keys(days || {})
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  let uidCounter = 0;
  for (const dayNum of dayNumbers) {
    const tasks = days[dayNum] || [];
    if (!tasks.length) continue;
    const dayDate = new Date(today);
    dayDate.setDate(dayDate.getDate() + Math.max(0, dayNum - 1));

    for (const t of tasks) {
      const taskTitle = (t.title || "").trim();
      if (!taskTitle) continue;
      const time = extractTimeOfDay(t.detail) || { h: 9, min: 0 };
      const start = new Date(dayDate);
      start.setHours(time.h, time.min, 0, 0);
      const durationMin = Number(t.duration_min) > 0 ? Number(t.duration_min) : 30;
      const end = new Date(start.getTime() + durationMin * 60000);

      uidCounter += 1;
      lines.push(
        "BEGIN:VEVENT",
        `UID:routinix-${Date.now()}-${uidCounter}@routinix.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${toIcsLocal(start)}`,
        `DTEND:${toIcsLocal(end)}`,
        `SUMMARY:${escapeIcsText(`${taskTitle} (Gün ${dayNum})`)}`
      );
      if (t.detail) lines.push(`DESCRIPTION:${escapeIcsText(t.detail)}`);
      if (t.map_search_query) lines.push(`LOCATION:${escapeIcsText(t.map_search_query)}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  // iCalendar satırları CRLF ile ayrılır (RFC5545) — bazı istemciler
  // yalnızca \n ile de çalışır ama spesifikasyona tam uymak en güvenlisi.
  return lines.join("\r\n");
}

export function downloadIcsFile(filenameBase, icsText) {
  const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(filenameBase || "kendi-planim").toString().trim().replace(/\s+/g, "-").toLowerCase() || "kendi-planim"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
