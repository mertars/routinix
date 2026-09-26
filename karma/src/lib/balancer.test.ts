import { describe, expect, it } from "vitest";
import { __testing, balanceScore, balanceTeams, BalanceError, evaluateLineup, lineupKey, rosterStatus, type BalanceInput } from "./balancer";
import { DEFAULT_FORMATIONS, DEFAULT_WEIGHTS, getFormation } from "./constants";
import { createRng } from "./ids";
import { createSamplePlayers } from "./sample-data";
import { overallRating, positionRating, subAttributesFromMain } from "./scoring";
import type { Constraint, Lineup, Player } from "./types";

const players = createSamplePlayers(0);
const byName = (name: string) => players.find((p) => p.name.startsWith(name))!;
const F7 = getFormation("7:1-2-3-1");

function input(overrides: Partial<BalanceInput> = {}): BalanceInput {
  return {
    players,
    formations: [F7, F7],
    extraMode: "bench",
    rotatingKeeper: false,
    constraints: [],
    weights: DEFAULT_WEIGHTS,
    ...overrides,
  };
}

function teamIds(l: Lineup, t: 0 | 1): string[] {
  return [...l.teams[t].slots.filter((x): x is string => !!x), ...l.teams[t].subs];
}

function sameTeam(l: Lineup, a: string, b: string): boolean {
  return [0, 1].some((t) => teamIds(l, t as 0 | 1).includes(a) && teamIds(l, t as 0 | 1).includes(b));
}

describe("dengeleme: 14 oyuncu, 7v7", () => {
  const result = balanceTeams(input(), { seed: 42 });
  const [best] = result.lineups;
  const [evalBest] = result.evaluations;

  it("3 farklı alternatif kadro üretir", () => {
    expect(result.lineups).toHaveLength(3);
    expect(new Set(result.lineups.map(lineupKey)).size).toBe(3);
    // Maliyete göre sıralı
    const costs = result.evaluations.map((e) => e.cost);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });

  it("her oyuncu tam olarak bir kez yer alır, her takım 7 kişi", () => {
    for (const l of result.lineups) {
      const a = teamIds(l, 0);
      const b = teamIds(l, 1);
      expect(a).toHaveLength(7);
      expect(b).toHaveLength(7);
      expect(new Set([...a, ...b]).size).toBe(14);
      expect(l.out).toHaveLength(0);
    }
  });

  it("iki takımın toplam puan farkı makul seviyede", () => {
    const [ta, tb] = evalBest.teams;
    expect(evalBest.totalDiff).toBeLessThanOrEqual(4);
    expect(Math.abs(ta.average - tb.average)).toBeLessThan(1);
    expect(evalBest.balance).toBeGreaterThanOrEqual(90);
  });

  it("rastgele bölüşümlerden çok daha dengeli", () => {
    const rng = createRng(7);
    let worse = 0;
    for (let k = 0; k < 40; k++) {
      const shuffled = [...players].sort(() => rng() - 0.5);
      const random: Lineup = {
        id: "r",
        teams: [
          { formationId: F7.id, slots: shuffled.slice(0, 7).map((p) => p.id), subs: [] },
          { formationId: F7.id, slots: shuffled.slice(7).map((p) => p.id), subs: [] },
        ],
        out: [],
      };
      const e = evaluateLineup(random, input());
      if (e.cost > evalBest.cost) worse++;
    }
    expect(worse).toBe(40);
  });

  it("en iyi iki kaleciyi farklı takımların kalesine koyar", () => {
    const klIndex = F7.slots.findIndex((s) => s.position === "KL");
    const keepers = [best.teams[0].slots[klIndex], best.teams[1].slots[klIndex]].sort();
    expect(keepers).toEqual([byName("Oğuz").id, byName("Serkan").id].sort());
    expect(result.keepers.sort()).toEqual(keepers);
  });

  it("oyuncuların çoğunu kendi mevkisinde oynatır", () => {
    expect(evalBest.teams[0].offPosition + evalBest.teams[1].offPosition).toBeLessThanOrEqual(2);
  });

  it("slot puanı slottaki mevkiye göre hesaplanır", () => {
    F7.slots.forEach((slot, i) => {
      const id = best.teams[0].slots[i]!;
      const p = players.find((x) => x.id === id)!;
      expect(evalBest.teams[0].slotRatings[i]).toBe(positionRating(p, slot.position));
    });
  });

  it("aynı tohumla deterministiktir", () => {
    const again = balanceTeams(input(), { seed: 42 });
    expect(again.lineups.map(lineupKey)).toEqual(result.lineups.map(lineupKey));
  });

  it("birkaç yüz milisaniyede biter", () => {
    const t = performance.now();
    balanceTeams(input(), { seed: 3 });
    expect(performance.now() - t).toBeLessThan(1500);
  });

  it("evaluateLineup aynı kadro için aynı sonucu verir", () => {
    const e = evaluateLineup(best, input());
    expect(e.cost).toBeCloseTo(evalBest.cost, 6);
    expect(e.balance).toBe(evalBest.balance);
  });

  it("'Tekrar karıştır' daha önce gösterilenleri dışlar", () => {
    const exclude = new Set(result.lineups.map(lineupKey));
    const next = balanceTeams(input(), { seed: 99, exclude });
    expect(next.lineups.length).toBeGreaterThan(0);
    for (const l of next.lineups) expect(exclude.has(lineupKey(l))).toBe(false);
    // Yeni varyasyonlar da dengeli olmalı
    expect(next.evaluations[0].balance).toBeGreaterThanOrEqual(85);
  });
});

