import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "./constants";
import { createSamplePlayers } from "./sample-data";
import {
  allPositionRatings,
  bestOutfieldRating,
  cardTier,
  clampAttr,
  defaultSubAttributes,
  estimateGoalkeeping,
  goalkeepingFromValue,
  mainAttributes,
  normalizeWeights,
  overallRating,
  positionRating,
  subAttributesFromMain,
  suggestPosition,
  weightTotal,
} from "./scoring";
import { OUTFIELD_POSITIONS, type MainAttributes, type Player } from "./types";

function makePlayer(main: MainAttributes, extra: Partial<Player> = {}): Player {
  return {
    id: "t",
    name: "Test",
    avatar: { type: "emoji", value: "⚽" },
    primaryPosition: "OS",
    altPositions: [],
    foot: "sag",
    active: true,
    attributes: subAttributesFromMain(main),
    inputMode: "quick",
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

describe("ana özellikler", () => {
  it("alt özelliklerin yuvarlanmış ortalamasıdır", () => {
    const attrs = defaultSubAttributes(50);
    attrs.hizlanma = 80;
    attrs.sprint = 91; // (80+91)/2 = 85.5 → 86
    attrs.bitiricilik = 70;
    attrs.sutGucu = 71;
    attrs.uzaktanSut = 71; // 70.67 → 71
    expect(mainAttributes(attrs).hiz).toBe(86);
    expect(mainAttributes(attrs).sut).toBe(71);
    expect(mainAttributes(attrs).def).toBe(50);
  });

  it("hızlı giriş alt özellikleri ana değerle doldurur (gidiş-dönüş aynı)", () => {
    const main = { hiz: 91, sut: 40, pas: 77, dri: 66, def: 12, fiz: 99 };
    expect(mainAttributes(subAttributesFromMain(main))).toEqual(main);
  });

  it("değerleri 1-99 aralığına sıkıştırır", () => {
    expect(clampAttr(0)).toBe(1);
    expect(clampAttr(150)).toBe(99);
    expect(clampAttr(54.6)).toBe(55);
    expect(clampAttr(Number.NaN)).toBe(1);
  });
});

describe("mevki puanı", () => {
  it("varsayılan ağırlık setlerinin her biri toplam 100", () => {
    for (const p of OUTFIELD_POSITIONS) expect(weightTotal(DEFAULT_WEIGHTS[p])).toBe(100);
    expect(weightTotal(DEFAULT_WEIGHTS.KL)).toBe(100);
  });

  it("tüm özellikleri eşit olan oyuncu her dış saha mevkisinde aynı puanı alır", () => {
    const p = makePlayer({ hiz: 70, sut: 70, pas: 70, dri: 70, def: 70, fiz: 70 });
    for (const pos of OUTFIELD_POSITIONS) expect(positionRating(p, pos)).toBe(70);
  });

  it("tablodaki ağırlıklarla hesaplanır", () => {
    const main = { hiz: 68, sut: 45, pas: 70, dri: 58, def: 88, fiz: 86 };
    const p = makePlayer(main, { primaryPosition: "DEF" });
    // DEF: 15·68 + 3·45 + 12·70 + 5·58 + 45·88 + 20·86 = 7965 → 79.65 → 80
    expect(positionRating(p, "DEF")).toBe(80);
    // FV: 20·68 + 40·45 + 8·70 + 20·58 + 2·88 + 10·86 = 5916 → 59.16 → 59
    expect(positionRating(p, "FV")).toBe(59);
    expect(overallRating(p)).toBe(80);
  });

  it("kaleci puanı: kalecilik ağırlıklı ortalaması + %15 PAS", () => {
    const p = makePlayer({ hiz: 50, sut: 50, pas: 60, dri: 50, def: 50, fiz: 50 }, {
      primaryPosition: "KL",
      goalkeeping: goalkeepingFromValue(80),
    });
    // 80·0.85 + 60·0.15 = 77
    expect(positionRating(p, "KL")).toBe(77);
  });

  it("kaleci ağırlıkları uygulanır (Refleks 25, Uçuş 20, Pozisyon 20, Tutma 20, Oyun kurma 15)", () => {
    const p = makePlayer({ hiz: 50, sut: 50, pas: 70, dri: 50, def: 50, fiz: 50 }, {
      primaryPosition: "KL",
      goalkeeping: { refleks: 90, ucus: 80, pozisyonAlma: 70, topTutma: 60, oyunKurma: 50 },
    });
    // gk = (90·25 + 80·20 + 70·20 + 60·20 + 50·15)/100 = 72.0 → 72·0.85 + 70·0.15 = 71.7 → 72
    expect(positionRating(p, "KL")).toBe(72);
  });

  it("mevki dışı oynatma puanı düşürür", () => {
    const striker = makePlayer({ hiz: 85, sut: 90, pas: 65, dri: 82, def: 30, fiz: 70 }, { primaryPosition: "FV" });
    const r = allPositionRatings(striker);
    expect(r.FV).toBeGreaterThan(r.DEF + 15);
    expect(r.FV).toBeGreaterThan(r.OS);
  });

  it("özel ağırlıklar kullanılabilir", () => {
    const p = makePlayer({ hiz: 99, sut: 1, pas: 1, dri: 1, def: 1, fiz: 1 });
    const weights = structuredClone(DEFAULT_WEIGHTS);
    weights.OS = { hiz: 100, sut: 0, pas: 0, dri: 0, def: 0, fiz: 0 };
    expect(positionRating(p, "OS", weights)).toBe(99);
  });

  it("kalecilik verisi olmayanlar için KL puanı mütevazı bir tahmindir", () => {
    const p = makePlayer({ hiz: 99, sut: 99, pas: 99, dri: 99, def: 99, fiz: 99 });
    const gk = estimateGoalkeeping(p.attributes);
    for (const v of Object.values(gk)) expect(v).toBeLessThanOrEqual(55);
    expect(positionRating(p, "KL")).toBeLessThan(65);
  });

  it("en iyi dış saha puanı KL'yi dikkate almaz", () => {
    const keeper = makePlayer({ hiz: 40, sut: 40, pas: 50, dri: 40, def: 60, fiz: 70 }, {
      primaryPosition: "KL",
      goalkeeping: goalkeepingFromValue(90),
    });
    expect(bestOutfieldRating(keeper)).toBe(Math.max(...OUTFIELD_POSITIONS.map((p) => positionRating(keeper, p))));
    expect(bestOutfieldRating(keeper)).toBeLessThan(overallRating(keeper));
  });
});

describe("mevki önerisi", () => {
  it("defansif profile DEF önerir", () => {
    const p = makePlayer({ hiz: 65, sut: 40, pas: 60, dri: 50, def: 88, fiz: 85 }, { primaryPosition: "OS" });
    expect(suggestPosition(p).position).toBe("DEF");
  });

  it("hızlı/driplingci profile KNT önerir", () => {
    const p = makePlayer({ hiz: 92, sut: 70, pas: 70, dri: 90, def: 30, fiz: 60 }, { primaryPosition: "FV" });
    expect(suggestPosition(p).position).toBe("KNT");
  });

  it("kaleye geçemeyen oyuncuya KL önermez", () => {
    const p = makePlayer({ hiz: 1, sut: 1, pas: 1, dri: 1, def: 1, fiz: 1 });
    expect(suggestPosition(p).position).not.toBe("KL");
  });
});

describe("kart rengi", () => {
  it.each([
    [1, "bronze"],
    [64, "bronze"],
    [65, "silver"],
    [74, "silver"],
    [75, "gold"],
    [84, "gold"],
    [85, "special"],
    [99, "special"],
  ] as const)("%i puan → %s", (rating, tier) => {
    expect(cardTier(rating)).toBe(tier);
  });
});

describe("ağırlık normalizasyonu", () => {
  it("toplamı her zaman tam 100 yapar ve oranları korur", () => {
    const n = normalizeWeights({ a: 10, b: 10, c: 10 });
    expect(weightTotal(n)).toBe(100);
    expect(Math.max(...Object.values(n)) - Math.min(...Object.values(n))).toBeLessThanOrEqual(1);
    const m = normalizeWeights({ hiz: 30, sut: 60, pas: 30, dri: 0, def: 0, fiz: 0 });
    expect(m).toEqual({ hiz: 25, sut: 50, pas: 25, dri: 0, def: 0, fiz: 0 });
  });

  it("hepsi sıfırsa eşit dağıtır", () => {
    expect(weightTotal(normalizeWeights({ a: 0, b: 0, c: 0 }))).toBe(100);
  });
});

describe("örnek veri", () => {
  const players = createSamplePlayers(0);

  it("14 oyuncu, 2 kaleci ve her mevkiden oyuncu içerir", () => {
    expect(players).toHaveLength(14);
    expect(players.filter((p) => p.primaryPosition === "KL")).toHaveLength(2);
    for (const pos of OUTFIELD_POSITIONS) expect(players.some((p) => p.primaryPosition === pos)).toBe(true);
    expect(new Set(players.map((p) => p.id)).size).toBe(14);
  });

  it("dört kart renginin hepsini kapsar", () => {
    const tiers = new Set(players.map((p) => cardTier(overallRating(p))));
    expect(tiers).toEqual(new Set(["bronze", "silver", "gold", "special"]));
  });

  it("alt özellik sapmaları ana özelliği değiştirmez", () => {
    const can = players.find((p) => p.name === "Can Aydın")!;
    expect(mainAttributes(can.attributes)).toEqual({ hiz: 84, sut: 91, pas: 70, dri: 84, def: 35, fiz: 82 });
  });
});
