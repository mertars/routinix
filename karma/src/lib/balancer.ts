// Takım dengeleme — saf fonksiyonlar.
//
// Yöntem:
//  1. Kaleciler: en iyi 2 kaleci farklı takımların KL slotuna sabitlenir
//     ("kaleci dönüşümlü" açıksa bu adım atlanır).
//  2. Başlangıç: yılan (snake) draft ile takımlar, açgözlü yerleştirme ile
//     mevki slotları doldurulur.
//  3. İyileştirme: rastgele oyuncu takaslarıyla simulated annealing. Farklı
//     tohumlarla birden çok kez çalıştırılır; birbirinden farklı en iyi
//     kadrolar alternatif olarak döndürülür.
//
// Her oyuncunun puanı, atandığı SLOTUN mevkisine göre hesaplanır; mevki dışı
// oynatma puanı doğal olarak düşürür, ayrıca amaç fonksiyonunda küçük bir
// ceza da vardır.

import { LINE_OF } from "./constants";
import { createId, createRng } from "./ids";
import { bestOutfieldRating, mainAttributes, positionRating } from "./scoring";
import {
  MAIN_ATTRS,
  POSITIONS,
  type Constraint,
  type ExtraMode,
  type Formation,
  type Lineup,
  type MainAttr,
  type Player,
  type Position,
  type Weights,
} from "./types";

export type Line = "KL" | "DEF" | "OS" | "FV";
const LINES: Line[] = ["KL", "DEF", "OS", "FV"];

export interface BalanceInput {
  players: Player[];
  formations: [Formation, Formation];
  extraMode: ExtraMode;
  rotatingKeeper: boolean;
  constraints: Constraint[];
  weights: Weights;
}

export interface BalanceOptions {
  seed?: number;
  /** Döndürülecek alternatif kadro sayısı. */
  alternatives?: number;
  /** Bağımsız arama sayısı. */
  restarts?: number;
  /** Arama başına takas denemesi. */
  iterations?: number;
  /** Daha önce gösterilmiş kadro anahtarları ("Tekrar karıştır" için). */
  exclude?: Set<string>;
}

export interface TeamEvaluation {
  /** Karşılaştırmada kullanılan etkin güç (dönüşümlü yedekler dahil). */
  strength: number;
  /** Sahadaki oyuncuların (slot puanlarıyla) toplamı. */
  total: number;
  /** Oyuncu başına ortalama puan. */
  average: number;
  /** Dış saha oyuncularının 6 ana özellik ortalaması. */
  attrs: Record<MainAttr, number>;
  /** Hat başına ortalama slot puanı. */
  lines: Partial<Record<Line, number>>;
  /** Slot sırasına göre oyuncuların o slottaki puanı (boş slot: null). */
  slotRatings: (number | null)[];
  subRatings: number[];
  /** Ana/alternatif mevkisi dışında oynayan oyuncu sayısı. */
  offPosition: number;
}

export interface Evaluation {
  cost: number;
  /** 0-100 denge skoru. */
  balance: number;
  teams: [TeamEvaluation, TeamEvaluation];
  totalDiff: number;
  lineDiff: number;
  attrDiff: number;
  positionPenalty: number;
  /** İhlal edilen kısıtların id'leri. */
  violations: string[];
}

export interface BalanceResult {
  lineups: Lineup[];
  evaluations: Evaluation[];
  warnings: string[];
  /** Kaleye yerleştirilen oyuncular (dönüşümlü değilse). */
  keepers: string[];
}

export class BalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalanceError";
  }
}

// Amaç fonksiyonu ağırlıkları
export const COST_WEIGHTS = {
  total: 3,
  line: 0.8,
  attr: 0.5,
  position: 1,
  constraint: 500,
} as const;

const ALT_PENALTY = 2.5;
const OFF_PENALTY = 10;
const OFF_DROP_FACTOR = 0.4;

// ---------------------------------------------------------------------------
// Hazırlık
// ---------------------------------------------------------------------------

type PlaceKind = "slot" | "sub" | "out";

