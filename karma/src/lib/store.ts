"use client";

// Uygulama durumu (zustand). Kalıcılık tamamen `storage` katmanı üzerinden
// yapılır; store hangi depolamanın kullanıldığını bilmez.

import { create } from "zustand";
import { DEFAULT_WEIGHTS } from "./constants";
import { createId } from "./ids";
import { createSamplePlayers } from "./sample-data";
import {
  createDefaultBuilder,
  createDefaultData,
  getStorage,
  mergeData,
  StorageQuotaError,
  type KarmaStorage,
} from "./storage";
import type { BuilderState, KarmaData, Match, MatchFormat, Player, TeamStyle, Weights } from "./types";

export type PlayerInput = Omit<Player, "id" | "createdAt" | "updatedAt">;

interface KarmaActions {
  hydrate(storage?: KarmaStorage): Promise<void>;
  addPlayer(input: PlayerInput): Player;
  updatePlayer(id: string, patch: Partial<PlayerInput>): void;
  deletePlayer(id: string): void;
  toggleActive(id: string): void;
  setAllActive(active: boolean): void;
  loadSample(): void;
  setWeights(weights: Weights): void;
  resetWeights(): void;
  setDefaultFormat(format: MatchFormat): void;
  setDefaultFormation(format: MatchFormat, formationId: string): void;
  setDefaultTeamStyles(styles: [TeamStyle, TeamStyle]): void;
  updateBuilder(patch: Partial<BuilderState> | ((b: BuilderState) => Partial<BuilderState>)): void;
  saveMatch(match: Match): void;
  updateMatch(id: string, patch: Partial<Match>): void;
  deleteMatch(id: string): void;
  replaceData(data: KarmaData): void;
  mergeIncoming(data: Pick<KarmaData, "players" | "matches">): void;
  resetAll(): Promise<void>;
}

export interface KarmaState extends KarmaData, KarmaActions {
  hydrated: boolean;
  saveError: string | null;
}

function dataOf(s: KarmaState): KarmaData {
  return { version: s.version, players: s.players, matches: s.matches, settings: s.settings, builder: s.builder };
}

let storage: KarmaStorage | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useKarma = create<KarmaState>()((set, get) => ({
  ...createDefaultData(),
  hydrated: false,
  saveError: null,

  async hydrate(custom) {
    if (get().hydrated) return;
    storage = custom ?? getStorage();
    // Depolama okunamasa bile uygulama açılış ekranında takılı kalmasın.
    const loaded = await storage.load().catch(() => null);
    set({ ...(loaded ?? createDefaultData()), hydrated: true });
  },

  addPlayer(input) {
    const now = Date.now();
    const player: Player = { ...input, id: createId("p"), createdAt: now, updatedAt: now };
    set((s) => ({ players: [...s.players, player] }));
    return player;
  },

  updatePlayer(id, patch) {
    set((s) => ({
      players: s.players.map((p) => (p.id === id ? { ...p, ...patch, id, updatedAt: Date.now() } : p)),
    }));
  },

  deletePlayer(id) {
    set((s) => ({
      players: s.players.filter((p) => p.id !== id),
      builder: {
        ...s.builder,
        selectedIds: s.builder.selectedIds.filter((x) => x !== id),
        knownIds: s.builder.knownIds.filter((x) => x !== id),
        benchIds: s.builder.benchIds.filter((x) => x !== id),
        constraints: s.builder.constraints.filter((c) =>
          c.type === "position" ? c.playerId !== id : c.a !== id && c.b !== id,
        ),
        alternatives: [],
      },
    }));
  },

  toggleActive(id) {
    const p = get().players.find((x) => x.id === id);
    if (p) get().updatePlayer(id, { active: !p.active });
  },

  setAllActive(active) {
    const now = Date.now();
    set((s) => ({ players: s.players.map((p) => ({ ...p, active, updatedAt: now })) }));
  },

  loadSample() {
    const samples = createSamplePlayers();
    set((s) => {
      const existing = new Set(s.players.map((p) => p.id));
      return { players: [...s.players, ...samples.filter((p) => !existing.has(p.id))] };
    });
  },

  setWeights(weights) {
    set((s) => ({ settings: { ...s.settings, weights } }));
  },

  resetWeights() {
    set((s) => ({ settings: { ...s.settings, weights: structuredClone(DEFAULT_WEIGHTS) } }));
  },

  setDefaultFormat(format) {
    set((s) => ({ settings: { ...s.settings, defaultFormat: format } }));
  },

  setDefaultFormation(format, formationId) {
    set((s) => ({
      settings: { ...s.settings, defaultFormations: { ...s.settings.defaultFormations, [format]: formationId } },
    }));
  },

  setDefaultTeamStyles(styles) {
    set((s) => ({ settings: { ...s.settings, teamStyles: styles } }));
  },

  updateBuilder(patch) {
    set((s) => ({ builder: { ...s.builder, ...(typeof patch === "function" ? patch(s.builder) : patch) } }));
  },

  saveMatch(match) {
    set((s) => ({ matches: [match, ...s.matches.filter((m) => m.id !== match.id)] }));
  },

  updateMatch(id, patch) {
    set((s) => ({ matches: s.matches.map((m) => (m.id === id ? { ...m, ...patch, id } : m)) }));
  },

  deleteMatch(id) {
    set((s) => ({ matches: s.matches.filter((m) => m.id !== id) }));
  },

  replaceData(data) {
    set({ ...data, builder: { ...data.builder, alternatives: [] } });
  },

  mergeIncoming(incoming) {
    const merged = mergeData(dataOf(get()), { ...createDefaultData(), ...incoming });
    set({ players: merged.players, matches: merged.matches });
  },

  async resetAll() {
    const fresh = createDefaultData();
    await storage?.clear();
    set({ ...fresh, builder: createDefaultBuilder(fresh.settings) });
  },
}));

// Her değişiklikte (kısa bir gecikmeyle) depolamaya yaz.
useKarma.subscribe((state, prev) => {
  if (!state.hydrated || !storage) return;
  if (
    state.players === prev.players &&
    state.matches === prev.matches &&
    state.settings === prev.settings &&
    state.builder === prev.builder
  ) {
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    storage
      ?.save(dataOf(useKarma.getState()))
      .then(() => useKarma.getState().saveError && useKarma.setState({ saveError: null }))
      .catch((err: unknown) =>
        useKarma.setState({
          saveError: err instanceof StorageQuotaError ? err.message : "Veriler kaydedilemedi.",
        }),
      );
  }, 150);
});

/** Oyuncu id → oyuncu eşlemesi (bileşenlerde sık kullanılır). */
export function usePlayerMap(): Map<string, Player> {
  const players = useKarma((s) => s.players);
  return playersToMap(players);
}

let memoPlayers: Player[] | null = null;
let memoMap = new Map<string, Player>();
function playersToMap(players: Player[]): Map<string, Player> {
  if (players !== memoPlayers) {
    memoPlayers = players;
    memoMap = new Map(players.map((p) => [p.id, p]));
  }
  return memoMap;
}
