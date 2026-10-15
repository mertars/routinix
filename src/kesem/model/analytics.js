// Kesem analiz hesapları — SAF fonksiyonlar. Tutarlar ₺ karşılığı (baseOf) ile toplanır.
// Yalnızca GİDERLER analiz edilir (gelir ayrı gösterilir).
import { addDays, daysBetween, dayKey, periodRange, shiftPeriod, startOfDay, shortDate, trLower } from "./dates";
import { baseOf } from "./money";

const inRange = (t, from, to) => t.occurredAt >= from && t.occurredAt < to;
const isExp = (t) => t.kind === "expense";

// Gün → { expense, income, count }
export function dailyTotals(txs, from, to, rates) {
  const m = new Map();
  for (const t of txs) {
    if (!inRange(t, from, to)) continue;
    const k = dayKey(t.occurredAt);
    const e = m.get(k) || { expense: 0, income: 0, count: 0 };
    if (isExp(t)) e.expense += baseOf(t, rates);
    else e.income += baseOf(t, rates);
    e.count++;
    m.set(k, e);
  }
  return m;
}

// Kategori dağılımı: en çok 6 dilim + "Diğer" (kalanların toplamı).
export function categoryBreakdown(txs, from, to, rates, maxSlices = 6) {
  const by = new Map();
  let total = 0;
  for (const t of txs) {
    if (!isExp(t) || !inRange(t, from, to)) continue;
    const v = baseOf(t, rates);
    by.set(t.categoryId, (by.get(t.categoryId) || 0) + v);
    total += v;
  }
  const all = [...by.entries()].map(([categoryId, value]) => ({ categoryId, value })).sort((a, b) => b.value - a.value);
  let rows = all;
  if (all.length > maxSlices) {
    const rest = all.slice(maxSlices - 1).reduce((s, r) => s + r.value, 0);
    rows = [...all.slice(0, maxSlices - 1), { categoryId: "__other", value: rest }];
  }
  return { total, rows: rows.map((r) => ({ ...r, share: total ? r.value / total : 0 })) };
}

// Trend: 'day' → son 30 gün, 'week' → son 12 hafta (Pzt başlangıçlı), 'month' → son 12 dönem.
export function trendSeries(txs, mode, now, rates, startDay = 1) {
  const buckets = [];
  const today = startOfDay(now);
  if (mode === "day") {
    for (let i = 29; i >= 0; i--) {
      const from = addDays(today, -i);
      buckets.push({ from, to: addDays(from, 1), label: shortDate(from) });
    }
  } else if (mode === "week") {
    const dow = (new Date(today).getDay() + 6) % 7; // Pzt=0
    const monday = addDays(today, -dow);
    for (let i = 11; i >= 0; i--) {
      const from = addDays(monday, -7 * i);
      buckets.push({ from, to: addDays(from, 7), label: shortDate(from) });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const [from, to] = periodRange(shiftPeriod(now, -i, startDay), startDay);
      buckets.push({ from, to, label: shortDate(from) });
    }
  }
  const first = buckets[0].from;
  const last = buckets[buckets.length - 1].to;
  const vals = new Array(buckets.length).fill(0);
  for (const t of txs) {
    if (!isExp(t) || !inRange(t, first, last)) continue;
    const i = buckets.findIndex((b) => inRange(t, b.from, b.to));
    if (i >= 0) vals[i] += baseOf(t, rates);
  }
  return buckets.map((b, i) => ({ ...b, value: vals[i] }));
}

// Gün × saat dilimi ısı haritası: satır = Pzt..Paz (0..6), sütun = 3 saatlik 8 dilim.
export function heatmap(txs, from, to, rates) {
  const cells = Array.from({ length: 7 }, (_, d) => Array.from({ length: 8 }, (_, b) => ({ dow: d, bucket: b, value: 0, count: 0 })));
  let max = 0;
  for (const t of txs) {
    if (!isExp(t) || !inRange(t, from, to)) continue;
    const d = new Date(t.occurredAt);
    const c = cells[(d.getDay() + 6) % 7][Math.floor(d.getHours() / 3)];
    c.value += baseOf(t, rates);
    c.count++;
    max = Math.max(max, c.value);
  }
  return { cells, max };
}

// Önceki dönemle karşılaştırma — AYNI GÜN SAYISINA göre (adil): bu dönem şu ana kadar vs geçen dönemin aynı günleri.
export function comparePeriods(txs, now, startDay, rates) {
  const [from, to] = periodRange(now, startDay);
  const elapsed = Math.max(1, Math.min(daysBetween(from, now) + 1, daysBetween(from, to)));
  const [pf, pt] = periodRange(shiftPeriod(now, -1, startDay), startDay);
  const prevEnd = Math.min(pt, addDays(pf, elapsed));
  const sum = (a, b) => txs.reduce((s, t) => (isExp(t) && inRange(t, a, b) ? s + baseOf(t, rates) : s), 0);
  const current = sum(from, addDays(startOfDay(now), 1) < to ? addDays(startOfDay(now), 1) : to);
  const previous = sum(pf, prevEnd);
  const previousFull = sum(pf, pt);
  const pct = previous > 0 ? (current - previous) / previous : null;
  return { current, previous, previousFull, pct, elapsed };
}
export function compareText(pct) {
  if (pct == null) return null;
  const r = Math.round(Math.abs(pct) * 100);
  if (r === 0) return "Geçen dönemle aynı";
  return pct < 0 ? `Geçen döneme göre %${r} az` : `Geçen döneme göre %${r} fazla`;
}

// Akıllı özetler
export function insights(txs, from, to, now, rates) {
  const exp = txs.filter((t) => isExp(t) && inRange(t, from, to));
  const byDay = new Map();
  const byMerchant = new Map();
  const byCat = new Map();
  let total = 0;
  for (const t of exp) {
    const v = baseOf(t, rates);
    total += v;
    byDay.set(dayKey(t.occurredAt), (byDay.get(dayKey(t.occurredAt)) || 0) + v);
    byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + v);
    const m = (t.merchant || "").trim();
    if (m) {
      const k = trLower(m);
      const e = byMerchant.get(k) || { name: m, count: 0, total: 0 };
      e.count++;
      e.total += v;
      byMerchant.set(k, e);
    }
  }
  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCat = top(byCat);
  const topDay = top(byDay);
  const topMerchant = [...byMerchant.values()].sort((a, b) => b.count - a.count || b.total - a.total)[0] || null;
  const elapsed = Math.max(1, Math.min(daysBetween(from, now) + 1, daysBetween(from, to)));
  return {
    total,
    count: exp.length,
    topCategory: topCat ? { categoryId: topCat[0], value: topCat[1] } : null,
    priciestDay: topDay ? { dayKey: topDay[0], value: topDay[1] } : null,
    topMerchant,
    avgDaily: Math.round(total / elapsed),
    elapsed,
  };
}

// Kart/ödeme yöntemi bazlı dönem toplamı
export function accountTotals(txs, from, to, rates) {
  const m = new Map();
  let total = 0;
  for (const t of txs) {
    if (!isExp(t) || !inRange(t, from, to)) continue;
    const v = baseOf(t, rates);
    m.set(t.accountId, (m.get(t.accountId) || 0) + v);
    total += v;
  }
  return { total, rows: [...m.entries()].map(([accountId, value]) => ({ accountId, value, share: total ? value / total : 0 })).sort((a, b) => b.value - a.value) };
}