interface Place {
  team: 0 | 1 | -1;
  kind: PlaceKind;
  slotIndex: number;
  position: Position | null;
}

interface Prepared {
  players: Player[];
  places: Place[];
  /** Takaslara açık yer indeksleri. */
  movable: number[];
  /** Kaleci slotları (dönüşümlü değilse; yalnızca kendi aralarında takas edilir). */
  keeperPlaces: number[];
  /** ratings[i * 5 + posIndex] */
  ratings: Float64Array;
  best: Float64Array;
  main: Float64Array; // i * 6 + attrIndex
  primary: Position[];
  alt: Set<Position>[];
  rotatingKeeper: boolean;
  teamSize: [number, number];
  constraints: { c: Constraint; a: number; b: number; pos?: Position }[];
}

const POS_INDEX: Record<Position, number> = { KL: 0, DEF: 1, OS: 2, KNT: 3, FV: 4 };

function prepare(
  players: Player[],
  formations: [Formation, Formation],
  subCounts: [number, number],
  outCount: number,
  rotatingKeeper: boolean,
  constraints: Constraint[],
  weights: Weights,
): Prepared {
  const places: Place[] = [];
  for (const t of [0, 1] as const) {
    formations[t].slots.forEach((s, slotIndex) => places.push({ team: t, kind: "slot", slotIndex, position: s.position }));
  }
  for (const t of [0, 1] as const) {
    for (let k = 0; k < subCounts[t]; k++) places.push({ team: t, kind: "sub", slotIndex: k, position: null });
  }
  for (let k = 0; k < outCount; k++) places.push({ team: -1, kind: "out", slotIndex: k, position: null });

  const n = players.length;
  const ratings = new Float64Array(n * 5);
  const best = new Float64Array(n);
  const main = new Float64Array(n * 6);
  players.forEach((p, i) => {
    for (const pos of POSITIONS) ratings[i * 5 + POS_INDEX[pos]] = positionRating(p, pos, weights);
    best[i] = bestOutfieldRating(p, weights);
    const m = mainAttributes(p.attributes);
    MAIN_ATTRS.forEach((k, j) => (main[i * 6 + j] = m[k]));
  });

  const keeperPlaces = rotatingKeeper ? [] : places.map((p, i) => (p.position === "KL" ? i : -1)).filter((i) => i >= 0);
  const movable = places.map((_, i) => i).filter((i) => !keeperPlaces.includes(i));
  const index = new Map(players.map((p, i) => [p.id, i]));
  const prepared: Prepared["constraints"] = [];
  for (const c of constraints) {
    if (c.type === "position") {
      const a = index.get(c.playerId);
      if (a !== undefined) prepared.push({ c, a, b: -1, pos: c.position });
    } else {
      const a = index.get(c.a);
      const b = index.get(c.b);
      if (a !== undefined && b !== undefined) prepared.push({ c, a, b });
    }
  }

  return {
    players,
    places,
    movable,
    keeperPlaces,
    ratings,
    best,
    main,
    primary: players.map((p) => p.primaryPosition),
    alt: players.map((p) => new Set(p.altPositions)),
    rotatingKeeper,
    teamSize: [formations[0].slots.length, formations[1].slots.length],
    constraints: prepared,
  };
}

// ---------------------------------------------------------------------------
// Değerlendirme
// ---------------------------------------------------------------------------

function placeRating(ctx: Prepared, place: Place, i: number): number {
  if (place.kind !== "slot" || place.position === null) return ctx.best[i];
  if (place.position === "KL" && ctx.rotatingKeeper) return ctx.best[i];
  return ctx.ratings[i * 5 + POS_INDEX[place.position]];
}

/** Denge skoru (0-100): toplam, özellik ve hat farklarının göreli bileşimi. */
export function balanceScore(e: Pick<Evaluation, "totalDiff" | "attrDiff" | "lineDiff" | "teams">, lineCount: number): number {
  const avg = (e.teams[0].strength + e.teams[1].strength) / 2 || 1;
  const rt = e.totalDiff / avg;
  const ra = e.attrDiff / 6 / 70;
  const rl = lineCount ? e.lineDiff / lineCount / 70 : 0;
  const raw = 0.6 * rt * 4 + 0.25 * ra * 3 + 0.15 * rl * 3;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - raw))));
}

