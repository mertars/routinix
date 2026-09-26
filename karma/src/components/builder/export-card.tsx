"use client";

import { forwardRef } from "react";
import type { Evaluation } from "@/lib/balancer";
import { getFormation } from "@/lib/constants";
import { formatDateTr } from "@/lib/lineup";
import { todayIso } from "@/lib/ids";
import type { Lineup, MatchFormat, Player, TeamStyle } from "@/lib/types";
import { LogoMark } from "../logo";
import { StaticHalfPitch } from "./pitch";

interface ExportCardProps {
  lineup: Lineup;
  evaluation: Evaluation;
  players: Map<string, Player>;
  styles: [TeamStyle, TeamStyle];
  format: MatchFormat;
  rotatingKeeper: boolean;
}

/** PNG olarak indirilen kadro görseli: sabit genişlikte, iki yarı saha yan yana. */
export const ExportCard = forwardRef<HTMLDivElement, ExportCardProps>(function ExportCard(
  { lineup, evaluation, players, styles, format, rotatingKeeper },
  ref,
) {
  const name = (id: string) => players.get(id)?.name ?? "?";
  return (
    <div ref={ref} className="w-[760px] bg-pitch-950 p-7 text-ink" style={{ fontFamily: "var(--font-sans)" }}>
      <div className="mb-5 flex items-center gap-3">
        <LogoMark size={40} />
        <div className="flex-1">
          <div className="font-display text-3xl font-extrabold uppercase tracking-wide">
            Kar<span className="text-neon">ma</span> · {format}v{format}
          </div>
          <div className="text-sm text-ink-muted">{formatDateTr(todayIso())}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Denge</div>
          <div className="text-4xl font-extrabold">%{evaluation.balance}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {([0, 1] as const).map((t) => {
          const formation = getFormation(lineup.teams[t].formationId, format);
          const ev = evaluation.teams[t];
          return (
            <div key={t}>
              <div className="mb-2 flex items-center gap-2">
                <span className="size-4 rounded-full border border-white/30" style={{ background: styles[t].color }} />
                <span className="flex-1 truncate text-lg font-bold">{styles[t].name}</span>
                <span className="font-display text-lg font-bold text-ink-soft">{formation.name}</span>
              </div>
              <StaticHalfPitch
                formation={formation}
                lineupTeam={lineup.teams[t]}
                evaluation={ev}
                players={players}
                color={styles[t].color}
                rotatingKeeper={rotatingKeeper}
              />
              <div className="mt-2 flex justify-between text-sm text-ink-soft">
                <span>Toplam {Math.round(ev.total)}</span>
                <span>Ortalama {ev.average.toFixed(1)}</span>
              </div>
              {lineup.teams[t].subs.length > 0 && (
                <div className="mt-1 text-sm text-ink-muted">Dönüşümlü: {lineup.teams[t].subs.map(name).join(", ")}</div>
              )}
            </div>
          );
        })}
      </div>
      {lineup.out.length > 0 && <div className="mt-4 text-sm text-ink-muted">Bu maç yedek: {lineup.out.map(name).join(", ")}</div>}
    </div>
  );
});
