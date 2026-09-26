// Puanlama — tamamı saf fonksiyonlar (yan etkisiz, test edilebilir).

import { ATTR_GROUPS, DEFAULT_WEIGHTS } from "./constants";
import {
  GK_ATTRS,
  MAIN_ATTRS,
  OUTFIELD_POSITIONS,
  POSITIONS,
  SUB_ATTRS,
  type GkAttributes,
  type MainAttr,
  type MainAttributes,
  type Player,
  type Position,
  type SubAttributes,
  type Weights,
} from "./types";

export const ATTR_MIN = 1;
export const ATTR_MAX = 99;

export function clampAttr(value: number): number {
  if (!Number.isFinite(value)) return ATTR_MIN;
  return Math.min(ATTR_MAX, Math.max(ATTR_MIN, Math.round(value)));
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Ana özellik = alt özelliklerin (yuvarlanmış) ortalaması. */
export function mainAttributes(attrs: SubAttributes): MainAttributes {
  const out = {} as MainAttributes;
  for (const key of MAIN_ATTRS) {
    out[key] = Math.round(avg(ATTR_GROUPS[key].map((s) => attrs[s])));
  }
  return out;
}

/** Hızlı giriş: 6 ana özellikten alt özellikleri doldur (her alt özellik = ana değer). */
export function subAttributesFromMain(main: MainAttributes): SubAttributes {
  const out = {} as SubAttributes;
  for (const key of MAIN_ATTRS) {
    for (const sub of ATTR_GROUPS[key]) out[sub] = clampAttr(main[key]);
  }
  return out;
}

/** Tüm kalecilik alt özelliklerini tek değerle doldur (hızlı mod). */
export function goalkeepingFromValue(value: number): GkAttributes {
  const v = clampAttr(value);
  return { ucus: v, topTutma: v, refleks: v, pozisyonAlma: v, oyunKurma: v };
}

/**
 * Kalecilik verisi olmayan (kaleye hiç geçmeyen) oyuncular için mütevazı bir
 * tahmin: çeviklik, top kontrolü ve pas gibi ilgili dış saha özelliklerinden
 * türetilir, gerçek kalecilerin gerisinde kalacak şekilde sınırlandırılır.
 */
export function estimateGoalkeeping(attrs: SubAttributes): GkAttributes {
  const cap = (v: number) => clampAttr(Math.min(55, v));
  return {
    ucus: cap(attrs.ceviklik * 0.45 + 10),
    topTutma: cap(attrs.topKontrolu * 0.4 + 10),
    refleks: cap(attrs.ceviklik * 0.5 + 8),
    pozisyonAlma: cap(((attrs.markaj + attrs.pasArasi) / 2) * 0.45 + 10),
    oyunKurma: cap(attrs.kisaPas * 0.55 + 6),
  };
}

export function effectiveGoalkeeping(player: Pick<Player, "attributes" | "goalkeeping">): GkAttributes {
  return player.goalkeeping ?? estimateGoalkeeping(player.attributes);
}

/** Oyuncu kaleye geçebilir mi (ana veya alternatif mevkisi KL)? */
export function canKeep(player: Pick<Player, "primaryPosition" | "altPositions">): boolean {
  return player.primaryPosition === "KL" || player.altPositions.includes("KL");
}

/** Ham (yuvarlanmamış) kalecilik puanı: ağırlıklı kalecilik + PAS etkisi. */
export function goalkeeperScore(gk: GkAttributes, pas: number, weights: Weights = DEFAULT_WEIGHTS): number {
  const total = GK_ATTRS.reduce((s, k) => s + weights.KL[k], 0) || 1;
  const gkPart = GK_ATTRS.reduce((s, k) => s + gk[k] * weights.KL[k], 0) / total;
  const share = Math.min(100, Math.max(0, weights.klPassShare)) / 100;
  return gkPart * (1 - share) + pas * share;
}

/** Ham (yuvarlanmamış) dış saha puanı: ana özelliklerin ağırlıklı ortalaması. */
export function outfieldScore(main: MainAttributes, weights: Record<MainAttr, number>): number {
  const total = MAIN_ATTRS.reduce((s, k) => s + weights[k], 0) || 1;
  return MAIN_ATTRS.reduce((s, k) => s + main[k] * weights[k], 0) / total;
}

type RatablePlayer = Pick<Player, "attributes" | "goalkeeping">;

/** Oyuncunun verilen mevkideki genel puanı (1-99). */
export function positionRating(player: RatablePlayer, position: Position, weights: Weights = DEFAULT_WEIGHTS): number {
  const main = mainAttributes(player.attributes);
  if (position === "KL") {
    return clampAttr(goalkeeperScore(effectiveGoalkeeping(player), main.pas, weights));
  }
  return clampAttr(outfieldScore(main, weights[position]));
}

export type PositionRatings = Record<Position, number>;

export function allPositionRatings(player: RatablePlayer, weights: Weights = DEFAULT_WEIGHTS): PositionRatings {
  const out = {} as PositionRatings;
  for (const p of POSITIONS) out[p] = positionRating(player, p, weights);
  return out;
}

/** Oyuncunun kartta görünen genel puanı = ana mevkisindeki puan. */
export function overallRating(player: RatablePlayer & Pick<Player, "primaryPosition">, weights: Weights = DEFAULT_WEIGHTS): number {
  return positionRating(player, player.primaryPosition, weights);
}

/** En yüksek dış saha puanı (dönüşümlü kalecilikte ve yedeklerde kullanılır). */
export function bestOutfieldRating(player: RatablePlayer, weights: Weights = DEFAULT_WEIGHTS): number {
  return Math.max(...OUTFIELD_POSITIONS.map((p) => positionRating(player, p, weights)));
}

/**
 * Oyuncuya en uygun mevki önerisi. Kalecilik verisi olmayan oyuncular için KL
 * önerilmez (puan zaten yalnızca tahmin).
 */
export function suggestPosition(player: RatablePlayer & Pick<Player, "primaryPosition" | "altPositions">, weights: Weights = DEFAULT_WEIGHTS): { position: Position; rating: number } {
  const ratings = allPositionRatings(player, weights);
  const candidates = POSITIONS.filter((p) => p !== "KL" || player.goalkeeping || canKeep(player));
  let best: Position = candidates[0];
  for (const p of candidates) {
    if (ratings[p] > ratings[best] || (ratings[p] === ratings[best] && p === player.primaryPosition)) best = p;
  }
  return { position: best, rating: ratings[best] };
}

/** Oyuncunun belirli bir mevkiyle ilişkisi: ana, alternatif veya mevki dışı. */
export function positionFit(player: Pick<Player, "primaryPosition" | "altPositions">, position: Position): "primary" | "alt" | "off" {
  if (player.primaryPosition === position) return "primary";
  if (player.altPositions.includes(position)) return "alt";
  return "off";
}

export type CardTier = "bronze" | "silver" | "gold" | "special";

export function cardTier(rating: number): CardTier {
  if (rating >= 85) return "special";
  if (rating >= 75) return "gold";
  if (rating >= 65) return "silver";
  return "bronze";
}

export const CARD_TIER_LABELS: Record<CardTier, string> = {
  bronze: "Bronz",
  silver: "Gümüş",
  gold: "Altın",
  special: "Özel",
};

/** Bir ağırlık setinin toplamı. */
export function weightTotal(weights: Record<string, number>): number {
  return Object.values(weights).reduce((s, v) => s + v, 0);
}

/**
 * Ağırlıkları toplam 100 olacak şekilde ölçekler (en büyük kalan yöntemiyle
 * tamsayı yuvarlama — toplam her zaman tam 100 çıkar).
 */
export function normalizeWeights<K extends string>(weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const total = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0);
  if (total === 0) {
    const even = Math.floor(100 / keys.length);
    const out = {} as Record<K, number>;
    keys.forEach((k, i) => (out[k] = even + (i < 100 - even * keys.length ? 1 : 0)));
    return out;
  }
  const raw = keys.map((k) => (Math.max(0, weights[k]) / total) * 100);
  const floored = raw.map(Math.floor);
  let remainder = 100 - floored.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (remainder <= 0) break;
    floored[i] += 1;
    remainder -= 1;
  }
  const out = {} as Record<K, number>;
  keys.forEach((k, i) => (out[k] = floored[i]));
  return out;
}

/** Varsayılan alt özellik seti (yeni oyuncu). */
export function defaultSubAttributes(value = 60): SubAttributes {
  const out = {} as SubAttributes;
  for (const k of SUB_ATTRS) out[k] = value;
  return out;
}
