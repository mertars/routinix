// Kesem para yönetimi hesapları — SAF fonksiyonlar (arayüzden bağımsız, test edilebilir).
// Tutarlar kuruş (tam sayı). Hesaplarda ₺ karşılığı (`baseMinor`) kullanılır.
import { addDays, addMonthsClamped, daysBetween, dayKey, periodRange, startOfDay } from "./dates";
import { baseOf } from "./money";

// ---------------------------------------------------------------- Taksit
// Toplam / adet; kuruş farkı İLK taksite eklenir → toplam her zaman tam tutar.
export function installmentAmounts(total, count) {
  const n = Math.max(1, Math.floor(count));
  const per = Math.floor(total / n);
  const rem = total - per * n;
  return Array.from({ length: n }, (_, i) => per + (i === 0 ? rem : 0));
}
export const installmentKey = (planId, i) => `g-inst-${planId}-${i}`;

// Plan: { id, totalMinor, count, firstAt, stoppedAt? } → satırlar (tarih artan)
export function installmentRows(plan) {
  const amounts = installmentAmounts(plan.totalMinor, plan.count);
  const rows = amounts.map((amountMinor, index) => ({
    index,
    amountMinor,
    dateTs: addMonthsClamped(plan.firstAt, index),
    key: installmentKey(plan.id, index),
  }));
  return plan.stoppedAt ? rows.filter((r) => r.dateTs <= plan.stoppedAt) : rows;
}
export function installmentProgress(plan, now = Date.now()) {
  const rows = installmentRows(plan);
  const done = rows.filter((r) => r.dateTs <= now);
  const left = rows.filter((r) => r.dateTs > now);
  return {
    rows,
    doneCount: done.length,
    leftCount: left.length,
    leftMinor: left.reduce((s, r) => s + r.amountMinor, 0),
    paidMinor: done.reduce((s, r) => s + r.amountMinor, 0),
    next: left[0] || null,
    finished: left.length === 0,
  };
}

// ---------------------------------------------------------- Tekrarlayan
// Kural: { id, frequency: weekly|monthly|yearly, interval, anchorAt, endAt?, paused?, skipped? }
export function occurrenceDate(rule, i) {
  const k = Math.max(1, rule.interval || 1);
  if (rule.frequency === "weekly") return addDays(rule.anchorAt, 7 * k * i);
  if (rule.frequency === "yearly") return addMonthsClamped(rule.anchorAt, 12 * k * i);
  return addMonthsClamped(rule.anchorAt, k * i);
}
export const occurrenceKey = (ruleId, i) => `g-rec-${ruleId}-${i}`;

// [from, to) aralığındaki tekrarlar.
export function occurrencesBetween(rule, from, to, cap = 600) {
  const out = [];
  if (rule.paused) return out;
  for (let i = 0; i < cap; i++) {
    const t = occurrenceDate(rule, i);
    if (t >= to) break;
    if (rule.endAt && t > rule.endAt) break;
    if (t >= from) out.push({ index: i, dateTs: t, key: occurrenceKey(rule.id, i) });
  }
  return out;
}

// Aylık / yıllık eşdeğer (₺, rates ile).
export function monthlyEquivalent(rule, rates) {
  const k = Math.max(1, rule.interval || 1);
  const base = baseOf({ amountMinor: rule.amountMinor, currency: rule.currency }, rates);
  const factor = rule.frequency === "weekly" ? 52 / 12 / k : rule.frequency === "yearly" ? 1 / (12 * k) : 1 / k;
  return Math.round(base * factor);
}
export const yearlyEquivalent = (rule, rates) => monthlyEquivalent(rule, rates) * 12;

// ----------------------------------------------- Açılışta üretilecek kayıtlar
// exists(key) → bu anahtarlı işlem (silinmiş olsa bile) var mı?  Yoksa üretilir.
export function dueGenerated({ installments, recurrings, now, exists }) {
  const out = [];
  for (const plan of installments) {
    if (plan.deletedAt) continue;
    for (const r of installmentRows(plan)) {
      if (r.dateTs <= now && !exists(r.key)) out.push({ type: "installment", plan, ...r });
    }
  }
  for (const rule of recurrings) {
    if (rule.deletedAt || rule.paused || !rule.autoPost) continue;
    const skipped = new Set(rule.skipped || []);
    const due = occurrencesBetween(rule, 0, now + 1).filter((o) => !skipped.has(o.index) && !exists(o.key));
    for (const o of due.slice(-36)) out.push({ type: "recurring", rule, ...o });
  }
  return out;
}

