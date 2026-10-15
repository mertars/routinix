import { monthRange, startOfDay, trLower } from "./dates";
import { baseOf } from "./money";

// Para toplamları — işlem listesi zaten silinmişleri dışlar.
export function totals(txs, [from, to] = [-Infinity, Infinity], rates) {
  let expense = 0;
  let income = 0;
  for (const t of txs) {
    if (t.occurredAt < from || t.occurredAt >= to) continue;
    const v = baseOf(t, rates);
    if (t.kind === "income") income += v;
    else expense += v;
  }
  return { expense, income, net: income - expense };
}

export const periodTotals = (txs, range, rates) => totals(txs, range, rates);
export const monthTotals = (txs, ts, rates) => totals(txs, monthRange(ts), rates);
export const dayTotals = (txs, ts, rates) => {
  const s = startOfDay(ts);
  return totals(txs, [s, s + 86400000], rates);
};

// "Sık yaptığın harcama" önerileri: son 120 günde ≥3 kez AYNI tutar+kategori+yer.
export function suggestShortcuts(txs, templates, dismissed = [], now = Date.now()) {
  const since = now - 120 * 86400000;
  const groups = new Map();
  for (const t of txs) {
    if (t.kind !== "expense" || t.occurredAt < since || t.installment || t.recurringId || t.split) continue; // otomatik/bölüşülen kayıtlar kısayol önerisi olmaz
    const key = [trLower(t.merchant || ""), t.categoryId, t.subcategoryId || "", t.amountMinor].join("|");
    const g = groups.get(key) || { key, count: 0, sample: t };
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.count >= 3 && !dismissed.includes(g.key))
    .filter((g) => !templates.some((p) => p.amountMinor === g.sample.amountMinor && p.categoryId === g.sample.categoryId && (p.subcategoryId || "") === (g.sample.subcategoryId || "") && trLower(p.merchant || "") === trLower(g.sample.merchant || "")))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
}

export function groupByDay(txs, keyFn) {
  const out = [];
  let cur = null;
  for (const t of txs) {
    const k = keyFn(t.occurredAt);
    if (!cur || cur.key !== k) {
      cur = { key: k, ts: t.occurredAt, items: [] };
      out.push(cur);
    }
    cur.items.push(t);
  }
  return out;
}
