"use client";

import { useState } from "react";
import { RESULT_LABELS, type FormEntry } from "@/lib/stats";

const RESULT_COLOR = { G: "var(--color-neon)", B: "#7d8f86", M: "var(--color-danger)" } as const;

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/**
 * Son maçların gol farkı: sıfır çizgisinden yukarı (kazanılan) / aşağı
 * (kaybedilen) sütunlar. Sonuç rengi her zaman G/B/M harfiyle birlikte gelir.
 */
export function FormChart({ form }: { form: FormEntry[] }) {
  const [active, setActive] = useState<string | null>(null);
  if (form.length === 0) {
    return <p className="rounded-2xl bg-white/4 px-4 py-5 text-center text-sm text-ink-muted">Skoru girilmiş maç yok. Maç kaydedip skoru girince form grafiği burada belirir.</p>;
  }
  const maxAbs = Math.max(3, ...form.map((f) => Math.abs(f.goalDiff)));
  const half = 56; // px, sıfır çizgisinin iki yanı
  const activeEntry = form.find((f) => f.matchId === active);

  return (
    <figure>
      <div className="relative" role="img" aria-label={`Son ${form.length} maç: ${form.map((f) => `${formatDate(f.date)} ${RESULT_LABELS[f.result]} (${f.goalDiff > 0 ? "+" : ""}${f.goalDiff})`).join(", ")}`}>
        <div className="flex items-stretch justify-around gap-2" style={{ height: half * 2 + 24 }} aria-hidden="true">
          {form.map((f) => {
            const h = Math.max(4, (Math.abs(f.goalDiff) / maxAbs) * half);
            const up = f.goalDiff >= 0;
            return (
              <button
                key={f.matchId}
                type="button"
                tabIndex={-1}
                className="relative flex w-10 flex-col items-center"
                onPointerEnter={() => setActive(f.matchId)}
                onPointerLeave={() => setActive(null)}
                onClick={() => setActive((a) => (a === f.matchId ? null : f.matchId))}
              >
                {/* Yukarı yarı */}
                <div className="flex w-full flex-1 flex-col items-center justify-end">
                  {up && (
                    <>
                      <span className="mb-1 font-display text-sm font-bold text-ink-soft tabular">{f.goalDiff > 0 ? `+${f.goalDiff}` : "0"}</span>
                      <span className="w-5 rounded-t-[4px]" style={{ height: f.goalDiff === 0 ? 3 : h, background: RESULT_COLOR[f.result], opacity: active && active !== f.matchId ? 0.4 : 1 }} />
                    </>
                  )}
                </div>
                <div className="h-px w-full bg-white/15" />
                <div className="flex w-full flex-1 flex-col items-center justify-start">
                  {!up && (
                    <>
                      <span className="w-5 rounded-b-[4px]" style={{ height: h, background: RESULT_COLOR[f.result], opacity: active && active !== f.matchId ? 0.4 : 1 }} />
                      <span className="mt-1 font-display text-sm font-bold text-ink-soft tabular">{f.goalDiff}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-around gap-2" aria-hidden="true">
          {form.map((f) => (
            <div key={f.matchId} className="flex w-10 flex-col items-center gap-1">
              <span
                className="grid size-7 place-items-center rounded-full font-display text-sm font-extrabold"
                style={{ background: `color-mix(in srgb, ${RESULT_COLOR[f.result]} 22%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${RESULT_COLOR[f.result]}` }}
              >
                <span className="text-ink">{f.result}</span>
              </span>
              <span className="text-[10px] text-ink-muted">{formatDate(f.date)}</span>
            </div>
          ))}
        </div>
        {activeEntry && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl border border-white/10 bg-pitch-900 px-3 py-1.5 text-xs shadow-xl">
            <span className="font-semibold">{formatDate(activeEntry.date)}</span> · {RESULT_LABELS[activeEntry.result]} · gol farkı {activeEntry.goalDiff > 0 ? "+" : ""}
            {activeEntry.goalDiff}
            {activeEntry.mvp && " · ⭐ maçın adamı"}
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap justify-center gap-3 text-[11px] text-ink-muted">
        {(["G", "B", "M"] as const).map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: RESULT_COLOR[r] }} aria-hidden="true" />
            {r} = {RESULT_LABELS[r]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
