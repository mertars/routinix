import { describe, expect, it } from "vitest";
import { matchResultFor, playerStats, sortMatchesAsc } from "./stats";
import type { Match, MatchTeam } from "./types";

function team(ids: string[]): MatchTeam {
  return {
    name: "T",
    color: "#ffffff",
    formationId: "7:1-2-3-1",
    players: ids.map((id) => ({ playerId: id, name: id, position: "OS", rating: 70 })),
    total: 0,
    average: 0,
  };
}

let seq = 0;
function match(date: string, a: string[], b: string[], score: [number, number] | null, mvpId?: string): Match {
  return {
    id: `m${++seq}`,
    date,
    format: 7,
    rotatingKeeper: false,
    teams: [team(a), team(b)],
    out: [],
    balance: 95,
    score: score ? { a: score[0], b: score[1] } : null,
    mvpId,
    createdAt: seq,
  };
}

const matches = [
  match("2026-09-01", ["ali", "veli"], ["can", "cem"], [3, 1], "ali"),
  match("2026-09-08", ["ali", "can"], ["veli", "cem"], [2, 2]),
  match("2026-09-15", ["cem", "ali"], ["veli", "can"], [0, 4], "can"),
  match("2026-09-22", ["ali", "veli"], ["can", "cem"], null),
  match("2026-08-25", ["veli"], ["ali"], [1, 0]),
];

describe("oyuncu istatistikleri", () => {
  it("G/B/M, galibiyet oranı ve maçın adamını sayar", () => {
    const s = playerStats("ali", matches);
    expect(s.played).toBe(4);
    expect([s.wins, s.draws, s.losses]).toEqual([1, 1, 2]);
    expect(s.winRate).toBe(25);
    expect(s.mvps).toBe(1);
    expect(s.pending).toBe(1);
  });

  it("form eskiden yeniye son 5 maçı gösterir, gol farkıyla", () => {
    const s = playerStats("ali", matches);
    expect(s.form.map((f) => f.result)).toEqual(["M", "G", "B", "M"]);
    expect(s.form.map((f) => f.goalDiff)).toEqual([-1, 2, 0, -4]);
    expect(s.form[1].mvp).toBe(true);
  });

  it("form uzunluğu sınırlanır", () => {
    expect(playerStats("ali", matches, 2).form.map((f) => f.date)).toEqual(["2026-09-08", "2026-09-15"]);
  });

  it("hiç oynamamış oyuncu için boş istatistik", () => {
    const s = playerStats("yok", matches);
    expect(s.played).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.form).toEqual([]);
  });

  it("maç sonucunu takım açısından hesaplar", () => {
    expect(matchResultFor(matches[0], 0)).toBe("G");
    expect(matchResultFor(matches[0], 1)).toBe("M");
    expect(matchResultFor(matches[1], 1)).toBe("B");
    expect(matchResultFor(matches[3], 0)).toBeNull();
  });

  it("maçları tarihe göre sıralar", () => {
    expect(sortMatchesAsc(matches).map((m) => m.date)[0]).toBe("2026-08-25");
  });
});