function evaluate(ctx: Prepared, assign: Int32Array): Evaluation {
  const where = new Int32Array(ctx.players.length).fill(-1);
  for (let p = 0; p < assign.length; p++) if (assign[p] >= 0) where[assign[p]] = p;

  const teams = [0, 1].map((t) => {
    const size = ctx.teamSize[t];
    return {
      slotRatings: new Array<number | null>(size).fill(null),
      subRatings: [] as number[],
      total: 0,
      attrSum: new Float64Array(6),
      attrCount: 0,
      lineSum: { KL: 0, DEF: 0, OS: 0, FV: 0 } as Record<Line, number>,
      lineCount: { KL: 0, DEF: 0, OS: 0, FV: 0 } as Record<Line, number>,
      offPosition: 0,
      filled: 0,
    };
  });

  let positionPenalty = 0;
  for (let p = 0; p < ctx.places.length; p++) {
    const i = assign[p];
    const place = ctx.places[p];
    if (i < 0 || place.team < 0) continue;
    const team = teams[place.team];
    const r = placeRating(ctx, place, i);
    const isRealKeeper = place.position === "KL" && !ctx.rotatingKeeper;
    if (place.kind === "slot") {
      team.slotRatings[place.slotIndex] = r;
      team.total += r;
      team.filled += 1;
      if (!(place.position === "KL" && ctx.rotatingKeeper)) {
        const line = LINE_OF[place.position!];
        team.lineSum[line] += r;
        team.lineCount[line] += 1;
        const pos = place.position!;
        if (ctx.primary[i] !== pos) {
          if (ctx.alt[i].has(pos)) {
            positionPenalty += ALT_PENALTY;
          } else {
            team.offPosition += 1;
            const primaryRating = ctx.ratings[i * 5 + POS_INDEX[ctx.primary[i]]];
            positionPenalty += OFF_PENALTY + OFF_DROP_FACTOR * Math.max(0, primaryRating - r);
          }
        }
      }
    } else {
      team.subRatings.push(r);
    }
    if (!isRealKeeper) {
      for (let k = 0; k < 6; k++) team.attrSum[k] += ctx.main[i * 6 + k];
      team.attrCount += 1;
    }
  }

  const evals = teams.map((t, idx) => {
    const size = ctx.teamSize[idx];
    const subSum = t.subRatings.reduce((s, v) => s + v, 0);
    const people = t.filled + t.subRatings.length;
    const strength = t.subRatings.length ? ((t.total + subSum) / people) * size : t.total;
    const attrs = {} as Record<MainAttr, number>;
    MAIN_ATTRS.forEach((k, j) => (attrs[k] = t.attrCount ? t.attrSum[j] / t.attrCount : 0));
    const lines: Partial<Record<Line, number>> = {};
    for (const l of LINES) if (t.lineCount[l]) lines[l] = t.lineSum[l] / t.lineCount[l];
    return {
      strength,
      total: t.total,
      average: people ? (t.total + subSum) / people : 0,
      attrs,
      lines,
      slotRatings: t.slotRatings,
      subRatings: t.subRatings,
      offPosition: t.offPosition,
    } satisfies TeamEvaluation;
  }) as [TeamEvaluation, TeamEvaluation];

  const totalDiff = Math.abs(evals[0].strength - evals[1].strength);
  let lineDiff = 0;
  let lineCount = 0;
  for (const l of LINES) {
    const a = evals[0].lines[l];
    const b = evals[1].lines[l];
    if (a !== undefined && b !== undefined) {
      lineDiff += Math.abs(a - b);
      lineCount += 1;
    }
  }
  let attrDiff = 0;
  for (const k of MAIN_ATTRS) attrDiff += Math.abs(evals[0].attrs[k] - evals[1].attrs[k]);

  const violations: string[] = [];
  const teamOf = (i: number) => (where[i] < 0 ? -2 : ctx.places[where[i]].team);
  for (const pc of ctx.constraints) {
    if (pc.c.type === "together") {
      const ta = teamOf(pc.a);
      if (ta < 0 || ta !== teamOf(pc.b)) violations.push(pc.c.id);
    } else if (pc.c.type === "apart") {
      const ta = teamOf(pc.a);
      if (ta >= 0 && ta === teamOf(pc.b)) violations.push(pc.c.id);
    } else {
      const place = where[pc.a] >= 0 ? ctx.places[where[pc.a]] : null;
      if (!place || place.kind !== "slot" || place.position !== pc.pos) violations.push(pc.c.id);
    }
  }

  const cost =
    COST_WEIGHTS.total * totalDiff +
    COST_WEIGHTS.line * lineDiff +
    COST_WEIGHTS.attr * attrDiff +
    COST_WEIGHTS.position * positionPenalty +
    COST_WEIGHTS.constraint * violations.length;

  const partial = { totalDiff, attrDiff, lineDiff, teams: evals };
  return {
    cost,
    balance: balanceScore(partial, lineCount),
    teams: evals,
    totalDiff,
    lineDiff,
    attrDiff,
    positionPenalty,
    violations,
  };
}

