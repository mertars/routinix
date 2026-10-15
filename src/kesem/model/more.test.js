// Parça 3 testleri: analiz, filtre, yedek (CSV/JSON doğrulama), kilit.  npm run test:kesem
import test from "node:test";
import assert from "node:assert/strict";
import { dailyTotals, categoryBreakdown, trendSeries, heatmap, comparePeriods, compareText, insights, accountTotals } from "./analytics.js";
import { applyFilter, emptyFilter, activeFilterCount, isGlobalScope } from "./filters.js";
import { buildCsv, buildBackup, validateBackup, planImport, BACKUP_APP, BACKUP_VERSION } from "./backup.js";
import { makePinRecord, verifyPin, validPin, nextLockoutMs, toB64, fromB64 } from "../state/lock.js";
import { dayKey, periodRange, shiftPeriod } from "./dates.js";
import { formatCompact, formatMoneyText, setMoneyMask } from "./money.js";

const at = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
let n = 0;
const tx = (amountMinor, ts, extra = {}) => ({ id: "t" + n++, kind: "expense", amountMinor, currency: "TRY", occurredAt: ts, categoryId: "c1", accountId: "a1", merchant: "", tagIds: [], createdAt: 1, updatedAt: 1, deletedAt: null, ...extra });
const NOW = at(2026, 10, 15, 10);

test("günlük toplam: gün başına gider/gelir/adet", () => {
  const txs = [tx(1000, at(2026, 10, 3)), tx(2500, at(2026, 10, 3, 18)), tx(9000, at(2026, 10, 4), { kind: "income" })];
  const m = dailyTotals(txs, at(2026, 10, 1, 0), at(2026, 11, 1, 0));
  assert.deepEqual(m.get("2026-10-03"), { expense: 3500, income: 0, count: 2 });
  assert.deepEqual(m.get("2026-10-04"), { expense: 0, income: 9000, count: 1 });
  assert.equal(m.get("2026-10-05"), undefined);
});

test("kategori dağılımı: paylar toplamı 1, 'Diğer' birleştirme, gelir hariç", () => {
  const cats = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const txs = cats.map((c, i) => tx((8 - i) * 1000, at(2026, 10, 2), { categoryId: c })).concat(tx(99999, at(2026, 10, 2), { kind: "income", categoryId: "z" }));
  const r = categoryBreakdown(txs, at(2026, 10, 1, 0), at(2026, 11, 1, 0), {});
  assert.equal(r.total, 36000);
  assert.equal(r.rows.length, 6);
  assert.equal(r.rows[0].categoryId, "a");
  assert.equal(r.rows[5].categoryId, "__other");
  assert.equal(r.rows[5].value, 3000 + 2000 + 1000); // f,g,h  (ilk 5 dilim a–e ayrı)
  assert.ok(Math.abs(r.rows.reduce((s, x) => s + x.share, 0) - 1) < 1e-9);
});

test("trend: gün (30), hafta (12), ay (12 dönem); toplamlar korunur", () => {
  const txs = [tx(1000, at(2026, 10, 15)), tx(500, at(2026, 10, 14)), tx(700, at(2026, 10, 9)), tx(300, at(2026, 9, 20))];
  const d = trendSeries(txs, "day", NOW, {});
  assert.equal(d.length, 30);
  assert.equal(d[29].value, 1000);
  assert.equal(d[28].value, 500);
  const w = trendSeries(txs, "week", NOW, {});
  assert.equal(w.length, 12);
  // 15 Eki 2026 Perşembe → hafta Pzt 12 Eki: 1000+500 ; önceki hafta (5–11 Eki): 700
  assert.equal(w[11].value, 1500);
  assert.equal(w[10].value, 700);
  const m = trendSeries(txs, "month", NOW, {}, 1);
  assert.equal(m.length, 12);
  assert.equal(m[11].value, 2200);
  assert.equal(m[10].value, 300);
  // maaş günü 25: 20 Eyl → 25 Ağu–24 Eyl dönemi, 9–15 Eki → 25 Eyl–24 Eki
  const m25 = trendSeries(txs, "month", NOW, {}, 25);
  assert.equal(m25[11].value, 2200);
  assert.equal(m25[10].value, 300);
});

