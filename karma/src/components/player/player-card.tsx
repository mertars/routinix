"use client";

import { FOOT_LABELS, GK_ATTR_SHORT, MAIN_ATTR_SHORT, POSITION_LABELS } from "@/lib/constants";
import { cardTier, CARD_TIER_LABELS, effectiveGoalkeeping, mainAttributes, overallRating } from "@/lib/scoring";
import { GK_ATTRS, MAIN_ATTRS, type Player, type Weights } from "@/lib/types";
import { PlayerAvatar } from "./bits";

type CardSize = "sm" | "md" | "lg";

const SIZES: Record<CardSize, { w: string; rating: string; pos: string; name: string; avatar: number; stat: string; statLabel: string; pad: string }> = {
  sm: { w: "w-[128px]", rating: "text-[34px]", pos: "text-sm", name: "text-base", avatar: 46, stat: "text-base", statLabel: "text-[10px]", pad: "px-3 pt-4 pb-4" },
  md: { w: "w-full", rating: "text-[42px]", pos: "text-[15px]", name: "text-lg", avatar: 58, stat: "text-lg", statLabel: "text-[11px]", pad: "px-3.5 pt-5 pb-5" },
  lg: { w: "w-[248px]", rating: "text-[60px]", pos: "text-xl", name: "text-2xl", avatar: 88, stat: "text-2xl", statLabel: "text-xs", pad: "px-5 pt-7 pb-7" },
};

/** Kartta gösterilecek 6 özellik: dış saha için ana özellikler, kaleci için kalecilik + PAS. */
export function cardStats(player: Player): { key: string; label: string; value: number }[] {
  const main = mainAttributes(player.attributes);
  if (player.primaryPosition === "KL") {
    const gk = effectiveGoalkeeping(player);
    return [
      ...GK_ATTRS.map((k) => ({ key: k, label: GK_ATTR_SHORT[k], value: gk[k] })),
      { key: "pas", label: MAIN_ATTR_SHORT.pas, value: main.pas },
    ];
  }
  return MAIN_ATTRS.map((k) => ({ key: k, label: MAIN_ATTR_SHORT[k], value: main[k] }));
}

interface PlayerCardProps {
  player: Player;
  weights: Weights;
  size?: CardSize;
  /** Puanı dışarıdan zorla (ör. canlı önizleme). */
  rating?: number;
  showInactive?: boolean;
}

export function PlayerCard({ player, weights, size = "md", rating, showInactive = true }: PlayerCardProps) {
  const overall = rating ?? overallRating(player, weights);
  const tier = cardTier(overall);
  const s = SIZES[size];
  const stats = cardStats(player);
  const inactive = showInactive && !player.active;

  return (
    <div
      className={`player-card ${s.w} aspect-[5/7] select-none shadow-card`}
      data-tier={tier}
      data-inactive={inactive}
      role="img"
      aria-label={`${player.name}, ${POSITION_LABELS[player.primaryPosition]}, genel puan ${overall}, ${CARD_TIER_LABELS[tier]} kart${inactive ? ", bu hafta pasif" : ""}`}
    >
      {tier === "special" && <div className="card-shine" aria-hidden="true" />}
      <div className={`relative z-[2] flex h-full flex-col ${s.pad}`} aria-hidden="true">
        <div className="flex items-start justify-between gap-1">
          <div className="flex flex-col items-center leading-none">
            <span className={`font-display font-extrabold leading-[0.85] tabular ${s.rating}`}>{overall}</span>
            <span className={`mt-1 font-display font-bold uppercase tracking-wider ${s.pos}`}>{player.primaryPosition}</span>
            {player.altPositions.length > 0 && size !== "sm" && (
              <span className="mt-1 flex flex-col items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--card-sub)" }}>
                {player.altPositions.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </span>
            )}
          </div>
          <div className="relative">
            <PlayerAvatar avatar={player.avatar} size={s.avatar} className="bg-black/10" />
          </div>
        </div>

        <div className="mt-auto">
          <div className={`truncate text-center font-display font-bold uppercase leading-tight tracking-wide ${s.name}`}>
            {player.nickname || player.name.split(" ")[0]}
          </div>
          {size !== "sm" && (
            <div className="truncate text-center text-[11px] font-medium" style={{ color: "var(--card-sub)" }}>
              {player.nickname ? player.name : `${FOOT_LABELS[player.foot]} ayak`}
            </div>
          )}
          <div className="mx-auto my-1.5 h-px w-4/5" style={{ background: "var(--card-line)" }} />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {stats.map((st) => (
              <div key={st.key} className="flex items-baseline justify-center gap-1.5">
                <dd className={`font-display font-extrabold tabular ${s.stat}`}>{st.value}</dd>
                <dt className={`font-semibold uppercase tracking-wide ${s.statLabel}`} style={{ color: "var(--card-sub)" }}>
                  {st.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {inactive && (
        <span className="absolute left-1/2 top-2 z-[3] -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Pasif
        </span>
      )}
    </div>
  );
}