/**
 * `evaluate(...).cost` ile birebir aynı sonucu veren, bellek ayırmayan hızlı
 * maliyet fonksiyonu. Arama döngüsünde saniyede on binlerce kez çağrılır.
 */
function makeCostFn(ctx: Prepared): (assign: Int32Array) => number {
  const nPlaces = ctx.places.length;
  const placeTeam = Int8Array.from(ctx.places, (p) => p.team);
  const placeKind = Int8Array.from(ctx.places, (p) => (p.kind === "slot" ? 0 : p.kind === "sub" ? 1 : 2));
  const rotKL = ctx.places.map((p) => p.kind === "slot" && p.position === "KL" && ctx.rotatingKeeper);
  const realKL = ctx.places.map((p) => p.kind === "slot" && p.position === "KL" && !ctx.rotatingKeeper);
  const placePos = Int8Array.from(ctx.places, (p) => (p.position ? POS_INDEX[p.position] : -1));
  const lineIdx: Record<Line, number> = { KL: 0, DEF: 1, OS: 2, FV: 3 };
  const placeLine = Int8Array.from(ctx.places, (p) => (p.position ? lineIdx[LINE_OF[p.position]] : -1));
  const primaryIdx = Int8Array.from(ctx.primary, (p) => POS_INDEX[p]);
  const altMask = Int8Array.from(ctx.alt, (set) => [...set].reduce((m, p) => m | (1 << POS_INDEX[p]), 0));
  const size = ctx.teamSize;

  const where = new Int32Array(ctx.players.length);
  const total = new Float64Array(2);
  const subSum = new Float64Array(2);
  const subCnt = new Int32Array(2);
  const filled = new Int32Array(2);
  const attrSum = new Float64Array(12);
  const attrCnt = new Int32Array(2);
  const lineSum = new Float64Array(8);
  const lineCnt = new Int32Array(8);
  const strength = new Float64Array(2);

  return (assign) => {
    where.fill(-1);
    total.fill(0);
    subSum.fill(0);
    subCnt.fill(0);
    filled.fill(0);
    attrSum.fill(0);
    attrCnt.fill(0);
    lineSum.fill(0);
    lineCnt.fill(0);
    let positionPenalty = 0;

    for (let p = 0; p < nPlaces; p++) {
      const i = assign[p];
      if (i < 0) continue;
      where[i] = p;
      const t = placeTeam[p];
      if (t < 0) continue;
      const kind = placeKind[p];
      const pos = placePos[p];
      const r = kind !== 0 || rotKL[p] ? ctx.best[i] : ctx.ratings[i * 5 + pos];
      if (kind === 0) {
        total[t] += r;
        filled[t] += 1;
        if (!rotKL[p]) {
          const l = t * 4 + placeLine[p];
          lineSum[l] += r;
          lineCnt[l] += 1;
          if (primaryIdx[i] !== pos) {
            if (altMask[i] & (1 << pos)) positionPenalty += ALT_PENALTY;
            else {
              const pr = ctx.ratings[i * 5 + primaryIdx[i]];
              positionPenalty += OFF_PENALTY + OFF_DROP_FACTOR * (pr > r ? pr - r : 0);
            }
          }
        }
      } else {
        subSum[t] += r;
        subCnt[t] += 1;
      }
      if (!realKL[p]) {
        const base = i * 6;
        const tb = t * 6;
        for (let k = 0; k < 6; k++) attrSum[tb + k] += ctx.main[base + k];
        attrCnt[t] += 1;
      }
    }

    for (let t = 0; t < 2; t++) {
      strength[t] = subCnt[t] ? ((total[t] + subSum[t]) / (filled[t] + subCnt[t])) * size[t] : total[t];
    }
    const totalDiff = Math.abs(strength[0] - strength[1]);
    let lineDiff = 0;
    for (let l = 0; l < 4; l++) {
      if (lineCnt[l] && lineCnt[4 + l]) lineDiff += Math.abs(lineSum[l] / lineCnt[l] - lineSum[4 + l] / lineCnt[4 + l]);
    }
    let attrDiff = 0;
    for (let k = 0; k < 6; k++) {
      const a = attrCnt[0] ? attrSum[k] / attrCnt[0] : 0;
      const b = attrCnt[1] ? attrSum[6 + k] / attrCnt[1] : 0;
      attrDiff += Math.abs(a - b);
    }

    let violations = 0;
    for (const pc of ctx.constraints) {
      const pa = where[pc.a];
      if (pc.c.type === "together") {
        const ta = pa < 0 ? -2 : placeTeam[pa];
        const pb = where[pc.b];
        const tb = pb < 0 ? -2 : placeTeam[pb];
        if (ta < 0 || ta !== tb) violations++;
      } else if (pc.c.type === "apart") {
        const ta = pa < 0 ? -2 : placeTeam[pa];
        const pb = where[pc.b];
        const tb = pb < 0 ? -2 : placeTeam[pb];
        if (ta >= 0 && ta === tb) violations++;
      } else if (pa < 0 || placeKind[pa] !== 0 || placePos[pa] !== POS_INDEX[pc.pos!]) {
        violations++;
      }
    }

    return (
      COST_WEIGHTS.total * totalDiff +
      COST_WEIGHTS.line * lineDiff +
      COST_WEIGHTS.attr * attrDiff +
      COST_WEIGHTS.position * positionPenalty +
      COST_WEIGHTS.constraint * violations
    );
  };
}

