// Plan Studio & Editor Engine — Akıllı İçe Aktarma. Markdown/TXT/PDF-metni
// (PDF önce pdfjs-dist ile düz metne çevrilir, ardından BURADAKİ AYNI
// ayrıştırıcıdan geçer) için TEK, dürüstçe belgelenmiş bir kural seti:
//
//   # Plan Başlığı              <- yalnızca gün/rutin bölümünden ÖNCE, tek satır
//   ## Gün 1  (veya "1. Gün" / "Day 1" — "#" işaretleri opsiyonel, TXT'de hiç yok)
//   - Görev adı | 30dk | Yüksek | 50₺   <- " | " ile ayrılmış alanlar OPSİYONEL
//   - Başka görev
//   ## Rutinler  (veya "Routines")
//   - Her sabah su iç | Hafta İçi        <- 2. alan opsiyonel sıklık
//
// Bu SEZGİSEL bir ayrıştırıcıdır — serbest biçimli/karmaşık belgeleri
// %100 doğru ayrıştırma iddiası TAŞIMAZ; en iyi sonucu yukarıdaki kalıba
// uyan (ör. Routinix'in kendi Markdown/TXT dışa aktarımı) metinlerde verir.
// Kullanıcı içe aktarımdan sonra HER ZAMAN Builder ekranında sonucu görüp
// elle düzeltebilir — sessiz/görünmez bir veri kaybı yoktur.

// JS'in varsayılan case-insensitive regex eşleşmesi (/i bayrağı) Türkçe
// büyük "İ"yi standart "i"ye KATLAMAZ (bilinen "Turkish I problemi") —
// "RUTİNLER" gibi doğal yazılmış bir Türkçe anahtar kelime bu yüzden
// /rutin/i gibi bir düzenli ifadeyle SESSİZCE eşleşmeyebilirdi. Aşağıdaki
// başlık/sıklık düzenli ifadeleri bu yüzden /i bayrağı YERİNE, önce
// trNormalizeForMatch() ile normalize edilmiş metne karşı çalıştırılır —
// yalnızca EŞLEŞTİRME amaçlı, kullanıcıya gösterilen/kaydedilen başlık ve
// görev metinleri asla değiştirilmez.
function trNormalizeForMatch(s) {
  return s.replace(/İ/g, "i").replace(/I/g, "i").toLowerCase();
}

const DAY_HEADER_RE = /^#{0,3}\s*(?:(\d+)\s*\.?\s*(?:g[üu]n|day)|(?:g[üu]n|day)\s*(\d+))\b/;
const ROUTINES_HEADER_RE = /^#{0,3}\s*(rutin(?:ler)?|routines?)\s*:?\s*$/;
const BULLET_RE = /^[-*•]\s+|^\d+[.)]\s+/;
const TITLE_LINE_RE = /^#\s+(.+)$/;

const PRIORITY_MAP = {
  yüksek: "Yüksek", yuksek: "Yüksek", high: "Yüksek",
  orta: "Orta", medium: "Orta",
  düşük: "Düşük", dusuk: "Düşük", low: "Düşük",
};

function parseFrequencyToken(token) {
  const t = trNormalizeForMatch(token.trim());
  if (/hafta ?i[çc][iı]|weekday/.test(t)) return "weekdays";
  if (/haftal[ıi]k|weekly/.test(t)) return "weekly";
  return "daily";
}

function parseTaskLine(rawLine) {
  const line = rawLine.replace(BULLET_RE, "").trim();
  if (!line) return null;
  const segments = line.split(" | ").map((s) => s.trim()).filter(Boolean);
  const title = segments[0] || "";
  if (!title) return null;
  const task = { title, duration_min: null, priority: null, estimated_cost: null };
  for (const seg of segments.slice(1)) {
    const durMatch = /^(\d+)\s*(dk|dakika|min)$/i.exec(seg);
    const priorityKey = PRIORITY_MAP[seg.toLowerCase()];
    if (durMatch) {
      task.duration_min = parseInt(durMatch[1], 10);
    } else if (priorityKey) {
      task.priority = priorityKey;
    } else {
      task.estimated_cost = seg;
    }
  }
  return task;
}