test("ısı haritası: gün (Pzt=0) × 3 saatlik dilim", () => {
  // 15 Eki 2026 Perşembe (dow 3) 10:00 → dilim 3 ; 18 Eki Pazar (dow 6) 23:30 → dilim 7
  const txs = [tx(1000, at(2026, 10, 15, 10)), tx(500, at(2026, 10, 15, 11)), tx(2000, at(2026, 10, 18, 23, 30))];
  const h = heatmap(txs, at(2026, 10, 1, 0), at(2026, 11, 1, 0), {});
  assert.equal(h.cells[3][3].value, 1500);
  assert.equal(h.cells[3][3].count, 2);
  assert.equal(h.cells[6][7].value, 2000);
  assert.equal(h.max, 2000);
  assert.equal(h.cells.length, 7);
  assert.equal(h.cells[0].length, 8);
});

test("karşılaştırma: aynı gün sayısına göre (%12 az örneği) + metin", () => {
  // Önceki dönem (Eyl) ilk 15 gün: 10.000 ; bu dönem (Eki) ilk 15 gün: 8.800 → −%12
  const txs = [tx(1000000, at(2026, 9, 5)), tx(880000, at(2026, 10, 5)), tx(500000, at(2026, 9, 28))]; // 28 Eyl farklı: 15. günden sonra
  const c = comparePeriods(txs, NOW, 1, {});
  assert.equal(c.elapsed, 15);
  assert.equal(c.current, 880000);
  assert.equal(c.previous, 1000000);
  assert.equal(c.previousFull, 1500000);
  assert.ok(Math.abs(c.pct + 0.12) < 1e-9);
  assert.equal(compareText(c.pct), "Geçen döneme göre %12 az");
  assert.equal(compareText(0.255), "Geçen döneme göre %26 fazla");
  assert.equal(compareText(null), null);
  assert.equal(comparePeriods([], NOW, 1, {}).pct, null);
});

test("akıllı özetler: en çok kategori, en pahalı gün, en sık yer, günlük ortalama", () => {
  const txs = [
    tx(5000, at(2026, 10, 2), { categoryId: "x", merchant: "Starbucks" }), tx(4000, at(2026, 10, 2, 15), { categoryId: "y", merchant: "starbucks" }),
    tx(30000, at(2026, 10, 9), { categoryId: "x", merchant: "Mavi" }), tx(2000, at(2026, 10, 12), { categoryId: "z", merchant: "Starbucks" }), tx(1000, at(2026, 10, 12), { categoryId: "z", merchant: "" }),
  ];
  const [from, to] = periodRange(NOW, 1);
  const i = insights(txs, from, to, NOW, {});
  assert.equal(i.total, 42000);
  assert.equal(i.topCategory.categoryId, "x");
  assert.equal(i.topCategory.value, 35000);
  assert.equal(i.priciestDay.dayKey, "2026-10-09");
  assert.equal(i.topMerchant.name, "Starbucks");
  assert.equal(i.topMerchant.count, 3);
  assert.equal(i.elapsed, 15);
  assert.equal(i.avgDaily, 2800);
  assert.equal(insights([], from, to, NOW, {}).topCategory, null);
});

test("dönem kaydırma: maaş günü 25 → önceki/sonraki dönem doğru (Parça 2 hatası düzeltildi)", () => {
  const [f0] = periodRange(NOW, 25); // 25 Eyl
  const prev = periodRange(shiftPeriod(NOW, -1, 25), 25);
  assert.equal(dayKey(prev[0]), "2026-08-25");
  assert.equal(dayKey(prev[1]), "2026-09-25");
  const next = periodRange(shiftPeriod(NOW, 1, 25), 25);
  assert.equal(dayKey(next[0]), "2026-10-25");
  assert.equal(dayKey(periodRange(shiftPeriod(NOW, 0, 25), 25)[0]), dayKey(f0));
  assert.equal(dayKey(periodRange(shiftPeriod(NOW, -1, 1), 1)[0]), "2026-09-01");
  assert.equal(dayKey(periodRange(shiftPeriod(at(2026, 1, 10), -1, 1), 1)[0]), "2025-12-01");
});