// ---------------------------------------------------------------------------
// Kaleci seçimi ve başlangıç çözümü
// ---------------------------------------------------------------------------

/** Kaleye geçecek oyuncuların öncelik sırası (indeks listesi). */
function keeperOrder(ctx: Prepared): number[] {
  const forcedKL = new Set(ctx.constraints.filter((c) => c.pos === "KL").map((c) => c.a));
  const kl = (i: number) => ctx.ratings[i * 5 + POS_INDEX.KL];
  const tier = (i: number) => (forcedKL.has(i) ? 0 : ctx.primary[i] === "KL" ? 1 : ctx.alt[i].has("KL") ? 2 : 3);
  return ctx.players.map((_, i) => i).sort((a, b) => tier(a) - tier(b) || kl(b) - kl(a));
}

function draftValue(ctx: Prepared, i: number): number {
  const primary = ctx.primary[i];
  return primary === "KL" ? ctx.best[i] : ctx.ratings[i * 5 + POS_INDEX[primary]];
}

function initialAssignment(ctx: Prepared, rng: () => number, noise: number): Int32Array {
  const assign = new Int32Array(ctx.places.length).fill(-1);
  const used = new Set<number>();

  // 1) Kaleciler
  if (ctx.keeperPlaces.length) {
    const order = keeperOrder(ctx).slice(0, ctx.keeperPlaces.length);
    // Daha iyi kaleci rastgele bir takıma
    const swap = rng() < 0.5;
    order.forEach((i, k) => {
      const place = ctx.keeperPlaces[swap ? ctx.keeperPlaces.length - 1 - k : k];
      assign[place] = i;
      used.add(i);
    });
  }

  // 2) Yılan draft: kalan oyuncular değerlerine (+ küçük gürültü) göre sıralanır
  const pool = ctx.players
    .map((_, i) => i)
    .filter((i) => !used.has(i))
    .map((i) => ({ i, v: draftValue(ctx, i) + (rng() - 0.5) * 2 * noise }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.i);

  const capacity: [number, number] = [0, 0];
  const teamPlaces: [number[], number[]] = [[], []];
  const outPlaces: number[] = [];
  ctx.movable.forEach((p) => {
    const place = ctx.places[p];
    if (place.team === -1) outPlaces.push(p);
    else {
      teamPlaces[place.team].push(p);
      capacity[place.team] += 1;
    }
  });

  // Kalecisi daha zayıf olan takım önce seçer
  let turn: 0 | 1 = 0;
  if (ctx.keeperPlaces.length === 2) {
    const k = ctx.keeperPlaces.map((p) => ctx.ratings[assign[p] * 5 + POS_INDEX.KL]);
    turn = ctx.places[ctx.keeperPlaces[0]].team === 0 ? (k[0] >= k[1] ? 1 : 0) : k[0] >= k[1] ? 0 : 1;
  }
  const members: [number[], number[]] = [[], []];
  const leftovers: number[] = [];
  let picksInTurn = 1; // yılan: A, BB, AA, BB...
  for (const i of pool) {
    if (members[turn].length >= capacity[turn]) {
      const other = (1 - turn) as 0 | 1;
      if (members[other].length < capacity[other]) members[other].push(i);
      else leftovers.push(i);
      continue;
    }
    members[turn].push(i);
    picksInTurn -= 1;
    if (picksInTurn === 0) {
      turn = (1 - turn) as 0 | 1;
      picksInTurn = 2;
    }
  }
  leftovers.forEach((i, k) => (assign[outPlaces[k]] = i));

  // 3) Takım içinde açgözlü yerleştirme: nadir mevkiler önce
  for (const t of [0, 1] as const) {
    const slots = teamPlaces[t].filter((p) => ctx.places[p].kind === "slot");
    const subs = teamPlaces[t].filter((p) => ctx.places[p].kind === "sub");
    const remaining = new Set(members[t]);
    const fit = (i: number, pos: Position) => {
      const r = ctx.rotatingKeeper && pos === "KL" ? ctx.best[i] : ctx.ratings[i * 5 + POS_INDEX[pos]];
      const bonus = ctx.primary[i] === pos ? 6 : ctx.alt[i].has(pos) ? 3 : 0;
      return r + bonus;
    };
    for (const p of slots) {
      const pos = ctx.places[p].position!;
      let bestI = -1;
      let bestV = -Infinity;
      for (const i of remaining) {
        const v = fit(i, pos);
        if (v > bestV) {
          bestV = v;
          bestI = i;
        }
      }
      if (bestI >= 0) {
        assign[p] = bestI;
        remaining.delete(bestI);
      }
    }
    [...remaining].forEach((i, k) => (assign[subs[k]] = i));
  }
  return assign;
}

// ---------------------------------------------------------------------------
// Arama
// ---------------------------------------------------------------------------

function partitionKey(ctx: Prepared, assign: Int32Array): string {
  const groups: [string[], string[], string[]] = [[], [], []];
  for (let p = 0; p < assign.length; p++) {
    if (assign[p] < 0) continue;
    const t = ctx.places[p].team;
    groups[t === -1 ? 2 : t].push(ctx.players[assign[p]].id);
  }
  const [a, b, out] = groups.map((g) => g.sort().join(","));
  return [a, b].sort().join("|") + "|" + out;
}

/** Kadronun takım bileşimine göre anahtarı (A/B etiketinden bağımsız). */
export function lineupKey(lineup: Lineup): string {
  const team = (t: 0 | 1) => [...lineup.teams[t].slots.filter((x): x is string => !!x), ...lineup.teams[t].subs].sort().join(",");
  return [team(0), team(1)].sort().join("|") + "|" + [...lineup.out].sort().join(",");
}

function isNoopSwap(ctx: Prepared, a: number, b: number): boolean {
  const pa = ctx.places[a];
  const pb = ctx.places[b];
  if (pa.kind === "out" && pb.kind === "out") return true;
  if (pa.kind === "sub" && pb.kind === "sub" && pa.team === pb.team) return true;
  return false;
}

function anneal(
  ctx: Prepared,
  costOf: (assign: Int32Array) => number,
  start: Int32Array,
  rng: () => number,
  iterations: number,
): { assign: Int32Array; cost: number } {
  const current = start.slice();
  let currentCost = costOf(current);
  let best = current.slice();
  let bestCost = currentCost;
  const movable = ctx.movable;
  const keepers = ctx.keeperPlaces;
  if (movable.length < 2) return { assign: best, cost: bestCost };

  const t0 = 6;
  const t1 = 0.03;
  const alpha = Math.pow(t1 / t0, 1 / Math.max(1, iterations));
  let temp = t0;

  for (let it = 0; it < iterations; it++, temp *= alpha) {
    let a: number;
    let b: number;
    if (keepers.length === 2 && rng() < 0.04) {
      a = keepers[0];
      b = keepers[1];
    } else {
      a = movable[Math.floor(rng() * movable.length)];
      b = movable[Math.floor(rng() * movable.length)];
      if (a === b || isNoopSwap(ctx, a, b)) continue;
    }
    const tmp = current[a];
    current[a] = current[b];
    current[b] = tmp;
    const cost = costOf(current);
    const delta = cost - currentCost;
    if (delta <= 0 || rng() < Math.exp(-delta / temp)) {
      currentCost = cost;
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = current.slice();
      }
    } else {
      current[b] = current[a];
      current[a] = tmp;
    }
  }

  // Son rötuş: tüm ikili takasları dene (yerel optimum garantisi)
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 20) {
    improved = false;
    for (let x = 0; x < movable.length; x++) {
      for (let y = x + 1; y < movable.length; y++) {
        const a = movable[x];
        const b = movable[y];
        if (isNoopSwap(ctx, a, b)) continue;
        const tmp = best[a];
        best[a] = best[b];
        best[b] = tmp;
        const cost = costOf(best);
        if (cost < bestCost - 1e-9) {
          bestCost = cost;
          improved = true;
        } else {
          best[b] = best[a];
          best[a] = tmp;
        }
      }
    }
  }
  return { assign: best, cost: bestCost };
}

