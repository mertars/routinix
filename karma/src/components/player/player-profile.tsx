"use client";

import { motion } from "framer-motion";
import { Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ATTR_GROUPS,
  FOOT_LABELS,
  GK_ATTR_LABELS,
  MAIN_ATTR_LABELS,
  MAIN_ATTR_SHORT,
  POSITION_COLORS,
  POSITION_LABELS,
  SUB_ATTR_LABELS,
} from "@/lib/constants";
import { allPositionRatings, canKeep, effectiveGoalkeeping, mainAttributes, positionFit, suggestPosition } from "@/lib/scoring";
import { playerStats } from "@/lib/stats";
import { useKarma } from "@/lib/store";
import { GK_ATTRS, MAIN_ATTRS, POSITIONS, type Player, type Position } from "@/lib/types";
import { FormChart } from "../charts/form-chart";
import { RadarChart } from "../charts/radar-chart";
import { Button } from "../ui/button";
import { Toggle } from "../ui/controls";
import { Sheet } from "../ui/sheet";
import { PositionBadge } from "./bits";
import { PlayerCard } from "./player-card";

/** "DEF'te 81, OS'ta 74" gibi cümleler için bulunma eki. */
const LOCATIVE: Record<Position, string> = { KL: "'de", DEF: "'te", OS: "'ta", KNT: "'ta", FV: "'de" };

export function PlayerProfile({ player, onClose, onEdit }: { player: Player | null; onClose: () => void; onEdit: (p: Player) => void }) {
  return (
    <Sheet open={player !== null} onClose={onClose} full title={player?.name ?? ""}>
      {player && <ProfileBody key={player.id} player={player} onEdit={onEdit} />}
    </Sheet>
  );
}