test("kart bazlı toplam", () => {
  const txs = [tx(1000, at(2026, 10, 2), { accountId: "kart" }), tx(3000, at(2026, 10, 3), { accountId: "kart" }), tx(1000, at(2026, 10, 3), { accountId: "nakit" }), tx(7777, at(2026, 9, 3), { accountId: "kart" })];
  const [from, to] = periodRange(NOW, 1);
  const r = accountTotals(txs, from, to, {});
  assert.equal(r.total, 5000);
  assert.deepEqual(r.rows.map((x) => [x.accountId, x.value]), [["kart", 4000], ["nakit", 1000]]);
});

const ctx = { catName: (id) => ({ c1: "Market", c2: "Yeme-İçme" })[id] || "?", accName: (id) => ({ a1: "Nakit", a2: "Akbank Kredi Kartı" })[id] || "?", tagName: (id) => ({ t1: "tatil", t2: "iş" })[id], rates: { USD: { rate: 30 } } };
test("filtre: tutar aralığı (₺ karşılığı), kategori, ödeme, etiket, tarih aralığı, metin", () => {
  const txs = [
    tx(10000, at(2026, 10, 1), { id: "A", categoryId: "c1", accountId: "a1", tagIds: ["t1"], merchant: "Migros" }),
    tx(50000, at(2026, 10, 10), { id: "B", categoryId: "c2", accountId: "a2", tagIds: ["t2"], note: "Akşam yemeği" }),
    tx(1000, at(2026, 10, 20), { id: "C", categoryId: "c2", accountId: "a2", currency: "USD" }), // 10 $ = 300 ₺ (baseMinor yok → kur)
    tx(99900, at(2026, 11, 2), { id: "D", categoryId: "c1", accountId: "a1", kind: "income" }),
  ];
  const ids = (f) => applyFilter(txs, { ...emptyFilter(), ...f }, ctx).map((t) => t.id).join("");
  assert.equal(ids({}), "ABCD");
  assert.equal(ids({ min: 20000 }), "BCD".replace("C", "C")); // C = 30000 ≥ 20000
  assert.equal(ids({ min: 20000, max: 40000 }), "C");
  assert.equal(ids({ max: 10000 }), "A");
  assert.equal(ids({ categoryIds: ["c2"] }), "BC");
  assert.equal(ids({ accountIds: ["a2"] }), "BC");
  assert.equal(ids({ tagIds: ["t1", "t2"] }), "AB");
  assert.equal(ids({ from: at(2026, 10, 10), to: at(2026, 10, 20) }), "BC"); // uç günler dahil
  assert.equal(ids({ from: at(2026, 10, 21) }), "D");
  assert.equal(ids({ query: "yemeği" }), "B"); // not içinde
  assert.equal(ids({ query: "MİGROS" }), "A"); // Türkçe büyük/küçük
  assert.equal(ids({ query: "kredi" }), "BC"); // ödeme yöntemi adı
  assert.equal(ids({ kind: "income" }), "D");
  assert.equal(ids({ categoryIds: ["c1"], accountIds: ["a1"], min: 50000 }), "D");
  assert.equal(activeFilterCount({ ...emptyFilter(), min: 1, max: 2, categoryIds: ["x"], from: 1 }), 4);
  assert.equal(isGlobalScope(emptyFilter()), false);
  assert.equal(isGlobalScope({ ...emptyFilter(), kind: "income" }), false);
  assert.equal(isGlobalScope({ ...emptyFilter(), min: 5, categoryIds: ["c1"] }), false); // dönem içinde kalır
  assert.equal(isGlobalScope({ ...emptyFilter(), query: "a" }), true);
  assert.equal(isGlobalScope({ ...emptyFilter(), from: 5 }), true);
});