function toLineup(ctx: Prepared, assign: Int32Array, formations: [Formation, Formation]): Lineup {
  const lineup: Lineup = {
    id: createId("l"),
    teams: [
      { formationId: formations[0].id, slots: new Array(formations[0].slots.length).fill(null), subs: [] },
      { formationId: formations[1].id, slots: new Array(formations[1].slots.length).fill(null), subs: [] },
    ],
    out: [],
  };
  ctx.places.forEach((place, p) => {
    const i = assign[p];
    if (i < 0) return;
    const id = ctx.players[i].id;
    if (place.kind === "out") lineup.out.push(id);
    else if (place.kind === "sub") lineup.teams[place.team as 0 | 1].subs.push(id);
    else lineup.teams[place.team as 0 | 1].slots[place.slotIndex] = id;
  });
  return lineup;
}

/** Format için gereken oyuncu sayısı ve fazlalık durumu. */
export function rosterStatus(playerCount: number, formations: [Formation, Formation]) {
  const needed = formations[0].slots.length + formations[1].slots.length;
  return { needed, extra: Math.max(0, playerCount - needed), missing: Math.max(0, needed - playerCount) };
}

function extraPlaces(extra: number, mode: ExtraMode): { subs: [number, number]; out: number } {
  if (mode === "bench") return { subs: [0, 0], out: extra };
  return { subs: [Math.ceil(extra / 2), Math.floor(extra / 2)], out: 0 };
}

