"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { TeamEvaluation } from "@/lib/balancer";
import { placeId, type PlaceId } from "@/lib/lineup";
import { positionFit } from "@/lib/scoring";
import type { Formation, Player, Position, TeamLineup } from "@/lib/types";
import { MiniCard } from "./mini-card";

/** Saha çizgileri (kale altta). `goalAtTop` ile 180° döndürülür. */
function PitchMarkings({ goalAtTop, joined }: { goalAtTop: boolean; joined: boolean }) {
  const line = "rgb(232 243 236 / 0.32)";
  return (
    <div className={`pointer-events-none absolute inset-0 ${goalAtTop ? "rotate-180" : ""}`} aria-hidden="true">
      <div
        className="absolute inset-x-2 bottom-2"
        style={{ top: joined ? 0 : 8, border: `2px solid ${line}`, borderTop: joined ? "none" : `2px solid ${line}`, borderRadius: joined ? "0 0 6px 6px" : 6 }}
      />
      {/* Orta çizgi ve yarım orta yuvarlak (birleşik sahada iki yarı tam çember oluşturur) */}
      <div className="absolute inset-x-2" style={{ top: joined ? 0 : 8, height: joined ? 1 : 2, background: line }} />
      <div
        className="absolute left-1/2 aspect-square w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ top: joined ? 0 : 8, border: `2px solid ${line}` }}
      />
      {/* Ceza sahası, kale alanı, kale */}
      <div className="absolute bottom-2 left-1/2 h-[19%] w-[58%] -translate-x-1/2" style={{ border: `2px solid ${line}`, borderBottom: "none" }} />
      <div className="absolute bottom-2 left-1/2 h-[7.5%] w-[28%] -translate-x-1/2" style={{ border: `2px solid ${line}`, borderBottom: "none" }} />
      <div className="absolute bottom-[calc(19%+8px)] left-1/2 h-[6%] w-[18%] -translate-x-1/2 overflow-hidden">
        <div className="absolute left-0 top-[-100%] h-[200%] w-full rounded-full" style={{ border: `2px solid ${line}` }} />
      </div>
      <div className="absolute bottom-[13%] left-1/2 size-1.5 -translate-x-1/2 rounded-full" style={{ background: line }} />
      <div className="absolute bottom-0.5 left-1/2 h-1.5 w-[20%] -translate-x-1/2 rounded-sm" style={{ background: "rgb(232 243 236 / 0.55)" }} />
    </div>
  );
}

export interface SlotView {
  id: PlaceId;
  player: Player | null;
  rating: number;
  position: Position | "YDK" | "OUT";
  fit: "primary" | "alt" | "off";
  rotatingKeeper?: boolean;
}

interface DraggableCardProps {
  slot: SlotView;
  teamColor?: string;
  selected: boolean;
  onTap: (id: PlaceId) => void;
  activeId: PlaceId | null;
}

/** Hem sürüklenebilir hem bırakılabilir oyuncu yeri. */
export function DraggablePlace({ slot, teamColor, selected, onTap, activeId }: DraggableCardProps) {
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: slot.id });
  const { setNodeRef: dragRef, attributes, listeners, isDragging } = useDraggable({ id: slot.id, disabled: !slot.player });
  const highlight = isOver && activeId !== null && activeId !== slot.id;
  return (
    <div ref={dropRef} className="relative">
      {highlight && <div className="absolute -inset-2 rounded-2xl bg-neon/25 ring-2 ring-neon" aria-hidden="true" />}
      {slot.player ? (
        <button
          ref={dragRef}
          type="button"
          {...attributes}
          {...listeners}
          onClick={() => onTap(slot.id)}
          className="relative block touch-manipulation rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-neon"
          aria-pressed={selected}
          aria-roledescription="sürüklenebilir oyuncu"
          aria-label={`${slot.player.name}${slot.position !== "YDK" && slot.position !== "OUT" ? `, ${slot.position}` : ""}. Yer değiştirmek için dokun veya sürükle.`}
        >
          <MiniCard
            player={slot.player}
            rating={slot.rating}
            position={slot.position}
            teamColor={teamColor}
            fit={slot.fit}
            rotatingKeeper={slot.rotatingKeeper}
            selected={selected}
            ghost={isDragging}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onTap(slot.id)}
          className="grid h-[86px] w-[62px] place-items-center rounded-xl border-2 border-dashed border-white/25 font-display text-sm font-bold text-ink-muted"
          aria-label={`Boş ${slot.position} yeri`}
        >
          {slot.position}
        </button>
      )}
    </div>
  );
}

