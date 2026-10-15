// node --test ile çalışır:  npm run test:kesem
import test from "node:test";
import assert from "node:assert/strict";
import { installmentAmounts, installmentRows, installmentProgress, occurrencesBetween, monthlyEquivalent, yearlyEquivalent, budgetStatus, categoryBudgets, goalProjection, splitEqual, personBalances, noSpendStreak, upcomingItems, dueGenerated, committedUntil, badgeList } from "./finance.js";
import { convertMinor, baseOf, formatMoney, parseAmountInput } from "./money.js";
import { periodRange, addMonthsClamped, relativeDayLabel, daysBetween, dayKey } from "./dates.js";

const at = (y, m, d, h = 12, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

test("taksit: 1.000 ₺ / 3 → kuruş farkı ilk taksitte, toplam tam", () => {
  const a = installmentAmounts(100000, 3);
  assert.deepEqual(a, [33334, 33333, 33333]);
  assert.equal(a.reduce((s, x) => s + x, 0), 100000);
  assert.deepEqual(installmentAmounts(1200000, 12), Array(12).fill(100000));
});

test("taksit: 31 Ocak başlangıç → Şubat sonu, Mart 31 (gün kaymaz)", () => {
  const plan = { id: "p", totalMinor: 300000, count: 4, firstAt: at(2026, 1, 31) };
  const rows = installmentRows(plan).map((r) => dayKey(r.dateTs));
  assert.deepEqual(rows, ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
});

test("taksit: kalan taksit ve tutar (12 taksit, 3. ayda)", () => {
  const plan = { id: "p", totalMinor: 1200000, count: 12, firstAt: at(2026, 8, 15) };
  const pr = installmentProgress(plan, at(2026, 10, 15, 13));
  assert.equal(pr.doneCount, 3);
  assert.equal(pr.leftCount, 9);
  assert.equal(pr.leftMinor, 900000);
  assert.equal(dayKey(pr.next.dateTs), "2026-11-15");
});

test("taksit: planı durdurunca gelecek taksitler düşer", () => {
  const plan = { id: "p", totalMinor: 600000, count: 6, firstAt: at(2026, 1, 10), stoppedAt: at(2026, 3, 20) };
  assert.equal(installmentRows(plan).length, 3);
});

test("tekrarlayan: aylık/haftalık/yıllık dönem ve aylık eşdeğer", () => {
  const m = { id: "r", frequency: "monthly", interval: 1, anchorAt: at(2026, 10, 5), amountMinor: 24999, currency: "TRY" };
  assert.deepEqual(occurrencesBetween(m, at(2026, 10, 1), at(2027, 1, 1)).map((o) => dayKey(o.dateTs)), ["2026-10-05", "2026-11-05", "2026-12-05"]);
  assert.equal(monthlyEquivalent(m), 24999);
  assert.equal(yearlyEquivalent(m), 24999 * 12);
  const y = { ...m, frequency: "yearly", amountMinor: 120000 };
  assert.equal(monthlyEquivalent(y), 10000);
  const w = { ...m, frequency: "weekly", amountMinor: 10000 };
  assert.equal(monthlyEquivalent(w), Math.round((10000 * 52) / 12));
  const q = { ...m, interval: 3, amountMinor: 30000 };
  assert.equal(monthlyEquivalent(q), 10000);
});

test("tekrarlayan: otomatik üretim – çift kayıt olmaz, silinmiş kayıt yeniden doğmaz", () => {
  const rule = { id: "r", frequency: "monthly", interval: 1, anchorAt: at(2026, 8, 5), autoPost: true, amountMinor: 1000, currency: "TRY" };
  const now = at(2026, 10, 15);
  let made = dueGenerated({ installments: [], recurrings: [rule], now, exists: () => false });
  assert.equal(made.length, 3);
  const have = new Set(made.map((m) => m.key));
  made = dueGenerated({ installments: [], recurrings: [rule], now, exists: (k) => have.has(k) });
  assert.equal(made.length, 0);
  const manual = { ...rule, autoPost: false };
  assert.equal(dueGenerated({ installments: [], recurrings: [manual], now, exists: () => false }).length, 0);
});

test("fatura takvimi: '3 gün sonra' ve gecikme etiketleri", () => {
  const now = at(2026, 10, 15, 9);
  const rule = { id: "e", title: "Elektrik", frequency: "monthly", interval: 1, anchorAt: at(2026, 10, 18), autoPost: false, amountMinor: 85000, currency: "TRY", kind: "expense" };
  const late = { id: "w", title: "Su", frequency: "monthly", interval: 1, anchorAt: at(2026, 10, 12), autoPost: false, amountMinor: 20000, currency: "TRY", kind: "expense" };
  const items = upcomingItems({ installments: [], recurrings: [rule, late], exists: () => false, now });
  const e = items.find((i) => i.title === "Elektrik");
  const w = items.find((i) => i.title === "Su");
  assert.equal(relativeDayLabel(e.days), "3 gün sonra");
  assert.equal(e.status, "soon");
  assert.equal(relativeDayLabel(w.days), "3 gün gecikti");
  assert.equal(w.status, "overdue");
  assert.equal(relativeDayLabel(0), "Bugün");
  assert.equal(relativeDayLabel(1), "Yarın");
});

const tx = (kind, amountMinor, ts, extra = {}) => ({ id: Math.random().toString(36), kind, amountMinor, currency: "TRY", occurredAt: ts, categoryId: "c1", ...extra });

test("bugün harcayabileceğin: (30.000 − 12.000 − 3.000) / 17 gün", () => {
  const now = at(2026, 10, 15, 10);
  const txs = [tx("expense", 1200000, at(2026, 10, 3))];
  const s = budgetStatus({ budget: { monthlyMinor: 3000000, startDay: 1 }, txs, now, committedMinor: 300000 });
  assert.equal(s.daysLeft, 17); // 15..31
  assert.equal(s.allowance, Math.floor(1500000 / 17)); // 88235
  assert.equal(s.todayLeft, 88235);
  assert.equal(s.state, "ok"); // (12.000+3.000)/30.000 = %50
});

test("bugün harcayabileceğin: bugün harcama, kalan düşer; bütçe aşımı", () => {
  const now = at(2026, 10, 15, 18);
  const txs = [tx("expense", 1200000, at(2026, 10, 3)), tx("expense", 30000, at(2026, 10, 15, 9))];
  const s = budgetStatus({ budget: { monthlyMinor: 3000000 }, txs, now, committedMinor: 300000 });
  assert.equal(s.allowance, 88235); // bugünkü harcama dağıtılan tutarı değiştirmez
  assert.equal(s.todayLeft, 88235 - 30000);
  const over = budgetStatus({ budget: { monthlyMinor: 1000000 }, txs: [tx("expense", 1100000, at(2026, 10, 2))], now, committedMinor: 0 });
  assert.equal(over.state, "over");
  assert.equal(over.allowance, 0);
});

test("maaş günü 25: dönem 25 Eyl – 24 Eki, kalan 10 gün", () => {
  const now = at(2026, 10, 15, 10);
  const [f, t] = periodRange(now, 25);
  assert.equal(dayKey(f), "2026-09-25");
  assert.equal(dayKey(t), "2026-10-25");
  const txs = [tx("expense", 500000, at(2026, 9, 26)), tx("expense", 999999, at(2026, 9, 20))]; // ikincisi dönem dışı
  const s = budgetStatus({ budget: { monthlyMinor: 2000000, startDay: 25 }, txs, now, committedMinor: 0 });
  assert.equal(s.spent, 500000);
  assert.equal(s.daysLeft, 10);
  assert.equal(s.allowance, Math.floor(1500000 / 10));
  // dönem başladığı gün (25 Eki) yeni dönem
  assert.equal(dayKey(periodRange(at(2026, 10, 25, 8), 25)[0]), "2026-10-25");
  // bütçe yok
  assert.equal(budgetStatus({ budget: null, txs, now }).state, "none");
});

test("kategori bütçeleri: yeşil / sarı / kırmızı eşikleri", () => {
  const now = at(2026, 10, 15);
  const txs = [tx("expense", 7900, at(2026, 10, 2), { categoryId: "a" }), tx("expense", 8000, at(2026, 10, 2), { categoryId: "b" }), tx("expense", 10100, at(2026, 10, 2), { categoryId: "c" })];
  const r = categoryBudgets({ budget: { byCategory: { a: 10000, b: 10000, c: 10000 } }, txs, now });
  assert.deepEqual(r.map((x) => x.state), ["ok", "near", "over"]);
});

test("kur çevirisi: 100 $ @34,5 = 3.450 ₺; € → $ çapraz", () => {
  const rates = { USD: { rate: 34.5 }, EUR: { rate: 37.2 } };
  assert.equal(convertMinor(10000, "USD", "TRY", rates), 345000);
  assert.equal(convertMinor(345000, "TRY", "USD", rates), 10000);
  assert.equal(convertMinor(10000, "EUR", "USD", rates), Math.round((10000 * 37.2) / 34.5));
  assert.equal(convertMinor(100, "GBP", "TRY", rates), null);
  assert.equal(baseOf({ amountMinor: 5000, currency: "EUR" }, rates), 186000);
  assert.equal(baseOf({ amountMinor: 5000, currency: "EUR", baseMinor: 170000 }, rates), 170000);
  assert.equal(baseOf({ amountMinor: 123, currency: "TRY" }, {}), 123);
});

test("para biçimi: 1.234,50 ₺ / $ / €", () => {
  assert.equal(formatMoney(123450), "1.234,50 ₺");
  assert.equal(formatMoney(-5, "TRY"), "−0,05 ₺");
  assert.equal(formatMoney(1250, "USD"), "12,50 $");
  assert.equal(formatMoney(100000000, "EUR"), "1.000.000,00 €");
  assert.equal(parseAmountInput("1234,5"), 123450);
});

test("bölüşme: 1.000 ₺ / 3 kişi; ben ödedim / arkadaş ödedi; yarı yarıya", () => {
  assert.deepEqual(splitEqual(100000, 3, true), { myShare: 33334, otherShare: 33333, payerShare: 33334 });
  assert.equal(33334 + 33333 * 2, 100000);
  assert.deepEqual(splitEqual(100000, 3, false), { myShare: 33333, otherShare: 33333, payerShare: 33334 });
  assert.deepEqual(splitEqual(45000, 2, true), { myShare: 22500, otherShare: 22500, payerShare: 22500 });
});

test("borç defteri: kişi bakiyesi, kısmi ödeme, ödendi, gecikme", () => {
  const people = [{ id: "a", name: "Ayşe" }, { id: "b", name: "Burak" }];
  const debts = [
    { id: "1", personId: "a", direction: "lent", amountMinor: 50000, paidMinor: 0, currency: "TRY" },
    { id: "2", personId: "a", direction: "borrowed", amountMinor: 20000, paidMinor: 0, currency: "TRY" },
    { id: "3", personId: "b", direction: "lent", amountMinor: 10000, paidMinor: 10000, currency: "TRY" }, // ödendi
    { id: "4", personId: "b", direction: "borrowed", amountMinor: 30000, paidMinor: 10000, currency: "TRY", dueAt: at(2020, 1, 1) },
  ];
  const b = personBalances({ people, debts, rates: {} });
  const a = b.find((x) => x.person.id === "a");
  const bk = b.find((x) => x.person.id === "b");
  assert.equal(a.net, 30000);
  assert.equal(bk.net, -20000);
  assert.equal(bk.overdue, 1);
  assert.equal(bk.open, 1);
});

test("birikim: yüzde, geçmişten tahmini bitiş, plandan tahmin, tamamlandı", () => {
  const now = at(2026, 10, 15);
  const g = { targetMinor: 1000000, deposits: [{ amountMinor: 100000, at: at(2026, 9, 15) }, { amountMinor: 100000, at: at(2026, 10, 1) }] };
  const p = goalProjection(g, now);
  assert.equal(p.saved, 200000);
  assert.equal(p.pct, 0.2);
  assert.equal(p.basis, "history");
  // 30 günlük pencerede 200.000 → 6.666/gün ; kalan 800.000 → 120 gün
  assert.equal(daysBetween(now, p.etaTs), 120);
  const plan = goalProjection({ targetMinor: 500000, monthlyPlanMinor: 100000, deposits: [] }, now);
  assert.equal(plan.basis, "plan");
  assert.equal(dayKey(plan.etaTs), "2027-03-15");
  assert.equal(goalProjection({ targetMinor: 1000, deposits: [{ amountMinor: 1000, at: now }] }, now).done, true);
  assert.equal(goalProjection({ targetMinor: 1000, deposits: [] }, now).etaTs, null);
  const need = goalProjection({ targetMinor: 1200000, deposits: [], targetDate: at(2027, 10, 15) }, now);
  assert.ok(Math.abs(need.neededPerMonth - 100000) < 2000);
});

test("harcamasız gün serisi: otomatik kayıtlar bozmaz, elle harcama bozar", () => {
  const now = at(2026, 10, 15, 10);
  const days = ["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
  const txs = [tx("expense", 100, at(2026, 10, 10)), tx("expense", 5000, at(2026, 10, 13), { recurringId: "x" })];
  const s = noSpendStreak({ txs, activeDays: days, now });
  assert.equal(s.current, 5); // 11..15
  assert.equal(s.longest, 5);
  const broken = noSpendStreak({ txs: [...txs, tx("expense", 100, at(2026, 10, 14))], activeDays: days, now });
  assert.equal(broken.current, 1); // sadece bugün
  assert.equal(noSpendStreak({ txs, activeDays: ["2026-10-14"], now }).current, 0); // bugün açılmadı
});

test("rozetler: koşullar", () => {
  const now = at(2026, 10, 15);
  const streak = { longest: 7, current: 2 };
  const b = badgeList({ txs: [tx("expense", 1, now)], streak, budget: { monthlyMinor: 100 }, goals: [], debts: [], now });
  const by = Object.fromEntries(b.map((x) => [x.key, x.earned]));
  assert.equal(by.first, true);
  assert.equal(by.streak7, true);
  assert.equal(by.streak30, false);
  assert.equal(by.budget, true);
  assert.equal(by.debtfree, false);
});

test("planlı ödemeler bütçeden düşülür (dönem sonuna kadar, borç hariç)", () => {
  const items = [
    { kind: "recurring", baseMinor: 50000, dateTs: at(2026, 10, 20) },
    { kind: "installment", baseMinor: 30000, dateTs: at(2026, 10, 28) },
    { kind: "recurring", baseMinor: 99999, dateTs: at(2026, 11, 20) },
    { kind: "debt", baseMinor: 77777, dateTs: at(2026, 10, 20) },
  ];
  assert.equal(committedUntil(items, at(2026, 11, 1)), 80000);
});

test("addMonthsClamped: yıl sonu geçişi", () => {
  assert.equal(dayKey(addMonthsClamped(at(2026, 11, 30), 3)), "2027-02-28");
  assert.equal(dayKey(addMonthsClamped(at(2024, 1, 31), 1)), "2024-02-29");
});