export function balanceTeams(input: BalanceInput, options: BalanceOptions = {}): BalanceResult {
  const { players, formations, extraMode, rotatingKeeper, constraints, weights } = input;
  const alternatives = options.alternatives ?? 3;
  const restarts = options.restarts ?? 24;
  const iterations = options.iterations ?? 3500;
  const rng = createRng(options.seed ?? 1);

  const { missing, extra } = rosterStatus(players.length, formations);
  if (missing > 0) {
    throw new BalanceError(`Bu format için ${missing} oyuncu daha gerekli.`);
  }
  const { subs, out } = extraPlaces(extra, extraMode);
  const ctx = prepare(players, formations, subs, out, rotatingKeeper, constraints, weights);

  const costOf = makeCostFn(ctx);
  const pool = new Map<string, { assign: Int32Array; cost: number }>();
  for (let r = 0; r < restarts; r++) {
    const start = initialAssignment(ctx, rng, r === 0 ? 0 : 4 + r * 0.5);
    const result = anneal(ctx, costOf, start, rng, iterations);
    const key = partitionKey(ctx, result.assign);
    const existing = pool.get(key);
    if (!existing || result.cost < existing.cost) pool.set(key, result);
  }

  let ranked = [...pool.entries()].sort((a, b) => a[1].cost - b[1].cost);
  if (options.exclude?.size) {
    const fresh = ranked.filter(([k]) => !options.exclude!.has(k));
    if (fresh.length) ranked = fresh;
  }
  const chosen = ranked.slice(0, alternatives);
  const lineups = chosen.map(([, v]) => toLineup(ctx, v.assign, formations));
  const evaluations = chosen.map(([, v]) => evaluate(ctx, v.assign));

  const warnings: string[] = [];
  const keepers: string[] = [];
  if (!rotatingKeeper && lineups[0]) {
    for (const t of [0, 1] as const) {
      const idx = formations[t].slots.findIndex((s) => s.position === "KL");
      const id = lineups[0].teams[t].slots[idx];
      if (id) keepers.push(id);
    }
    const nonKeepers = keepers
      .map((id) => players.find((p) => p.id === id)!)
      .filter((p) => p.primaryPosition !== "KL" && !p.altPositions.includes("KL"));
    if (nonKeepers.length) {
      warnings.push(`Yeterli kaleci yok: ${nonKeepers.map((p) => p.name).join(" ve ")} KL puanı en yüksek olduğu için kaleye geçti.`);
    }
  }
  if (evaluations[0]?.violations.length) {
    warnings.push("Bazı kurallar bu oyuncu listesi ve dizilişle aynı anda karşılanamadı.");
  }
  return { lineups, evaluations, warnings, keepers };
}

