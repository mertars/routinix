"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { CircleCheck, Scale, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export function balanceVerdict(v: number) {
  if (v >= 92) return { label: "Çok dengeli", color: "var(--color-neon)", Icon: CircleCheck };
  if (v >= 80) return { label: "Dengeli", color: "var(--color-warning)", Icon: Scale };
  return { label: "Dengesiz", color: "var(--color-danger)", Icon: TriangleAlert };
}

/** Büyük denge skoru göstergesi: kahraman sayı + aynı rampadan izli metre. */
export function BalanceGauge({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `%${Math.round(v)}`);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.7, ease: "easeOut" });
    return () => c.stop();
  }, [mv, value]);
  const verdict = balanceVerdict(value);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Denge skoru</div>
          <motion.div className="text-[56px] font-extrabold leading-none tracking-tight text-ink" aria-hidden="true">
            {text}
          </motion.div>
          <span className="sr-only" aria-live="polite">
            Denge skoru yüzde {value}, {verdict.label}
          </span>
        </div>
        <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-sm font-semibold text-ink">
          <verdict.Icon className="size-4" style={{ color: verdict.color }} aria-hidden="true" />
          {verdict.label}
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${verdict.color} 18%, transparent)` }} aria-hidden="true">
        <motion.div className="h-full rounded-full" style={{ background: verdict.color }} initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
      </div>
    </div>
  );
}