test("CSV: BOM, ; ayracı, ondalık virgül, tırnak/satır sonu kaçışı, formül enjeksiyonu", () => {
  const t = tx(123450, at(2026, 10, 5, 9, 7), { merchant: 'Ali "Usta"; Kafe', note: "=CMD()", tagIds: ["t1", "t2"], subcategoryId: "c2" });
  const csv = buildCsv([t], ctx);
  assert.ok(csv.startsWith("﻿Tarih;Saat;Tür;Tutar"));
  const row = csv.split("\r\n")[1];
  assert.ok(row.startsWith("05.10.2026;09:07;Gider;1234,50;TRY;1234,50;Market;Yeme-İçme;Nakit;"));
  assert.ok(row.includes('"Ali ""Usta""; Kafe"'));
  assert.ok(row.includes(";'=CMD();"));
  assert.ok(row.includes("tatil, iş"));
});

const good = () => buildBackup({
  data: {
    transactions: [{ id: "t1", kind: "expense", amountMinor: 5000, currency: "TRY", categoryId: "c1", accountId: "a1", occurredAt: at(2026, 10, 2), merchant: "X", note: "", tagIds: [], createdAt: at(2026, 1, 1), updatedAt: at(2026, 10, 3), deletedAt: null }],
    categories: [{ id: "c1", kind: "expense", name: "Market", icon: "basket", color: "mint", parentId: null, order: 0, createdAt: at(2026, 1, 1), updatedAt: at(2026, 1, 1), deletedAt: null }],
    accounts: [{ id: "a1", type: "cash", name: "Nakit", color: "mint", order: 0, createdAt: at(2026, 1, 1), updatedAt: at(2026, 1, 1), deletedAt: null }],
  },
  meta: { budget: { monthlyMinor: 100000, byCategory: { c1: 5000 }, startDay: 5, includePlanned: true } },
});

test("yedek: geçerli dosya doğrulanır, sürüm/uygulama alanları", () => {
  const b = good();
  assert.equal(b.app, BACKUP_APP);
  assert.equal(b.version, BACKUP_VERSION);
  const r = validateBackup(JSON.stringify(b));
  assert.equal(r.ok, true);
  assert.equal(r.report.counts.transactions, 1);
  assert.equal(r.report.total, 3);
  assert.equal(r.meta.budget.startDay, 5);
  assert.deepEqual(r.report.skipped, []);
});

test("yedek: bozuk/yanlış dosyalar reddedilir (boş, JSON değil, yanlış uygulama, yeni sürüm, veri yok)", () => {
  assert.equal(validateBackup("").ok, false);
  assert.match(validateBackup("{bozuk json").error, /geçerli bir JSON/);
  assert.match(validateBackup("[1,2,3]").error, /tanınmadı/);
  assert.match(validateBackup(JSON.stringify({ app: "baska", version: 1, data: {} })).error, /değil/);
  assert.match(validateBackup(JSON.stringify({ app: BACKUP_APP, version: 99, data: {} })).error, /yeni/);
  assert.match(validateBackup(JSON.stringify({ app: BACKUP_APP, version: "x", data: {} })).error, /sürümü/);
  assert.match(validateBackup(JSON.stringify({ app: BACKUP_APP, version: 2 })).error, /veri/);
  assert.match(validateBackup(JSON.stringify({ app: BACKUP_APP, version: 2, data: { transactions: [] } })).error, /kayıt bulunamadı/);
  assert.match(validateBackup("x".repeat(10), 70 * 1024 * 1024).error, /büyük/);
  assert.equal(validateBackup("﻿" + JSON.stringify(good())).ok, true); // BOM'lu dosya
});