describe("kısıtlar", () => {
  const can = byName("Can").id;
  const mert = byName("Mert").id;
  const emre = byName("Emre").id;
  const burak = byName("Burak").id;

  it("'aynı takımda olsun' kuralına uyar", () => {
    const constraints: Constraint[] = [{ id: "c1", type: "together", a: can, b: mert }];
    const r = balanceTeams(input({ constraints }), { seed: 5 });
    for (const l of r.lineups) expect(sameTeam(l, can, mert)).toBe(true);
    expect(r.evaluations[0].violations).toEqual([]);
  });

  it("'ayrı takımda olsun' kuralına uyar", () => {
    const constraints: Constraint[] = [{ id: "c1", type: "apart", a: emre, b: burak }];
    const r = balanceTeams(input({ constraints }), { seed: 5 });
    for (const l of r.lineups) expect(sameTeam(l, emre, burak)).toBe(false);
  });

  it("'bu mevkide oynasın' kuralına uyar", () => {
    const constraints: Constraint[] = [{ id: "c1", type: "position", playerId: emre, position: "DEF" }];
    const r = balanceTeams(input({ constraints }), { seed: 5 });
    for (const l of r.lineups) {
      const t = teamIds(l, 0).includes(emre) ? 0 : 1;
      const slot = l.teams[t].slots.indexOf(emre);
      expect(F7.slots[slot].position).toBe("DEF");
    }
  });

  it("birden fazla kuralı aynı anda karşılar ve dengeyi korur", () => {
    const constraints: Constraint[] = [
      { id: "c1", type: "together", a: can, b: mert },
      { id: "c2", type: "apart", a: emre, b: burak },
      { id: "c3", type: "position", playerId: byName("Hakan").id, position: "DEF" },
    ];
    const r = balanceTeams(input({ constraints }), { seed: 11 });
    expect(r.evaluations[0].violations).toEqual([]);
    expect(r.evaluations[0].balance).toBeGreaterThanOrEqual(85);
  });

  it("KL kuralı olan oyuncu kaleye geçer", () => {
    const constraints: Constraint[] = [{ id: "c1", type: "position", playerId: burak, position: "KL" }];
    const r = balanceTeams(input({ constraints }), { seed: 2 });
    expect(r.keepers).toContain(burak);
    expect(r.evaluations[0].violations).toEqual([]);
  });

  it("karşılanamayan kurallar için uyarı verir", () => {
    const constraints: Constraint[] = [
      { id: "c1", type: "together", a: can, b: mert },
      { id: "c2", type: "apart", a: can, b: mert },
    ];
    const r = balanceTeams(input({ constraints }), { seed: 1 });
    expect(r.evaluations[0].violations.length).toBe(1);
    expect(r.warnings.some((w) => w.includes("kurallar"))).toBe(true);
  });
});

