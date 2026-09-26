// Maç geçmişinden oyuncu istatistikleri — saf fonksiyonlar.

import type { Match } from "./types";

export type Result = "G" | "B" | "M";

export interface FormEntry {
  matchId: string;
  date: string;
  result: Result;
  /** Oyuncunun takımı açısından gol farkı. */
  goalDiff: number;
  mvp: boolean;
}

export interface PlayerStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** 0-100, oynanan (skoru girilmiş) maç yoksa null. */
  winRate: number | null;
  mvps: number;
  /** Eskiden yeniye son 5 maç. */
  form: FormEntry[];
  /** Kadroda olup skoru henüz girilmemiş maç sayısı. */
  pending: number;
}

/** Maçları kronolojik (eskiden yeniye) sıralar. */
export function sortMatchesAsc(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export function teamIndexOf(match: Match, playerId: string): 0 | 1 | null {
  if (match.teams[0].players.some((p) => p.playerId === playerId)) return 0;
  if (match.teams[1].players.some((p) => p.playerId === playerId)) return 1;
  return null;
}

export function matchResultFor(match: Match, team: 0 | 1): Result | null {
  if (!match.score) return null;
  const mine = team === 0 ? match.score.a : match.score.b;
  const theirs = team === 0 ? match.score.b : match.score.a;
  return mine > theirs ? "G" : mine < theirs ? "M" : "B";
}

export function playerStats(playerId: string, matches: Match[], formLength = 5): PlayerStats {
  const stats: PlayerStats = { played: 0, wins: 0, draws: 0, losses: 0, winRate: null, mvps: 0, form: [], pending: 0 };
  const history: FormEntry[] = [];
  for (const m of sortMatchesAsc(matches)) {
    const team = teamIndexOf(m, playerId);
    if (team === null) continue;
    if (m.mvpId === playerId) stats.mvps += 1;
    const result = matchResultFor(m, team);
    if (!result || !m.score) {
      stats.pending += 1;
      continue;
    }
    stats.played += 1;
    if (result === "G") stats.wins += 1;
    else if (result === "B") stats.draws += 1;
    else stats.losses += 1;
    const diff = team === 0 ? m.score.a - m.score.b : m.score.b - m.score.a;
    history.push({ matchId: m.id, date: m.date, result, goalDiff: diff, mvp: m.mvpId === playerId });
  }
  stats.winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : null;
  stats.form = history.slice(-formLength);
  return stats;
}

export function allPlayerStats(playerIds: string[], matches: Match[]): Map<string, PlayerStats> {
  return new Map(playerIds.map((id) => [id, playerStats(id, matches)]));
}

export const RESULT_LABELS: Record<Result, string> = { G: "Galibiyet", B: "Beraberlik", M: "Mağlubiyet" };
