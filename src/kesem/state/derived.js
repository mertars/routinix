import { useMemo } from "react";
import { useKesem } from "./store";
import { budgetStatus, categoryBudgets, committedUntil, noSpendStreak } from "../model/finance";
import { periodRange, startOfDay } from "../model/dates";

// Ekranlar arası paylaşılan türetilmiş para durumu (bütçe, planlı ödemeler, seri).
export function useFinance() {
  const k = useKesem();
  const now = Date.now();
  const dayStamp = startOfDay(now);
  return useMemo(() => {
    const planned = k.plannedItems(62);
    const to = periodRange(now, k.budget.startDay)[1];
    const committed = committedUntil(planned, to);
    const status = budgetStatus({ budget: k.budget, txs: k.transactions, now, committedMinor: committed, rates: k.rates });
    const cats = categoryBudgets({ budget: k.budget, txs: k.transactions, now, rates: k.rates });
    const streak = noSpendStreak({ txs: k.transactions, activeDays: k.activityDays, now });
    return { now, planned, status, cats, streak, committed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.transactions, k.installments, k.recurrings, k.debts, k.people, k.budget, k.rates, k.activityDays, dayStamp]);
}