/** Yalnızca testler için: hızlı maliyet ile ayrıntılı değerlendirmenin tutarlılığı. */
export const __testing = { prepare, evaluate, makeCostFn, initialAssignment };

/** Elle düzenlenmiş bir kadroyu (sürükle-bırak sonrası) yeniden değerlendirir. */
export function evaluateLineup(lineup: Lineup, input: Omit<BalanceInput, "extraMode">): Evaluation {
  const byId = new Map(input.players.map((p) => [p.id, p]));
  const ids = [
    ...lineup.teams[0].slots,
    ...lineup.teams[1].slots,
    ...lineup.teams[0].subs,
    ...lineup.teams[1].subs,
    ...lineup.out,
  ];
  const players: Player[] = [];
  const indexOf = new Map<string, number>();
  for (const id of ids) {
    if (!id || indexOf.has(id)) continue;
    const p = byId.get(id);
    if (!p) continue;
    indexOf.set(id, players.length);
    players.push(p);
  }
  const ctx = prepare(
    players,
    input.formations,
    [lineup.teams[0].subs.length, lineup.teams[1].subs.length],
    lineup.out.length,
    input.rotatingKeeper,
    input.constraints,
    input.weights,
  );
  const assign = new Int32Array(ctx.places.length).fill(-1);
  ids.forEach((id, p) => {
    if (id && indexOf.has(id)) assign[p] = indexOf.get(id)!;
  });
  return evaluate(ctx, assign);
}