test("yedek: bozuk kayıtlar atlanır, geçerliler alınır; sınırlar ve temizleme", () => {
  const b = good();
  b.data.transactions.push(
    { id: "bad1", kind: "expense", amountMinor: -5, occurredAt: at(2026, 10, 2) },        // negatif
    { id: "bad2", kind: "expense", amountMinor: 1.5, occurredAt: at(2026, 10, 2) },       // kesirli
    { id: "bad3", kind: "gizli", amountMinor: 5, occurredAt: at(2026, 10, 2) },           // tür
    { id: "bad4", kind: "expense", amountMinor: 5, occurredAt: "dün" },                   // tarih
    { id: "bad5", kind: "expense", amountMinor: 1e15, occurredAt: at(2026, 10, 2) },      // çok büyük
    { id: "t1", kind: "expense", amountMinor: 5, occurredAt: at(2026, 10, 2) },           // yinelenen kimlik
    { id: "../etc", kind: "expense", amountMinor: 5, occurredAt: at(2026, 10, 2) },       // geçersiz kimlik
    { kind: "expense", amountMinor: 5, occurredAt: at(2026, 10, 2) },                     // kimlik yok
    null, 7,
    { id: "long", kind: "expense", amountMinor: 100, occurredAt: at(2026, 10, 2), note: "n".repeat(5000), merchant: "m".repeat(500), __proto__x: 1, evil: "<script>" }
  );
  const r = validateBackup(JSON.stringify(b));
  assert.equal(r.ok, true);
  assert.equal(r.report.counts.transactions, 2); // t1 + long
  assert.equal(r.report.skipped.length, 10);
  const long = r.data.transactions.find((t) => t.id === "long");
  assert.equal(long.note.length, 500);
  assert.equal(long.merchant.length, 80);
  assert.equal(long.evil, undefined); // bilinmeyen alanlar atılır
  assert.equal(long.deletedAt, null);
  b.data.categories = "liste değil";
  assert.ok(validateBackup(JSON.stringify(b)).report.warnings.some((w) => /liste değil/.test(w)));
});

test("içe aktarma önizlemesi: yeni / güncellenen / aynı", () => {
  const r = validateBackup(JSON.stringify(good()));
  const existing = { transactions: new Map([["t1", { id: "t1", updatedAt: at(2026, 9, 1) }]]), categories: new Map([["c1", { id: "c1", updatedAt: at(2026, 12, 1) }]]), accounts: new Map() };
  const p = planImport(r.data, existing);
  assert.deepEqual(p.transactions, { add: 0, update: 1, same: 0 }); // yedek (3 Eki) > mevcut (1 Eyl)
  assert.deepEqual(p.categories, { add: 0, update: 0, same: 1 });   // mevcut (Ara) daha yeni → atlanır
  assert.deepEqual(p.accounts, { add: 1, update: 0, same: 0 });
});

test("PIN: PBKDF2 türevi (düz metin yok), doğru/yanlış, biçim kuralları", async () => {
  const rec = await makePinRecord("4821", 1000);
  assert.ok(!JSON.stringify(rec).includes("4821"));
  assert.equal(rec.len, 4);
  assert.equal(fromB64(rec.salt).length, 16);
  assert.equal(fromB64(rec.hash).length, 32);
  assert.equal(await verifyPin(rec, "4821"), true);
  assert.equal(await verifyPin(rec, "4822"), false);
  assert.equal(await verifyPin(rec, "48210"), false);
  assert.equal(await verifyPin(rec, ""), false);
  assert.equal(await verifyPin(null, "4821"), false);
  const rec2 = await makePinRecord("4821", 1000);
  assert.notEqual(rec.salt, rec2.salt); // her kayıtta farklı tuz
  assert.notEqual(rec.hash, rec2.hash);
  assert.equal(validPin("123"), false);
  assert.equal(validPin("1234567"), false);
  assert.equal(validPin("12a4"), false);
  assert.equal(validPin("123456"), true);
  await assert.rejects(() => makePinRecord("12"));
  assert.equal(toB64(new Uint8Array([1, 2, 3, 255]).buffer), "AQID/w==");
});

test("kilit: yanlış denemede artan bekleme", () => {
  assert.equal(nextLockoutMs(0), 0);
  assert.equal(nextLockoutMs(4), 0);
  assert.equal(nextLockoutMs(5), 30000);
  assert.equal(nextLockoutMs(6), 60000);
  assert.equal(nextLockoutMs(7), 120000);
  assert.equal(nextLockoutMs(40), 15 * 60000);
});

test("gizlilik maskesi + kompakt biçim", () => {
  assert.equal(formatCompact(85000), "850");
  assert.equal(formatCompact(123456), "1,2B");
  assert.equal(formatCompact(1234567), "12B");
  assert.equal(formatCompact(250000000), "2,5M");
  setMoneyMask(true);
  assert.equal(formatMoneyText(123450), "•••• ₺");
  setMoneyMask(false);
  assert.equal(formatMoneyText(123450), "1.234,50 ₺");
  assert.equal(dayKey(at(2026, 1, 5)), "2026-01-05");
});
