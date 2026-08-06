// Plan Studio & Editor Engine — Evrensel Çoklu Format İçe Aktarma Motoru.
// JSON/Markdown/TXT/PDF-metni/CSV/ICS için TEK, dürüstçe belgelenmiş bir
// kural seti. Markdown/TXT/PDF ORTAK ayrıştırıcıyı (parseTextualPlan)
// paylaşır — PDF önce pdfjs-dist ile düz metne çevrilir, ardından BURADAN
// geçer. Beklenen (en iyi sonucu veren) kalıp:
//
//   # Plan Başlığı              <- yalnızca gün/rutin bölümünden ÖNCE, tek satır
//   ## Gün 1  (veya "1. Gün" / "Day 1" / "Faz 1" / "Hafta 1" / "Modül 1")
//   - Görev adı | 30dk | Yüksek | 50₺   <- " | " ile ayrılmış alanlar OPSİYONEL
//   - [Kritik] Başka görev              <- [P0]/[P1]/[Kritik] etiketi de OPSİYONEL
//   | Görev | Süre | Öncelik |          <- Markdown tablo satırları da görev sayılır
//   | Toplantı | 30dk | Yüksek |
//   ## Rutinler  (veya "Routines")
//   - Her sabah su iç | Hafta İçi        <- 2. alan opsiyonel sıklık
//
// Bu SEZGİSEL bir ayrıştırıcıdır — serbest biçimli/karmaşık belgeleri
// %100 doğru ayrıştırma iddiası TAŞIMAZ; katı bir başlık/gün yapısı hiç
// bulunamazsa, düz metindeki her görev benzeri satır 4'lük gruplar halinde
// ardışık günlere dağıtılır (bkz. dosya sonundaki "başlıksız metin"
// yedek modu). Kullanıcı içe aktarımdan sonra HER ZAMAN Builder ekranında
// sonucu görüp elle düzeltebilir — sessiz/görünmez bir veri kaybı yoktur.

// JS'in varsayılan case-insensitive regex eşleşmesi (/i bayrağı) Türkçe
// büyük "İ"yi standart "i"ye KATLAMAZ (bilinen "Turkish I problemi") —
// "RUTİNLER" gibi doğal yazılmış bir Türkçe anahtar kelime bu yüzden
// /rutin/i gibi bir düzenli ifadeyle SESSİZCE eşleşmeyebilirdi. Aşağıdaki
// başlık/sıklık düzenli ifadeleri bu yüzden /i bayrağı YERİNE, önce
// trNormalizeForMatch() ile normalize edilmiş metne karşı çalıştırılır —
// yalnızca EŞLEŞTİRME amaçlı, kullanıcıya gösterilen/kaydedilen başlık ve
// görev metinleri asla değiştirilmez.
function trNormalizeForMatch(s) {
  return String(s || "").replace(/İ/g, "i").replace(/I/g, "i").toLowerCase();
}

// "Gün/Day" yanında "Faz/Phase", "Hafta/Week", "Modül/Module" de gün-benzeri
// gruplama başlığı sayılır — hepsi aynı ardışık Plan.days yapısına akar.
const DAY_HEADER_RE =
  /^#{0,3}\s*(?:(\d+)\s*\.?\s*(?:g[üu]n|day|faz|phase|hafta|week|mod[üu]l|module)|(?:g[üu]n|day|faz|phase|hafta|week|mod[üu]l|module)\s*(\d+))\b/;
// Sadece haftanın günü adından oluşan bir satır (numarasız) da bir gün
// başlığı sayılır — İLK GÖRÜLME SIRASINA göre 1'den başlayarak numaralanır.
const WEEKDAY_HEADER_RE =
  /^#{0,3}\s*(pazartesi|sal[ıi]|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*:?\s*$/;