function ProfileBody({ player: initial, onEdit }: { player: Player; onEdit: (p: Player) => void }) {
  // Profil açıkken yapılan değişiklikler (aktiflik, düzenleme) anında yansısın.
  const player = useKarma((s) => s.players.find((p) => p.id === initial.id)) ?? initial;
  const weights = useKarma((s) => s.settings.weights);
  const matches = useKarma((s) => s.matches);
  const toggleActive = useKarma((s) => s.toggleActive);
  const [flipped, setFlipped] = useState(false);

  const ratings = allPositionRatings(player, weights);
  const suggestion = suggestPosition(player, weights);
  const main = mainAttributes(player.attributes);
  const stats = useMemo(() => playerStats(player.id, matches), [player.id, matches]);
  const sorted = [...POSITIONS].sort((a, b) => ratings[b] - ratings[a]);
  const ratingSentence = sorted
    .filter((p) => p !== "KL" || canKeep(player))
    .slice(0, 3)
    .map((p) => `${p}${LOCATIVE[p]} ${ratings[p]}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Çevrilebilir kart */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          className="flip-scene"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Kartın ön yüzünü göster" : "Kartın arka yüzünü göster"}
          aria-pressed={flipped}
        >
          <motion.div
            className="flip-inner"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
          >
            <div className="flip-face">
              <PlayerCard player={player} weights={weights} size="lg" />
            </div>
            <div className="flip-face flip-back">
              <CardBack player={player} ratings={ratings} stats={stats} />
            </div>
          </motion.div>
        </button>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
          <RefreshCw className="size-3.5" aria-hidden="true" /> Kartı çevirmek için dokun
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="surface rounded-2xl px-4">
          <Toggle checked={player.active} onChange={() => toggleActive(player.id)} label={player.active ? "Bu hafta geliyor" : "Bu hafta yok"} />
        </div>
        <Button size="lg" variant="outline" onClick={() => onEdit(player)}>
          <Pencil className="size-4" aria-hidden="true" /> Düzenle
        </Button>
      </div>

      {/* Mevki önerisi */}
      <div className="surface rounded-3xl p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-neon/15 text-neon">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              En uygun mevki: <span className="text-neon">{POSITION_LABELS[suggestion.position]}</span> ({suggestion.rating})
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">{ratingSentence}</p>
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5" aria-label="Mevkilere göre puanlar">
          {sorted.map((p) => {
            const fit = positionFit(player, p);
            const estimated = p === "KL" && !player.goalkeeping;
            return (
              <li key={p} className="flex items-center gap-3">
                <PositionBadge position={p} />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: POSITION_COLORS[p] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${ratings[p]}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <span className="w-8 text-right font-display text-xl font-bold tabular">{ratings[p]}</span>
                <span className="w-16 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {fit === "primary" ? "Ana" : fit === "alt" ? "Alternatif" : estimated ? "Tahmini" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Radar */}
      <div className="surface rounded-3xl p-4">
        <h3 className="font-display text-xl font-bold uppercase tracking-wide">Özellik haritası</h3>
        <p className="text-[13px] text-ink-muted">6 ana özellik (1-99)</p>
        <RadarChart title={`${player.name} özellik haritası`} data={MAIN_ATTRS.map((k) => ({ key: k, label: MAIN_ATTR_SHORT[k], value: main[k] }))} />
      </div>

      {/* İstatistikler */}
      <div className="surface rounded-3xl p-4">
        <h3 className="font-display text-xl font-bold uppercase tracking-wide">İstatistikler</h3>
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ["Maç", stats.played],
            ["G/B/M", `${stats.wins}/${stats.draws}/${stats.losses}`],
            ["Galibiyet", stats.winRate === null ? "–" : `%${stats.winRate}`],
            ["Maçın adamı", stats.mvps],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/4 px-1 py-2.5">
              <dd className="font-display text-2xl font-extrabold">{value}</dd>
              <dt className="text-[11px] text-ink-muted">{label}</dt>
            </div>
          ))}
        </dl>
        <h4 className="mb-3 mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Form · son 5 maç</h4>
        <FormChart form={stats.form} />
      </div>

      {/* Tüm alt özellikler (tablo görünümü) */}
      <details className="surface group rounded-3xl p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center font-display text-xl font-bold uppercase tracking-wide">
          Tüm özellikler
          <span className="ml-auto text-sm font-normal normal-case text-ink-muted group-open:hidden">Göster</span>
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MAIN_ATTRS.map((k) => (
            <table key={k} className="w-full text-sm">
              <caption className="mb-1 text-left font-semibold text-ink">
                {MAIN_ATTR_LABELS[k]} <span className="font-display text-lg font-extrabold">{main[k]}</span>
              </caption>
              <tbody>
                {ATTR_GROUPS[k].map((s) => (
                  <tr key={s} className="border-t border-white/5">
                    <th scope="row" className="py-1.5 text-left font-normal text-ink-soft">
                      {SUB_ATTR_LABELS[s]}
                    </th>
                    <td className="py-1.5 text-right font-display text-base font-bold tabular">{player.attributes[s]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
          {canKeep(player) && (
            <table className="w-full text-sm">
              <caption className="mb-1 text-left font-semibold text-ink">Kalecilik</caption>
              <tbody>
                {GK_ATTRS.map((k) => (
                  <tr key={k} className="border-t border-white/5">
                    <th scope="row" className="py-1.5 text-left font-normal text-ink-soft">
                      {GK_ATTR_LABELS[k]}
                    </th>
                    <td className="py-1.5 text-right font-display text-base font-bold tabular">{effectiveGoalkeeping(player)[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-muted">Tercih ettiği ayak: {FOOT_LABELS[player.foot]}</p>
      </details>
    </div>
  );
}

function CardBack({ player, ratings, stats }: { player: Player; ratings: Record<string, number>; stats: ReturnType<typeof playerStats> }) {
  return (
    <div className="player-card flex h-full w-[248px] flex-col px-5 py-7" data-tier="special" aria-hidden="true">
      <div className="relative z-[2] flex h-full flex-col">
        <div className="text-center font-display text-lg font-bold uppercase tracking-[0.2em]" style={{ color: "var(--card-sub)" }}>
          Mevki puanları
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {POSITIONS.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span className="w-9 font-display text-base font-bold">{p}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full rounded-full" style={{ width: `${ratings[p]}%`, background: POSITION_COLORS[p] }} />
              </span>
              <span className="w-7 text-right font-display text-lg font-extrabold tabular">{ratings[p]}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto grid grid-cols-3 gap-1 text-center">
          {[
            ["Maç", stats.played],
            ["Gal.", stats.winRate === null ? "–" : `%${stats.winRate}`],
            ["MVP", stats.mvps],
          ].map(([l, v]) => (
            <div key={l}>
              <div className="font-display text-2xl font-extrabold">{v}</div>
              <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--card-sub)" }}>
                {l}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-center text-xs" style={{ color: "var(--card-sub)" }}>
          {FOOT_LABELS[player.foot]} ayak · {player.altPositions.length ? `Alt: ${player.altPositions.join(", ")}` : "Tek mevki"}
        </div>
      </div>
    </div>
  );
}