// --------------------------------------------------------- Yaklaşan ödemeler
// Gelecek (ve gecikmiş, elle ödenecek) kalemler. Tarihe göre artan.
export function upcomingItems({ installments, recurrings, debts = [], people = [], exists, now, horizonDays = 45, rates }) {
  const today = startOfDay(now);
  const horizon = addDays(today, horizonDays + 1);
  const items = [];
  for (const plan of installments) {
    if (plan.deletedAt) continue;
    for (const r of installmentRows(plan)) {
      if (r.dateTs > now && r.dateTs < horizon && !exists(r.key)) {
        items.push({ id: r.key, kind: "installment", title: plan.title, planId: plan.id, index: r.index, count: plan.count, amountMinor: r.amountMinor, currency: plan.currency, baseMinor: Math.round(r.amountMinor * (plan.rate || 1)), dateTs: r.dateTs, autoPost: true });
      }
    }
  }
  for (const rule of recurrings) {
    if (rule.deletedAt || rule.paused || rule.kind === "income") continue;
    const skipped = new Set(rule.skipped || []);
    // elle ödenenler için 90 güne kadar gecikmiş kalemleri de göster
    const from = rule.autoPost ? now + 1 : addDays(today, -90);
    for (const o of occurrencesBetween(rule, from, horizon)) {
      if (skipped.has(o.index) || exists(o.key)) continue;
      items.push({ id: o.key, kind: "recurring", title: rule.title, ruleId: rule.id, index: o.index, amountMinor: rule.amountMinor, currency: rule.currency, baseMinor: baseOf({ amountMinor: rule.amountMinor, currency: rule.currency }, rates), dateTs: o.dateTs, autoPost: !!rule.autoPost, type: rule.type });
    }
  }
  const byPerson = new Map(people.map((p) => [p.id, p]));
  for (const d of debts) {
    if (d.deletedAt || !d.dueAt || remainingOf(d) <= 0) continue;
    if (d.dueAt >= horizon) continue;
    items.push({ id: `debt-${d.id}`, kind: "debt", title: `${byPerson.get(d.personId)?.name || "Kişi"} · ${d.direction === "lent" ? "alacak" : "borç"}`, debtId: d.id, direction: d.direction, amountMinor: remainingOf(d), currency: d.currency, baseMinor: baseOf({ amountMinor: remainingOf(d), currency: d.currency }, rates), dateTs: d.dueAt, autoPost: false });
  }
  return items
    .map((it) => {
      const days = daysBetween(now, it.dateTs);
      return { ...it, days, status: days < 0 && !it.autoPost ? "overdue" : days === 0 ? "today" : days <= 3 ? "soon" : "later" };
    })
    .sort((a, b) => a.dateTs - b.dateTs);
}

// Dönem sonuna kadar çıkacak PLANLI giderler (bütçeden düşülür): taksit + tekrarlayan; borçlar hariç.
export function committedUntil(items, periodEnd) {
  return items.filter((it) => it.kind !== "debt" && it.dateTs < periodEnd).reduce((s, it) => s + it.baseMinor, 0);
}

// ------------------------------------------------------------------- Bütçe
const sumExpense = (txs, from, to, rates) => {
  let s = 0;
  for (const t of txs) if (t.kind === "expense" && t.occurredAt >= from && t.occurredAt < to) s += baseOf(t, rates);
  return s;
};

export const budgetState = (ratio) => (ratio > 1 ? "over" : ratio >= 0.8 ? "near" : "ok");