interface HalfPitchProps {
  team: 0 | 1;
  formation: Formation;
  lineupTeam: TeamLineup;
  evaluation: TeamEvaluation;
  players: Map<string, Player>;
  color: string;
  goalAtTop: boolean;
  /** Mobilde iki yarı birleşik tek saha oluşturur. */
  joined: boolean;
  rotatingKeeper: boolean;
  selected: PlaceId | null;
  activeId: PlaceId | null;
  onTap: (id: PlaceId) => void;
  dealKey: string;
  header?: ReactNode;
}

export function HalfPitch({ team, formation, lineupTeam, evaluation, players, color, goalAtTop, joined, rotatingKeeper, selected, activeId, onTap, dealKey }: HalfPitchProps) {
  return (
    <div
      className={`pitch-grass relative w-full overflow-hidden ${joined ? (goalAtTop ? "rounded-t-3xl" : "rounded-b-3xl") : "rounded-3xl"}`}
      style={{ aspectRatio: "1 / 1.02", boxShadow: `inset 0 ${goalAtTop ? 4 : -4}px 0 0 ${color}66` }}
    >
      <PitchMarkings goalAtTop={goalAtTop} joined={joined} />
      {formation.slots.map((slot, i) => {
        const id = lineupTeam.slots[i];
        const player = id ? players.get(id) ?? null : null;
        const top = 8 + (goalAtTop ? slot.y : 100 - slot.y) * 0.84;
        const rot = slot.position === "KL" && rotatingKeeper;
        const view: SlotView = {
          id: placeId(team, "slot", i),
          player,
          rating: Math.round(evaluation.slotRatings[i] ?? 0),
          position: slot.position,
          fit: player && !rot ? positionFit(player, slot.position) : "primary",
          rotatingKeeper: rot,
        };
        return (
          <motion.div
            key={`${dealKey}-${i}`}
            className="absolute z-10"
            initial={{ left: "50%", top: goalAtTop ? "100%" : "0%", opacity: 0, scale: 0.3, rotate: (i % 2 ? 1 : -1) * 25 }}
            animate={{ left: `${slot.x}%`, top: `${top}%`, opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.08 + i * 0.07 + team * 0.035 }}
            style={{ x: "-50%", y: "-50%" }}
          >
            <DraggablePlace slot={view} teamColor={color} selected={selected === view.id} onTap={onTap} activeId={activeId} />
          </motion.div>
        );
      })}
    </div>
  );
}

/** Görsel (PNG) dışa aktarım için animasyonsuz, etkileşimsiz yarı saha. */
export function StaticHalfPitch({
  formation,
  lineupTeam,
  evaluation,
  players,
  color,
  rotatingKeeper,
}: Pick<HalfPitchProps, "formation" | "lineupTeam" | "evaluation" | "players" | "color" | "rotatingKeeper">) {
  return (
    <div className="pitch-grass relative w-full overflow-hidden rounded-3xl" style={{ aspectRatio: "1 / 1.02", boxShadow: `inset 0 -4px 0 0 ${color}66` }}>
      <PitchMarkings goalAtTop={false} joined={false} />
      {formation.slots.map((slot, i) => {
        const id = lineupTeam.slots[i];
        const player = id ? players.get(id) : undefined;
        if (!player) return null;
        const rot = slot.position === "KL" && rotatingKeeper;
        return (
          <div key={i} className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${8 + (100 - slot.y) * 0.84}%` }}>
            <MiniCard
              player={player}
              rating={Math.round(evaluation.slotRatings[i] ?? 0)}
              position={slot.position}
              teamColor={color}
              fit={rot ? "primary" : positionFit(player, slot.position)}
              rotatingKeeper={rot}
            />
          </div>
        );
      })}
    </div>
  );
}
