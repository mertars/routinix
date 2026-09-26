"use client";

import { motion } from "framer-motion";

export interface CompareRow {
  key: string;
  label: string;
  a: number;
  b: number;
}

interface CompareBarsProps {
  rows: CompareRow[];
  names: [string, string];
  colors: [string, string];
  /** Çubuk ölçeğinin üst sınırı. */
  max?: number;
  min?: number;
  title: string;
}

/**
 * İki takımın karşılıklı çubukları: ortadaki etiketten sola A, sağa B.
 * Değerler metin renginde, kimlik her zaman lejant + takım adıyla verilir.
 */
export function CompareBars({ rows, names, colors, max = 99, min = 30, title }: CompareBarsProps) {
  const scale = (v: number) => Math.max(4, ((v - min) / (max - min)) * 100);
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-ink-soft">
        {[0, 1].map((t) => (
          <span key={t} className={`flex min-w-0 items-center gap-1.5 ${t === 1 ? "flex-row-reverse" : ""}`}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colors[t] }} aria-hidden="true" />
            <span className="truncate">{names[t]}</span>
          </span>
        ))}
      </div>
      <table className="w-full border-separate border-spacing-y-1.5">
        <thead className="sr-only">
          <tr>
            <th scope="col">{names[0]}</th>
            <th scope="col">Özellik</th>
            <th scope="col">{names[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const better = r.a === r.b ? null : r.a > r.b ? 0 : 1;
            return (
              <tr key={r.key} title={`${r.label}: ${names[0]} ${r.a.toFixed(1)} · ${names[1]} ${r.b.toFixed(1)}`}>
                <td className="w-[42%] p-0">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`font-display text-[15px] tabular ${better === 0 ? "font-extrabold text-ink" : "font-semibold text-ink-muted"}`}>{r.a.toFixed(1)}</span>
                    <div className="flex h-2 w-full max-w-[120px] justify-end">
                      <motion.div
                        className="h-full rounded-l-[4px]"
                        style={{ background: colors[0] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${scale(r.a)}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </td>
                <th scope="row" className="w-[16%] px-1 text-center text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  {r.label}
                </th>
                <td className="w-[42%] p-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-2 w-full max-w-[120px]">
                      <motion.div
                        className="h-full rounded-r-[4px]"
                        style={{ background: colors[1] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${scale(r.b)}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <span className={`font-display text-[15px] tabular ${better === 1 ? "font-extrabold text-ink" : "font-semibold text-ink-muted"}`}>{r.b.toFixed(1)}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