function parseRoutineLine(rawLine) {
  const line = rawLine.replace(BULLET_RE, "").trim();
  if (!line) return null;
  const segments = line.split(" | ").map((s) => s.trim()).filter(Boolean);
  const content = segments[0] || "";
  if (!content) return null;
  const frequency = segments[1] ? parseFrequencyToken(segments[1]) : "daily";
  return { content, frequency };
}

// Döner: { title, days: {[dayNumber]: [{title, duration_min, priority, estimated_cost}]}, routines: [{content, frequency}] }
export function parseTextualPlan(text) {
  const lines = String(text || "").split(/\r?\n/);
  let title = "";
  let mode = "title"; // "title" | "days" | "routines"
  let currentDay = null;
  const days = {};
  const routines = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const normalizedLine = trNormalizeForMatch(line);

    const dayMatch = DAY_HEADER_RE.exec(normalizedLine);
    if (dayMatch) {
      currentDay = parseInt(dayMatch[1] || dayMatch[2], 10);
      if (!days[currentDay]) days[currentDay] = [];
      mode = "days";
      continue;
    }
    if (ROUTINES_HEADER_RE.test(normalizedLine)) {
      mode = "routines";
      continue;
    }
    const titleMatch = TITLE_LINE_RE.exec(line);
    if (mode === "title" && titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }
    if (mode === "title" && !BULLET_RE.test(line)) {
      // TXT'de "#" yok — gün/rutin başlığından ÖNCEKİ ilk düz satır başlıktır.
      if (!title) title = line;
      continue;
    }

    if (mode === "days") {
      if (currentDay == null) continue; // henüz bir gün başlığı görülmedi, atla
      const task = parseTaskLine(line);
      if (task) days[currentDay].push(task);
    } else if (mode === "routines") {
      const routine = parseRoutineLine(line);
      if (routine) routines.push(routine);
    }
  }

  return { title, days, routines };
}

