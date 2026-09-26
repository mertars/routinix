// Kadro yardımcıları: paylaşım metni, maç kaydı oluşturma, yer takası.
// Tamamı saf fonksiyonlar.

import type { Evaluation } from "./balancer";
import { getFormation, POSITION_EMOJI, teamColorEmoji } from "./constants";
import { createId, todayIso } from "./ids";
import { POSITIONS, type Formation, type Lineup, type Match, type MatchFormat, type MatchPlayerSnapshot, type Player, type TeamStyle } from "./types";

/** Kadrodaki bir yerin kimliği: `t0-s3` (slot), `t1-y0` (yedek), `o-2` (oynamayan). */
export type PlaceId = string;

export function placeId(team: 0 | 1 | -1, kind: "slot" | "sub" | "out", index: number): PlaceId {
  if (kind === "out") return `o-${index}`;
  return `t${team}-${kind === "slot" ? "s" : "y"}${index}`;
}

function parsePlace(id: PlaceId): { team: 0 | 1 | -1; kind: "slot" | "sub" | "out"; index: number } | null {
  const out = /^o-(\d+)$/.exec(id);
  if (out) return { team: -1, kind: "out", index: Number(out[1]) };
  const m = /^t([01])-([sy])(\d+)$/.exec(id);
  if (!m) return null;
  return { team: Number(m[1]) as 0 | 1, kind: m[2] === "s" ? "slot" : "sub", index: Number(m[3]) };
}

function getAt(l: Lineup, id: PlaceId): string | null {
  const p = parsePlace(id);
  if (!p) return null;
  if (p.kind === "out") return l.out[p.index] ?? null;
  if (p.kind === "sub") return l.teams[p.team as 0 | 1].subs[p.index] ?? null;
  return l.teams[p.team as 0 | 1].slots[p.index] ?? null;
}

function setAt(l: Lineup, id: PlaceId, value: string | null) {
  const p = parsePlace(id)!;
  if (p.kind === "out") {
    if (value) l.out[p.index] = value;
    else l.out.splice(p.index, 1);
  } else if (p.kind === "sub") {
    const subs = l.teams[p.team as 0 | 1].subs;
    if (value) subs[p.index] = value;
    else subs.splice(p.index, 1);
  } else {
    l.teams[p.team as 0 | 1].slots[p.index] = value;
  }
}

/** İki yerdeki oyuncuları takas eder (biri boşsa taşır). Yeni kadro döner. */
export function swapPlaces(lineup: Lineup, a: PlaceId, b: PlaceId): Lineup {
  if (a === b) return lineup;
  const next: Lineup = structuredClone(lineup);
  const va = getAt(lineup, a);
  const vb = getAt(lineup, b);
  // Liste (yedek/oynamayan) yerlerinden eleman silmek indeksleri kaydırır;
  // önce slotlara yaz, sonra silinecekleri sondan başa uygula.
  const ops: [PlaceId, string | null][] = [
    [a, vb],
    [b, va],
  ];
  ops.sort(([x], [y]) => (parsePlace(y)?.index ?? 0) - (parsePlace(x)?.index ?? 0));
  for (const [id, v] of ops) setAt(next, id, v);
  return next;
}

// ---------------------------------------------------------------------------
// Maç kaydı
// ---------------------------------------------------------------------------

export function lineupToMatch(
  lineup: Lineup,
  evaluation: Evaluation,
  players: Map<string, Player>,
  opts: { format: MatchFormat; rotatingKeeper: boolean; styles: [TeamStyle, TeamStyle]; date?: string },
): Match {
  const teams = ([0, 1] as const).map((t) => {
    const formation = getFormation(lineup.teams[t].formationId, opts.format);
    const ev = evaluation.teams[t];
    const snap: MatchPlayerSnapshot[] = [];
    lineup.teams[t].slots.forEach((id, i) => {
      if (!id) return;
      snap.push({
        playerId: id,
        name: players.get(id)?.name ?? "?",
        position: formation.slots[i].position,
        rating: Math.round(ev.slotRatings[i] ?? 0),
      });
    });
    lineup.teams[t].subs.forEach((id, i) => {
      snap.push({ playerId: id, name: players.get(id)?.name ?? "?", position: "YDK", rating: Math.round(ev.subRatings[i] ?? 0) });
    });
    return {
      ...opts.styles[t],
      formationId: formation.id,
      players: snap,
      total: Math.round(ev.total),
      average: Math.round(ev.average * 10) / 10,
    };
  }) as Match["teams"];
  return {
    id: createId("m"),
    date: opts.date ?? todayIso(),
    format: opts.format,
    rotatingKeeper: opts.rotatingKeeper,
    teams,
    out: [...lineup.out],
    balance: evaluation.balance,
    score: null,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// WhatsApp metni
// ---------------------------------------------------------------------------

export function formatDateTr(iso: string, withWeekday = true): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    ...(withWeekday ? { weekday: "long" } : {}),
  });
}

function playerLabel(p: Player | undefined): string {
  if (!p) return "?";
  return p.nickname ? `${p.name} (${p.nickname})` : p.name;
}

export interface ShareTextInput {
  lineup: Lineup;
  evaluation: Evaluation;
  players: Map<string, Player>;
  styles: [TeamStyle, TeamStyle];
  format: MatchFormat;
  rotatingKeeper: boolean;
  date?: string;
}

/** Kadroyu WhatsApp'a uygun düz metne çevirir (takım, diziliş, mevkiye göre oyuncular). */
export function formatLineupText({ lineup, evaluation, players, styles, format, rotatingKeeper, date }: ShareTextInput): string {
  const lines: string[] = [];
  lines.push(`⚽ *Karma* · ${formatDateTr(date ?? todayIso())} · ${format}v${format}`);
  lines.push(`⚖️ Denge skoru: %${evaluation.balance}`);
  if (rotatingKeeper) lines.push("🧤 Kaleci dönüşümlü");

  ([0, 1] as const).forEach((t) => {
    const team = lineup.teams[t];
    const formation: Formation = getFormation(team.formationId, format);
    const ev = evaluation.teams[t];
    lines.push("");
    lines.push(`${teamColorEmoji(styles[t].color)} *${styles[t].name}* (${formation.name}) · Ort. ${ev.average.toFixed(1)}`);
    for (const pos of POSITIONS) {
      const names = team.slots
        .map((id, i) => (formation.slots[i].position === pos && id ? playerLabel(players.get(id)) : null))
        .filter((x): x is string => x !== null);
      if (!names.length) continue;
      const label = pos === "KL" && rotatingKeeper ? "KL (dönüşümlü)" : pos;
      lines.push(`${POSITION_EMOJI[pos]} ${label}: ${names.join(", ")}`);
    }
    if (team.subs.length) lines.push(`🔁 Dönüşümlü yedek: ${team.subs.map((id) => playerLabel(players.get(id))).join(", ")}`);
  });

  if (lineup.out.length) {
    lines.push("");
    lines.push(`🪑 Bu maç yedek: ${lineup.out.map((id) => playerLabel(players.get(id))).join(", ")}`);
  }
  return lines.join("\n");
}