describe("format ve kadro seçenekleri", () => {
  it("dönüşümlü kalecide kimse kaleye sabitlenmez ama slotlar dolar", () => {
    const r = balanceTeams(input({ rotatingKeeper: true }), { seed: 8 });
    expect(r.keepers).toEqual([]);
    for (const t of [0, 1] as const) expect(r.lineups[0].teams[t].slots.every(Boolean)).toBe(true);
    expect(r.evaluations[0].teams[0].lines.KL).toBeUndefined();
    expect(r.evaluations[0].balance).toBeGreaterThanOrEqual(88);
  });

  it("fazla oyuncu 'yedek kalsın' modunda dışarıda kalır", () => {
    const extra = { ...players[3], id: "fazla", name: "Fazla Oyuncu" };
    const r = balanceTeams(input({ players: [...players, extra] }), { seed: 4 });
    expect(r.lineups[0].out).toHaveLength(1);
    expect(teamIds(r.lineups[0], 0)).toHaveLength(7);
  });

  it("fazla oyuncu 'dönüşümlü' modunda bir takıma yedek olarak girer", () => {
    const extra = { ...players[3], id: "fazla", name: "Fazla Oyuncu" };
    const r = balanceTeams(input({ players: [...players, extra], extraMode: "rotate" }), { seed: 4 });
    const l = r.lineups[0];
    expect(l.out).toHaveLength(0);
    expect(l.teams[0].subs.length + l.teams[1].subs.length).toBe(1);
    // Yedekli takımın gücü ortalamaya göre ölçeklenir: fark yine küçük
    expect(r.evaluations[0].totalDiff).toBeLessThan(8);
  });

  it("oyuncu yetersizse anlaşılır hata verir", () => {
    expect(() => balanceTeams(input({ players: players.slice(0, 13) }))).toThrow(BalanceError);
    expect(rosterStatus(13, [F7, F7])).toEqual({ needed: 14, extra: 0, missing: 1 });
  });

  it("iki takım farklı diziliş kullanabilir", () => {
    const other = getFormation("7:1-3-3");
    const r = balanceTeams(input({ formations: [F7, other] }), { seed: 6 });
    expect(r.lineups[0].teams[0].formationId).toBe(F7.id);
    expect(r.lineups[0].teams[1].formationId).toBe(other.id);
    expect(r.evaluations[0].balance).toBeGreaterThanOrEqual(85);
  });

  it.each([5, 6, 8] as const)("%iv%i formatında çalışır", (n) => {
    const f = getFormation(DEFAULT_FORMATIONS[n]);
    const pool = [...players, ...createSamplePlayers(0).map((p) => ({ ...p, id: p.id + "-b" }))].slice(0, n * 2);
    const r = balanceTeams(input({ players: pool, formations: [f, f] }), { seed: 1, restarts: 8 });
    expect(teamIds(r.lineups[0], 0)).toHaveLength(n);
    expect(teamIds(r.lineups[0], 1)).toHaveLength(n);
  });

  it("kaleci yoksa KL puanı en yüksek iki kişiyi kaleye koyar ve uyarır", () => {
    const outfield = players.filter((p) => p.primaryPosition !== "KL");
    const pool = [...outfield, ...outfield.slice(0, 2).map((p) => ({ ...p, id: p.id + "-2" }))];
    const r = balanceTeams(input({ players: pool }), { seed: 3 });
    expect(r.keepers).toHaveLength(2);
    expect(r.warnings.some((w) => w.includes("kaleci"))).toBe(true);
  });
});