// CSV — TEK amaçlı: görev satırları. Rutinler CSV'nin doğal satır/gün
// modeline UYMADIĞI için buradan İÇE AKTARILMAZ — bilinçli bir sınır,
// ImportFormatModal'da kullanıcıya açıkça belirtilir. Beklenen başlık
// satırı (sütun SIRASI önemsiz, eksik sütunlar tolere edilir):
//   gun,baslik,detay,sure_dk,oncelik,butce,konum
function parseCsvLine(line) {
  // Basit RFC4180 alt kümesi: çift tırnak içindeki virgülleri korur.
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

const CSV_COLUMN_ALIASES = {
  gun: "day", day: "day", gün: "day",
  baslik: "title", başlık: "title", title: "title",
  detay: "detail", detail: "detail", not: "detail",
  sure_dk: "duration_min", süre_dk: "duration_min", duration_min: "duration_min", dakika: "duration_min",
  oncelik: "priority", öncelik: "priority", priority: "priority",
  butce: "estimated_cost", bütçe: "estimated_cost", estimated_cost: "estimated_cost", cost: "estimated_cost",
  konum: "map_search_query", location: "map_search_query", map_search_query: "map_search_query",
};

// Döner: { days: {[dayNumber]: [{title, detail, duration_min, priority, estimated_cost, map_search_query}]} }
export function parseCsvPlan(text) {
  const rawLines = String(text || "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) return { days: {} };

  const headerCells = parseCsvLine(rawLines[0]).map((h) => h.toLowerCase());
  const colIndex = {};
  headerCells.forEach((h, i) => {
    const key = CSV_COLUMN_ALIASES[h];
    if (key) colIndex[key] = i;
  });
  if (colIndex.title == null) return { days: {} }; // başlık sütunu yoksa ayrıştırılamaz

  const days = {};
  for (const rawLine of rawLines.slice(1)) {
    const cells = parseCsvLine(rawLine);
    const title = (cells[colIndex.title] || "").trim();
    if (!title) continue;
    const dayNumber = Math.max(1, parseInt(cells[colIndex.day], 10) || 1);
    const durationRaw = colIndex.duration_min != null ? cells[colIndex.duration_min] : "";
    const priorityRaw = colIndex.priority != null ? (cells[colIndex.priority] || "").trim() : "";
    if (!days[dayNumber]) days[dayNumber] = [];
    days[dayNumber].push({
      title,
      detail: colIndex.detail != null ? cells[colIndex.detail] || null : null,
      duration_min: durationRaw && Number.isFinite(parseInt(durationRaw, 10)) ? parseInt(durationRaw, 10) : null,
      priority: PRIORITY_MAP[priorityRaw.toLowerCase()] || null,
      estimated_cost: colIndex.estimated_cost != null ? cells[colIndex.estimated_cost] || null : null,
      map_search_query: colIndex.map_search_query != null ? cells[colIndex.map_search_query] || null : null,
    });
  }
  return { days };
}

// .ics (iCalendar) İÇE AKTARMA — utils/icsExport.js'in buildIcsCalendar()
// ile dışa aktardığı dosyayı GERİ okur. SUMMARY'nin sonundaki "(Gün N)"
// son ekini (KENDİ dışa aktarımımızın imzası) ÖNCELİKLİ olarak kullanır;
// bulunamazsa DTSTART tarihini en erken etkinliğe göre GÖRECELİ gün
// numarasına çevirir — bu ikinci yol, Google/Apple Takvim gibi HARİCİ
// .ics dosyalarını da makul ölçüde okunabilir kılar. RFC5545'in TAMAMI
// (tekrarlayan etkinlikler/RRULE, zaman dilimleri) İDDİA EDİLMEZ —
// yalnızca satır katlama (folding) + VEVENT/SUMMARY/DTSTART/DESCRIPTION/
// LOCATION alanları ayrıştırılır; bu, kendi dışa aktarımımız ve çoğu basit
// takvim dosyası için yeterlidir.
function unfoldIcsLines(text) {
  const rawLines = String(text || "").split(/\r\n|\n|\r/);
  const lines = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function unescapeIcsText(s) {
  return String(s || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/.exec(String(value || "").trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h || 0), Number(mi || 0));
}

export function parseIcsPlan(text) {
  const lines = unfoldIcsLines(text);
  const events = [];
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const key = rawKey.split(";")[0].toUpperCase(); // "DTSTART;TZID=..." -> "DTSTART"
    if (key === "SUMMARY") current.summary = unescapeIcsText(value);
    else if (key === "DESCRIPTION") current.description = unescapeIcsText(value);
    else if (key === "LOCATION") current.location = unescapeIcsText(value);
    else if (key === "DTSTART") current.dtstart = parseIcsDate(value);
  }

  if (events.length === 0) return { days: {} };

  const validDates = events.map((e) => e.dtstart).filter(Boolean);
  const earliest = validDates.length
    ? new Date(Math.min(...validDates.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())))
    : null;

  const days = {};
  for (const ev of events) {
    const rawTitle = (ev.summary || "").trim();
    if (!rawTitle) continue;
    const dayMatch = /\(Gün (\d+)\)\s*$/i.exec(rawTitle);
    let dayNumber;
    let title = rawTitle;
    if (dayMatch) {
      dayNumber = parseInt(dayMatch[1], 10);
      title = rawTitle.slice(0, dayMatch.index).trim();
    } else if (ev.dtstart && earliest) {
      const evDay = new Date(ev.dtstart.getFullYear(), ev.dtstart.getMonth(), ev.dtstart.getDate());
      dayNumber = Math.round((evDay - earliest) / 86400000) + 1;
    } else {
      dayNumber = 1;
    }
    dayNumber = Math.max(1, dayNumber);
    if (!title) continue;
    if (!days[dayNumber]) days[dayNumber] = [];
    days[dayNumber].push({
      title,
      detail: ev.description || null,
      map_search_query: ev.location || null,
      duration_min: null,
      priority: null,
      estimated_cost: null,
    });
  }
  return { days };
}