const ROUTINES_HEADER_RE = /^#{0,3}\s*(rutin(?:ler)?|routines?)\s*:?\s*$/;
const BULLET_RE = /^[-*•]\s+|^\d+[.)]\s+/;
const TITLE_LINE_RE = /^#\s+(.+)$/;
const CODE_FENCE_RE = /^```/;

const PRIORITY_MAP = {
  yüksek: "Yüksek", yuksek: "Yüksek", high: "Yüksek",
  orta: "Orta", medium: "Orta",
  düşük: "Düşük", dusuk: "Düşük", low: "Düşük",
};

// [P0] / [P1] / [P2] / [P3] / [Kritik] / [Critical] gibi köşeli parantez
// etiketleri — görev metninin HERHANGİ bir yerinde geçebilir, çıkarılıp
// başlıktan temizlenir ve bir öncelik değerine çevrilir.
const PRIORITY_TAG_RE = /\[\s*(p[0-3]|kritik|critical|high|medium|low)\s*\]/i;
const TAG_PRIORITY_MAP = {
  p0: "Yüksek", kritik: "Yüksek", critical: "Yüksek", high: "Yüksek",
  p1: "Orta", medium: "Orta",
  p2: "Düşük", p3: "Düşük", low: "Düşük",
};

function extractPriorityTag(str) {
  const s = String(str || "");
  const m = PRIORITY_TAG_RE.exec(s);
  if (!m) return { cleaned: s.trim(), priority: null };
  const cleaned = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\s{2,}/g, " ").trim();
  return { cleaned, priority: TAG_PRIORITY_MAP[m[1].toLowerCase()] || null };
}

function parseFrequencyToken(token) {
  const t = trNormalizeForMatch(token.trim());
  if (/hafta ?i[çc][iı]|weekday/.test(t)) return "weekdays";
  if (/haftal[ıi]k|weekly/.test(t)) return "weekly";
  return "daily";
}

// " | " ile ayrılmış alanları bir göreve çevirir — hem madde imli satırlar
// (parseTaskLine) hem Markdown tablo hücreleri (parseTableRow) hem de kod
// bloğu satırları bu ORTAK mantığı kullanır. segments[0] başlıktır (öncelik
// etiketi varsa temizlenir), sonraki alanlar sırasız taranıp süre/öncelik/
// maliyet olarak sınıflandırılır.
function taskFromSegments(segments) {
  const { cleaned: title, priority: tagPriority } = extractPriorityTag(segments[0] || "");
  if (!title) return null;
  const task = { title, detail: null, duration_min: null, priority: tagPriority, estimated_cost: null, map_search_query: null };
  for (const rawSeg of segments.slice(1)) {
    const seg = extractPriorityTag(rawSeg).cleaned;
    if (!seg) continue;
    const durMatch = /^(\d+)\s*(dk|dakika|min)$/i.exec(seg);
    const priorityKey = PRIORITY_MAP[seg.toLowerCase()];
    if (durMatch) task.duration_min = parseInt(durMatch[1], 10);
    else if (priorityKey) task.priority = priorityKey;
    else task.estimated_cost = seg;
  }
  return task;
}

function parseTaskLine(rawLine) {
  const line = rawLine.replace(BULLET_RE, "").trim();
  if (!line) return null;
  return taskFromSegments(line.split(" | ").map((s) => s.trim()).filter(Boolean));
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

// Markdown tablo satırı: "| a | b | c |" -> ["a","b","c"]. Ayırıcı satırlar
// ("| --- | --- |") "separator" döner, tablo değilse null.
const HEADER_WORDS = new Set([
  "görev", "gorev", "task", "tasks", "başlık", "baslik", "title",
  "aksiyon", "action", "iş", "is", "adım", "adim", "step",
]);
function parseTableRow(line) {
  const trimmed = line.trim();
  if (!/^\|.*\|\s*$/.test(trimmed)) return null;
  const cells = trimmed.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
  if (cells.every((c) => c === "" || /^:?-{2,}:?$/.test(c))) return "separator";
  return cells;
}

// Döner: { title, days: {[dayNumber]: [{title, duration_min, priority, estimated_cost, detail, map_search_query}]}, routines: [{content, frequency}] }
export function parseTextualPlan(text) {
  const lines = String(text || "").split(/\r?\n/);
  let title = "";
  let mode = "title"; // "title" | "days" | "routines"
  let currentDay = null;
  let dayCounter = 0; // numarasız (haftanın günü) başlıklar için ardışık sayaç
  let inCodeBlock = false;
  const days = {};
  const routines = [];
  // Hiç gün/faz/hafta başlığı BULUNAMAZSA kullanılacak yedek: madde imli/
  // düz görev-benzeri satırlar burada toplanıp dosya sonunda 4'lük
  // gruplar halinde ardışık günlere dağıtılır.
  const candidateFlatLines = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (CODE_FENCE_RE.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      if (mode === "days" && currentDay != null) {
        const task = taskFromSegments(line.split(" | ").map((s) => s.trim()).filter(Boolean));
        if (task) days[currentDay].push(task);
      }
      continue;
    }

    const normalizedLine = trNormalizeForMatch(line);

    const dayMatch = DAY_HEADER_RE.exec(normalizedLine);
    if (dayMatch) {
      currentDay = parseInt(dayMatch[1] || dayMatch[2], 10);
      if (!days[currentDay]) days[currentDay] = [];
      mode = "days";
      continue;
    }
    const weekdayMatch = WEEKDAY_HEADER_RE.exec(normalizedLine);
    if (weekdayMatch) {
      dayCounter += 1;
      currentDay = dayCounter;
      if (!days[currentDay]) days[currentDay] = [];
      mode = "days";
      continue;
    }
    if (ROUTINES_HEADER_RE.test(normalizedLine)) {
      mode = "routines";
      continue;
    }

    if (mode === "title") {
      const titleMatch = TITLE_LINE_RE.exec(line);
      if (titleMatch) {
        title = titleMatch[1].trim();
        continue;
      }
      if (!title && !BULLET_RE.test(line) && !/^\|.*\|$/.test(line)) {
        // TXT'de "#" yok — gün/rutin başlığından ÖNCEKİ ilk düz satır başlıktır.
        title = line;
        continue;
      }
      candidateFlatLines.push(line);
      continue;
    }

    if (mode === "days") {
      if (currentDay == null) continue; // savunma amaçlı — normalde erişilmez
      const tableCells = parseTableRow(line);
      if (tableCells === "separator") continue;
      if (Array.isArray(tableCells)) {
        if (HEADER_WORDS.has(trNormalizeForMatch(tableCells[0] || ""))) continue; // tablo başlık satırı
        const task = taskFromSegments(tableCells);
        if (task) days[currentDay].push(task);
        continue;
      }
      const task = parseTaskLine(line);
      if (task) days[currentDay].push(task);
      continue;
    }

    if (mode === "routines") {
      const routine = parseRoutineLine(line);
      if (routine) routines.push(routine);
    }
  }

  if (Object.keys(days).length === 0 && candidateFlatLines.length > 0) {
    // Akıllı NLP parçalayıcı (başlıksız metin): her görev-benzeri satır
    // ardışık günlere GROUP_SIZE'lık mantıksal kümeler halinde dağıtılır.
    const GROUP_SIZE = 4;
    const flatTasks = [];
    for (const l of candidateFlatLines) {
      const task = taskFromSegments(l.replace(BULLET_RE, "").split(" | ").map((s) => s.trim()).filter(Boolean));
      if (task) flatTasks.push(task);
    }
    const fallbackDays = {};
    flatTasks.forEach((task, i) => {
      const dayNumber = Math.floor(i / GROUP_SIZE) + 1;
      if (!fallbackDays[dayNumber]) fallbackDays[dayNumber] = [];
      fallbackDays[dayNumber].push(task);
    });
    return { title, days: fallbackDays, routines };
  }

  return { title, days, routines };
}

// CSV/TSV — TEK amaçlı: görev satırları. Rutinler CSV'nin doğal satır/gün
// modeline UYMADIĞI için buradan İÇE AKTARILMAZ — bilinçli bir sınır,
// ImportFormatModal'da kullanıcıya açıkça belirtilir. Ayırıcı (virgül,
// noktalı virgül, TAB) başlık satırından OTOMATİK algılanır. Beklenen
// başlık satırı (sütun SIRASI önemsiz, eksik sütunlar tolere edilir):
//   gun,baslik,detay,sure_dk,oncelik,butce,konum
function detectCsvDelimiter(headerLine) {
  let best = ",";
  let bestCount = -1;
  for (const d of [",", ";", "\t"]) {
    const count = headerLine.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return bestCount > 0 ? best : ",";
}

function parseCsvLine(line, delimiter) {
  // Basit RFC4180 alt kümesi: çift tırnak içindeki ayırıcıları korur.
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
    } else if (ch === delimiter) {
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
  gun: "day", day: "day", gün: "day", faz: "day", phase: "day", hafta: "day", week: "day", modul: "day", modül: "day",
  baslik: "title", başlık: "title", title: "title", aksiyon: "title", action: "title", adim: "title", adım: "title", step: "title",
  detay: "detail", detail: "detail", not: "detail", aciklama: "detail", açıklama: "detail",
  sure_dk: "duration_min", süre_dk: "duration_min", duration_min: "duration_min", dakika: "duration_min", sure: "duration_min", süre: "duration_min", duration: "duration_min",
  oncelik: "priority", öncelik: "priority", priority: "priority",
  butce: "estimated_cost", bütçe: "estimated_cost", estimated_cost: "estimated_cost", cost: "estimated_cost",
  konum: "map_search_query", location: "map_search_query", map_search_query: "map_search_query",
};

// Döner: { days: {[dayNumber]: [{title, detail, duration_min, priority, estimated_cost, map_search_query}]} }
export function parseCsvPlan(text) {
  const rawLines = String(text || "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length < 2) return { days: {} };

  const delimiter = detectCsvDelimiter(rawLines[0]);
  const headerCells = parseCsvLine(rawLines[0], delimiter).map((h) => trNormalizeForMatch(h));
  const colIndex = {};
  headerCells.forEach((h, i) => {
    const key = CSV_COLUMN_ALIASES[h];
    if (key) colIndex[key] = i;
  });
  if (colIndex.title == null) return { days: {} }; // başlık sütunu yoksa ayrıştırılamaz

  const days = {};
  for (const rawLine of rawLines.slice(1)) {
    const cells = parseCsvLine(rawLine, delimiter);
    const { cleaned: title, priority: tagPriority } = extractPriorityTag(cells[colIndex.title] || "");
    if (!title) continue;
    const dayNumber = Math.max(1, parseInt(cells[colIndex.day], 10) || 1);
    const durationRaw = colIndex.duration_min != null ? cells[colIndex.duration_min] : "";
    const priorityRaw = colIndex.priority != null ? (cells[colIndex.priority] || "").trim() : "";
    if (!days[dayNumber]) days[dayNumber] = [];
    days[dayNumber].push({
      title,
      detail: colIndex.detail != null ? cells[colIndex.detail] || null : null,
      duration_min: durationRaw && Number.isFinite(parseInt(durationRaw, 10)) ? parseInt(durationRaw, 10) : null,
      priority: PRIORITY_MAP[priorityRaw.toLowerCase()] || tagPriority || null,
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

// JSON — ADAPTİF şema: katı bir yapı ARANMAZ. Başlık için title/name/
// documentTitle; gün gruplaması için days (obje YA DA dizi), phases,
// sections, actionPlan/action_plan (her biri dizi) — bulunan İLK aday
// kullanılır; hiçbiri yoksa düz "tasks" dizisi TEK bir güne (Gün 1) konur.
function toIntOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeTaskObject(t) {
  if (typeof t === "string") {
    const { cleaned: title, priority } = extractPriorityTag(t);
    return { title, detail: null, duration_min: null, priority, estimated_cost: null, map_search_query: null };
  }
  if (!t || typeof t !== "object") {
    return { title: "", detail: null, duration_min: null, priority: null, estimated_cost: null, map_search_query: null };
  }
  const rawTitle = String(t.title ?? t.name ?? t.action ?? t.task ?? t.text ?? "").trim();
  const { cleaned: title, priority: tagPriority } = extractPriorityTag(rawTitle);
  const priorityRaw = String(t.priority ?? t.oncelik ?? t.öncelik ?? "").trim().toLowerCase();
  return {
    title,
    detail: t.detail ?? t.description ?? t.note ?? t.notes ?? null,
    duration_min: toIntOrNull(t.duration_min ?? t.duration ?? t.sure_dk ?? t.süre_dk),
    priority: PRIORITY_MAP[priorityRaw] || tagPriority || null,
    estimated_cost: t.estimated_cost ?? t.cost ?? t.budget ?? null,
    map_search_query: t.map_search_query ?? t.location ?? t.konum ?? null,
  };
}

function findTaskArray(obj) {
  for (const key of ["tasks", "items", "actions", "steps", "subtasks", "activities"]) {
    if (Array.isArray(obj[key])) return obj[key];
  }
  return null;
}

// Bir "gün/faz kabı" dizisini (ör. phases/sections/actionPlan) Plan.days
// yapısına çevirir. Her eleman ya İÇİNDE bir görev dizisi barındıran bir
// kap (ör. {day:1, tasks:[...]})  ya da TEK BAŞINA bir görevin kendisidir
// (ör. {title:"Kickoff", day:1}) — ikisi de desteklenir.
function collectDaysFromContainerArray(arr) {
  const days = {};
  arr.forEach((el, idx) => {
    if (el == null) return;
    if (typeof el === "string") {
      const task = normalizeTaskObject(el);
      if (!task.title) return;
      if (!days[1]) days[1] = [];
      days[1].push(task);
      return;
    }
    const dayNumber = Math.max(1, toIntOrNull(el.day ?? el.dayNumber ?? el.phase ?? el.number ?? el.order) || idx + 1);
    const subArr = findTaskArray(el);
    if (subArr) {
      const tasks = subArr.map(normalizeTaskObject).filter((t) => t.title);
      if (tasks.length === 0) return;
      if (!days[dayNumber]) days[dayNumber] = [];
      days[dayNumber].push(...tasks);
    } else {
      const task = normalizeTaskObject(el);
      if (!task.title) return;
      if (!days[dayNumber]) days[dayNumber] = [];
      days[dayNumber].push(task);
    }
  });
  return days;
}

// Döner: { title, totalDays, days: {[dayNumber]: [...]}, routines: [{content, frequency}] }
export function parseUniversalJson(parsed) {
  if (!parsed || typeof parsed !== "object") return { title: "", days: {}, routines: [] };

  const title = String(parsed.title ?? parsed.name ?? parsed.documentTitle ?? "").trim();

  const normalizedRoutines = Array.isArray(parsed.routines)
    ? parsed.routines.map((r) => ({ content: String((typeof r === "object" ? r.content : r) ?? "").trim(), frequency: (typeof r === "object" && r.frequency) || "daily" })).filter((r) => r.content)
    : typeof parsed.routines === "string"
    ? parsed.routines.split("\n").map((l) => l.trim()).filter(Boolean).map((content) => ({ content, frequency: "daily" }))
    : [];

  let days = {};
  if (parsed.days && typeof parsed.days === "object" && !Array.isArray(parsed.days)) {
    // Routinix'in kendi (yerli) şeması: {"1": [...], "2": [...]}.
    for (const [k, arr] of Object.entries(parsed.days)) {
      if (!Array.isArray(arr)) continue;
      const dayNumber = Math.max(1, toIntOrNull(k) || 1);
      const tasks = arr.map(normalizeTaskObject).filter((t) => t.title);
      if (tasks.length === 0) continue;
      days[dayNumber] = tasks;
    }
  } else {
    const containerArr = Array.isArray(parsed.days)
      ? parsed.days
      : Array.isArray(parsed.phases)
      ? parsed.phases
      : Array.isArray(parsed.sections)
      ? parsed.sections
      : Array.isArray(parsed.actionPlan)
      ? parsed.actionPlan
      : Array.isArray(parsed.action_plan)
      ? parsed.action_plan
      : null;
    if (containerArr) {
      days = collectDaysFromContainerArray(containerArr);
    } else if (Array.isArray(parsed.tasks)) {
      const tasks = parsed.tasks.map(normalizeTaskObject).filter((t) => t.title);
      if (tasks.length > 0) days = { 1: tasks };
    }
  }

  const totalDays = toIntOrNull(parsed.totalDays ?? parsed.total_days) || (Object.keys(days).length || undefined);

  return { title, totalDays, days, routines: normalizedRoutines };
}