describe("denge skoru", () => {
  function clone(p: Player, id: string): Player {
    return { ...p, id, attributes: { ...p.attributes } };
  }

  it("birebir aynı iki takım için %100", () => {
    const half = players.slice(0, 7);
    const mirror = half.map((p) => clone(p, p.id + "-ikiz"));
    const r = balanceTeams(input({ players: [...half, ...mirror] }), { seed: 1 });
    expect(r.evaluations[0].totalDiff).toBe(0);
    expect(r.evaluations[0].balance).toBe(100);
  });

  it("dengesiz takımlarda belirgin şekilde düşer", () => {
    const strong = subAttributesFromMain({ hiz: 90, sut: 90, pas: 90, dri: 90, def: 90, fiz: 90 });
    const weak = subAttributesFromMain({ hiz: 40, sut: 40, pas: 40, dri: 40, def: 40, fiz: 40 });
    const team = (attrs: typeof strong, prefix: string) =>
      F7.slots.map((s, i) => ({ ...players[0], id: `${prefix}${i}`, primaryPosition: s.position, altPositions: [], attributes: attrs, goalkeeping: undefined }));
    const a = team(strong, "a");
    const b = team(weak, "b");
    const lineup: Lineup = {
      id: "u",
      teams: [
        { formationId: F7.id, slots: a.map((p) => p.id), subs: [] },
        { formationId: F7.id, slots: b.map((p) => p.id), subs: [] },
      ],
      out: [],
    };
    const e = evaluateLineup(lineup, input({ players: [...a, ...b] }));
    expect(e.balance).toBeLessThan(50);
    expect(overallRating(a[1])).toBeGreaterThan(overallRating(b[1]));
  });

  it("formül uçlarda doğru davranır", () => {
    const teams = [
      { strength: 500 },
      { strength: 500 },
    ] as unknown as Parameters<typeof balanceScore>[0]["teams"];
    expect(balanceScore({ totalDiff: 0, attrDiff: 0, lineDiff: 0, teams }, 4)).toBe(100);
    expect(balanceScore({ totalDiff: 500, attrDiff: 0, lineDiff: 0, teams }, 4)).toBe(0);
  });
});

describe("hızlı maliyet fonksiyonu", () => {
  it("ayrıntılı değerlendirmeyle birebir aynı maliyeti verir", () => {
    const { prepare, evaluate, makeCostFn } = __testing;
    const rng = createRng(123);
    const extra = [{ ...players[4], id: "e1" }, { ...players[9], id: "e2" }, { ...players[6], id: "e3" }];
    const pool = [...players, ...extra];
    const constraints: Constraint[] = [
      { id: "a", type: "together", a: pool[2].id, b: pool[9].id },
      { id: "b", type: "apart", a: pool[6].id, b: pool[7].id },
      { id: "c", type: "position", playerId: pool[12].id, position: "OS" },
    ];
    const other = getFormation("7:1-3-3");
    for (const rotating of [false, true]) {
      for (const [subs, out] of [
        [[0, 0], 3],
        [[2, 1], 0],
      ] as const) {
        const ctx = prepare(pool, [F7, other], [subs[0], subs[1]], out, rotating, constraints, DEFAULT_WEIGHTS);
        const costOf = makeCostFn(ctx);
        for (let k = 0; k < 50; k++) {
          const perm = pool.map((_, i) => i).sort(() => rng() - 0.5);
          const assign = Int32Array.from(perm);
          expect(costOf(assign)).toBeCloseTo(evaluate(ctx, assign).cost, 9);
        }
      }
    }
  });
});
