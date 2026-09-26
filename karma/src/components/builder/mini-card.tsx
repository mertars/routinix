"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { POSITION_LABELS } from "@/lib/constants";
import { cardTier } from "@/lib/scoring";
import type { Player, Position } from "@/lib/types";
import { PlayerAvatar } from "../player/bits";

/** Açık zemin mi? (takım renginin üstündeki yazı rengini seçmek için) */
export function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
}

interface MiniCardProps {
  player: Player;
  rating: number;
  position: Position | "YDK" | "OUT";
  teamColor?: string;
  fit?: "primary" | "alt" | "off";
  rotatingKeeper?: boolean;
  selected?: boolean;
  ghost?: boolean;
  lifted?: boolean;
}

export function MiniCard({ player, rating, position, teamColor, fit = "primary", rotatingKeeper, selected, ghost, lifted }: MiniCardProps) {
  const tier = cardTier(rating);
  const plate = teamColor ?? "#33604a";
  const posLabel = position === "YDK" ? "YDK" : position === "OUT" ? "–" : position;
  const describe =
    position === "YDK" || position === "OUT"
      ? `${player.name}, ${position === "YDK" ? "dönüşümlü yedek" : "bu maç oynamıyor"}, puan ${rating}`
      : `${player.name}, ${POSITION_LABELS[position]}, bu mevkide puanı ${rating}${fit === "off" ? ", mevki dışı" : ""}${rotatingKeeper ? ", kaleci dönüşümlü" : ""}`;
  return (
    <div
      className={`relative w-[62px] transition-[transform,opacity] duration-150 ${ghost ? "opacity-30" : ""} ${lifted ? "scale-110" : ""}`}
      aria-label={describe}
      role="img"
    >
      {selected && <div className="absolute -inset-1.5 animate-pulse rounded-2xl border-2 border-neon" aria-hidden="true" />}
      <div className="player-card aspect-[5/6.6] w-full shadow-card" data-tier={tier} aria-hidden="true">
        <div className="relative z-[2] flex h-full flex-col px-1.5 pt-2">
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-center leading-none">
              <span className="font-display text-[19px] font-extrabold leading-[0.9] tabular">{rating}</span>
              <span className="mt-0.5 font-display text-[10px] font-bold">{posLabel}</span>
            </div>
            {fit === "off" && <TriangleAlert className="mt-0.5 size-3 text-[#b3261e]" strokeWidth={2.6} />}
            {rotatingKeeper && <RefreshCw className="mt-0.5 size-3" strokeWidth={2.6} />}
          </div>
          <div className="-mt-0.5 flex justify-center">
            <PlayerAvatar avatar={player.avatar} size={26} className="bg-black/10" />
          </div>
        </div>
      </div>
      <div
        className="absolute inset-x-0 -bottom-1 truncate rounded-md px-1 py-0.5 text-center text-[10.5px] font-bold leading-tight shadow"
        style={{ background: plate, color: isLight(plate) ? "#07120c" : "#f2fff7" }}
        aria-hidden="true"
      >
        {player.nickname || player.name.split(" ")[0]}
      </div>
    </div>
  );
}
