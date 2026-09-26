import { describe, expect, it } from "vitest";
import { balanceTeams } from "./balancer";
import { DEFAULT_TEAM_STYLES, DEFAULT_WEIGHTS, getFormation } from "./constants";
import { formatLineupText, lineupToMatch, placeId, swapPlaces } from "./lineup";
import { createSamplePlayers } from "./sample-data";
import type { Lineup } from "./types";

const players = createSamplePlayers(0);
const map = new Map(players.map((p) => [p.id, p]));
const F7 = getFormation("7:1-2-3-1");
const extra = { ...players[5], id: "fazla", name: "Fazla Oyuncu", nickname: undefined };
const result = balanceTeams(
  { players: [...players, extra], formations: [F7, F7], extraMode: "bench", rotatingKeeper: false, constraints: [], weights: DEFAULT_WEIGHTS },
  { seed: 9 },
);
const lineup = result.lineups[0];
const evaluation = result.evaluations[0];
map.set(extra.id, extra);

describe("yer takası", () => {
  it("iki takım arasında oyuncu takas eder", () => {
    const a = placeId(0, "slot", 3);
    const b = placeId(1, "slot", 5);
    const next = swapPlaces(lineup, a, b);
    expect(next.teams[0].slots[3]).toBe(lineup.teams[1].slots[5]);
    expect(next.teams[1].slots[5]).toBe(lineup.teams[0].slots[3]);
    // Orijinal kadro değişmez
    expect(lineup.teams[0].slots[3]).not.toBe(next.teams[0].slots[3]);
  });

  it("oynamayan oyuncuyu sahaya alır", () => {
    const next = swapPlaces(lineup, placeId(-1, "out", 0), placeId(0, "slot", 1));
    expect(next.teams[0].slots[1]).toBe(lineup.out[0]);
    expect(next.out[0]).toBe(lineup.teams[0].slots[1]);
  });

  it("boş slota taşır ve listeden çıkarır", () => {
    const withEmpty: Lineup = structuredClone(lineup);
    withEmpty.teams[1].slots[2] = null;
    const next = swapPlaces(withEmpty, placeId(-1, "out", 0), placeId(1, "slot", 2));
    expect(next.teams[1].slots[2]).toBe(lineup.out[0]);
    expect(next.out).toHaveLength(0);
  });
});

describe("paylaşım metni", () => {
  const text = formatLineupText({
    lineup,
    evaluation,
    players: map,
    styles: DEFAULT_TEAM_STYLES,
    format: 7,
    rotatingKeeper: false,
    date: "2026-09-26",
  });

  it("takım adlarını, dizilişi ve denge skorunu içerir", () => {
    expect(text).toContain("*Yelekliler* (1-2-3-1)");
    expect(text).toContain("*Yeleksizler* (1-2-3-1)");
    expect(text).toContain(`%${evaluation.balance}`);
    expect(text).toContain("26 Eylül");
    expect(text).toContain("7v7");
  });

  it("oyuncuları mevkiye göre gruplar ve yedekleri listeler", () => {
    expect(text.match(/🧤 KL: /g)).toHaveLength(2);
    expect(text.match(/🛡️ DEF: /g)).toHaveLength(2);
    expect(text).toContain("🪑 Bu maç yedek:");
    for (const p of players) expect(text).toContain(p.name);
  });
});

describe("maç kaydı", () => {
  it("kadronun anlık görüntüsünü alır", () => {
    const m = lineupToMatch(lineup, evaluation, map, { format: 7, rotatingKeeper: false, styles: DEFAULT_TEAM_STYLES, date: "2026-09-26" });
    expect(m.teams[0].players).toHaveLength(7);
    expect(m.teams[1].players).toHaveLength(7);
    expect(m.out).toEqual(lineup.out);
    expect(m.score).toBeNull();
    expect(m.teams[0].name).toBe("Yelekliler");
    expect(m.teams[0].players.find((p) => p.position === "KL")).toBeDefined();
    expect(m.balance).toBe(evaluation.balance);
  });
});