// Bugün harcayabileceğin tutar:
//   (aylık bütçe − bugünden ÖNCE harcanan − dönem sonuna kadar planlı ödemeler) ÷ kalan gün (bugün dahil)
//   bugün kalan = o tutar − bugün harcanan
export function budgetStatus({ budget, txs, now, committedMinor = 0, rates }) {
  const startDay = budget?.startDay || 1;
  const [from, to] = periodRange(now, startDay);
  const today = startOfDay(now);
  const spent = sumExpense(txs, from, to, rates);
  const spentToday = sumExpense(txs, today, addDays(today, 1), rates);
  const daysLeft = Math.max(1, daysBetween(now, to));
  const daysTotal = daysBetween(from, to);
  const monthly = budget?.monthlyMinor || 0;
  const includePlanned = budget?.includePlanned !== false;
  const committed = includePlanned ? committedMinor : 0;
  const hasBudget = monthly > 0;
  const free = monthly - spent - committed;
  const allowanceRaw = hasBudget ? Math.floor((monthly - (spent - spentToday) - committed) / daysLeft) : 0;
  const todayLeft = allowanceRaw - spentToday;
  const ratio = hasBudget ? (spent + committed) / monthly : 0;
  return {
    hasBudget, from, to, startDay, monthly, spent, spentToday, committed, free,
    daysLeft, daysTotal, dayIndex: daysTotal - daysLeft + 1,
    allowance: Math.max(0, allowanceRaw), todayLeft, ratio,
    state: !hasBudget ? "none" : allowanceRaw < 0 || spent > monthly ? "over" : budgetState(ratio),
  };
}

export function categoryBudgets({ budget, txs, now, rates }) {
  const startDay = budget?.startDay || 1;
  const [from, to] = periodRange(now, startDay);
  const spent = new Map();
  for (const t of txs) {
    if (t.kind !== "expense" || t.occurredAt < from || t.occurredAt >= to) continue;
    spent.set(t.categoryId, (spent.get(t.categoryId) || 0) + baseOf(t, rates));
  }
  return Object.entries(budget?.byCategory || {})
    .filter(([, v]) => v > 0)
    .map(([categoryId, limit]) => {
      const s = spent.get(categoryId) || 0;
      return { categoryId, limit, spent: s, left: limit - s, ratio: s / limit, state: budgetState(s / limit) };
    });
}

// ---------------------------------------------------------------- Birikim
export const goalSaved = (g) => (g.deposits || []).reduce((s, d) => s + d.amountMinor, 0);

export function goalProjection(goal, now = Date.now()) {
  const saved = goalSaved(goal);
  const remaining = Math.max(0, goal.targetMinor - saved);
  const pct = goal.targetMinor > 0 ? Math.min(1, saved / goal.targetMinor) : 0;
  if (remaining === 0) return { saved, remaining, pct: 1, done: true, etaTs: null, basis: "done" };
  const deps = (goal.deposits || []).filter((d) => d.at <= now);
  let etaTs = null;
  let basis = "none";
  if (deps.length) {
    const first = Math.min(...deps.map((d) => d.at));
    const window = Math.min(90, Math.max(30, daysBetween(first, now)));
    const since = addDays(now, -window);
    const net = deps.filter((d) => d.at >= since).reduce((s, d) => s + d.amountMinor, 0);
    const perDay = net / window;
    if (perDay > 0) {
      etaTs = addDays(now, Math.ceil(remaining / perDay));
      basis = "history";
    }
  }
  if (etaTs == null && goal.monthlyPlanMinor > 0) {
    etaTs = addMonthsClamped(now, Math.ceil(remaining / goal.monthlyPlanMinor));
    basis = "plan";
  }
  let neededPerMonth = null;
  if (goal.targetDate && goal.targetDate > now) {
    const months = Math.max(1, daysBetween(now, goal.targetDate) / 30.4375);
    neededPerMonth = Math.ceil(remaining / months);
  }
  return { saved, remaining, pct, done: false, etaTs, basis, neededPerMonth };
}

// ------------------------------------------------------------ Borç / bölüşme
export const remainingOf = (d) => Math.max(0, d.amountMinor - (d.paidMinor || 0));

// Eşit bölüşme: kuruş farkı ÖDEYENE yazılır. n = ben dahil katılımcı sayısı.
export function splitEqual(totalMinor, n, paidByMe = true) {
  const people = Math.max(2, Math.floor(n));
  const base = Math.floor(totalMinor / people);
  const rem = totalMinor - base * people;
  return paidByMe
    ? { myShare: base + rem, otherShare: base, payerShare: base + rem }
    : { myShare: base, otherShare: base, payerShare: base + rem };
}

// Kişi bazlı net bakiye (₺): + = sana borçlu, − = sen borçlusun.
export function personBalances({ people, debts, rates }) {
  const map = new Map(people.filter((p) => !p.deletedAt).map((p) => [p.id, { person: p, lent: 0, borrowed: 0, open: 0, overdue: 0 }]));
  const now = Date.now();
  for (const d of debts) {
    if (d.deletedAt) continue;
    const row = map.get(d.personId);
    if (!row) continue;
    const rem = remainingOf(d);
    if (!rem) continue;
    const base = baseOf({ amountMinor: rem, currency: d.currency, baseMinor: d.currency === "TRY" ? rem : undefined }, rates);
    if (d.direction === "lent") row.lent += base;
    else row.borrowed += base;
    row.open++;
    if (d.dueAt && d.dueAt < startOfDay(now)) row.overdue++;
  }
  return [...map.values()].map((r) => ({ ...r, net: r.lent - r.borrowed })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

// ------------------------------------------------------------ Seri ve rozet
const isManualExpense = (t) => t.kind === "expense" && !t.recurringId && !t.installment;

// Harcamasız gün: Kesem'i AÇTIĞIN (kayıt tuttuğun) ve elle gider girmediğin gün.
// Otomatik taksit/abonelik kayıtları seriyi bozmaz.
export function noSpendStreak({ txs, activeDays, now = Date.now() }) {
  const spend = new Set(txs.filter(isManualExpense).map((t) => dayKey(t.occurredAt)));
  const active = new Set(activeDays);
  const ok = (ts) => active.has(dayKey(ts)) && !spend.has(dayKey(ts));
  let current = 0;
  for (let d = startOfDay(now), guard = 0; guard < 800 && ok(d); d = addDays(d, -1), guard++) current++;
  let longest = 0;
  let run = 0;
  const days = [...active].sort();
  if (days.length) {
    const first = new Date(days[0] + "T12:00:00").getTime();
    for (let d = startOfDay(first); d <= startOfDay(now); d = addDays(d, 1)) {
      if (ok(d)) longest = Math.max(longest, ++run);
      else run = 0;
    }
  }
  return { current, longest, spentToday: spend.has(dayKey(now)), total: [...active].filter((k) => !spend.has(k)).length };
}

export function badgeList({ txs, streak, budget, goals, debts, now = Date.now() }) {
  const goalDone = goals.some((g) => !g.deletedAt && goalSaved(g) >= g.targetMinor && g.targetMinor > 0);
  const anyDeposit = goals.some((g) => !g.deletedAt && (g.deposits || []).length);
  const liveDebts = debts.filter((d) => !d.deletedAt);
  const debtFree = liveDebts.length > 0 && liveDebts.every((d) => remainingOf(d) === 0);
  let kept = false;
  if (budget?.monthlyMinor > 0) {
    const [from] = periodRange(now, budget.startDay || 1);
    const [pf, pt] = periodRange(from - 86400000, budget.startDay || 1);
    const inPrev = txs.filter((t) => t.occurredAt >= pf && t.occurredAt < pt);
    kept = inPrev.length >= 5 && sumExpense(txs, pf, pt) <= budget.monthlyMinor;
  }
  const n = txs.length;
  const mk = (key, title, desc, progress, target) => ({ key, title, desc, progress: Math.min(progress, target), target, earned: progress >= target });
  return [
    mk("first", "İlk adım", "İlk kaydını ekle", n, 1),
    mk("hundred", "Düzenli kayıt", "100 kayıt tut", n, 100),
    mk("streak3", "3 gün", "3 gün üst üste harcamasız", streak.longest, 3),
    mk("streak7", "Bir hafta", "7 gün üst üste harcamasız", streak.longest, 7),
    mk("streak30", "Bir ay", "30 gün üst üste harcamasız", streak.longest, 30),
    mk("budget", "Plan yaptın", "Aylık bütçe belirle", budget?.monthlyMinor > 0 ? 1 : 0, 1),
    mk("kept", "Bütçe içinde", "Bir dönemi bütçeyi aşmadan bitir", kept ? 1 : 0, 1),
    mk("saver", "Kumbara", "Bir kumbaraya ilk birikimini ekle", anyDeposit ? 1 : 0, 1),
    mk("goal", "Hedefe ulaştın", "Bir birikim hedefini tamamla", goalDone ? 1 : 0, 1),
    mk("debtfree", "Hesaplar kapalı", "Tüm borç/alacak kayıtlarını kapat", debtFree ? 1 : 0, 1),
  ];
}
