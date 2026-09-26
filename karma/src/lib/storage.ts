// Depolama katmanı.
//
// Uygulamanın geri kalanı yalnızca `KarmaStorage` arayüzünü bilir. Bugün
// localStorage kullanıyoruz; ileride Supabase'e geçmek için aynı arayüzü
// uygulayan bir adaptör yazıp `getStorage()` içinde döndürmek yeterli
// (bkz. README → "Supabase'e geçiş").
//
// Bu dosyadaki doğrulama / göç (migration) / paylaşım fonksiyonları saftır.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import {
  DEFAULT_FORMATIONS,
  DEFAULT_TEAM_STYLES,
  DEFAULT_WEIGHTS,
  FORMATION_BY_ID,
  MATCH_FORMATS,
} from "./constants";
import { clampAttr, defaultSubAttributes } from "./scoring";
import {
  GK_ATTRS,
  MAIN_ATTRS,
  POSITIONS,
  SUB_ATTRS,
  type BuilderState,
  type Constraint,
  type Foot,
  type GkAttributes,
  type KarmaData,
  type Match,
  type MatchFormat,
  type MatchTeam,
  type Player,
  type Position,
  type Settings,
  type SubAttributes,
  type TeamStyle,
  type Weights,
} from "./types";

export const DATA_VERSION = 1;
export const STORAGE_KEY = "karma:data";

// ---------------------------------------------------------------------------
// Adaptör arayüzü
// ---------------------------------------------------------------------------

export interface KarmaStorage {
  readonly kind: "local" | "memory" | "remote";
  load(): Promise<KarmaData | null>;
  save(data: KarmaData): Promise<void>;
  clear(): Promise<void>;
}

export class StorageQuotaError extends Error {
  constructor() {
    super("Cihaz depolama alanı doldu. Fotoğrafları küçültmeyi veya silmeyi deneyin.");
    this.name = "StorageQuotaError";
  }
}

export function createLocalStorage(key: string = STORAGE_KEY, store?: Storage): KarmaStorage {
  const ls = () => store ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  return {
    kind: "local",
    async load() {
      const raw = ls()?.getItem(key);
      if (!raw) return null;
      try {
        return sanitizeData(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async save(data) {
      try {
        ls()?.setItem(key, JSON.stringify(data));
      } catch (err) {
        if (err instanceof DOMException && /quota/i.test(err.name + err.message)) throw new StorageQuotaError();
        throw err;
      }
    },
    async clear() {
      ls()?.removeItem(key);
    },
  };
}

export function createMemoryStorage(initial: KarmaData | null = null): KarmaStorage {
  let current = initial ? structuredClone(initial) : null;
  return {
    kind: "memory",
    async load() {
      return current ? structuredClone(current) : null;
    },
    async save(data) {
      current = structuredClone(data);
    },
    async clear() {
      current = null;
    },
  };
}

let storageSingleton: KarmaStorage | null = null;

/** Uygulamanın kullandığı depolama. Supabase'e geçişte değişecek tek yer. */
export function getStorage(): KarmaStorage {
  if (!storageSingleton) {
    storageSingleton = typeof window !== "undefined" ? createLocalStorage() : createMemoryStorage();
  }
  return storageSingleton;
}

// ---------------------------------------------------------------------------
// Varsayılanlar
// ---------------------------------------------------------------------------

export function createDefaultSettings(): Settings {
  return {
    weights: structuredClone(DEFAULT_WEIGHTS),
    defaultFormat: 7,
    defaultFormations: { ...DEFAULT_FORMATIONS },
    teamStyles: structuredClone(DEFAULT_TEAM_STYLES),
  };
}

export function createDefaultBuilder(settings: Settings = createDefaultSettings()): BuilderState {
  const f = settings.defaultFormations[settings.defaultFormat];
  return {
    selectedIds: [],
    knownIds: [],
    format: settings.defaultFormat,
    formations: [f, f],
    extraMode: "bench",
    benchIds: [],
    rotatingKeeper: false,
    constraints: [],
    teamStyles: structuredClone(settings.teamStyles),
    alternatives: [],
    activeAlternative: 0,
    seed: 1,
  };
}

export function createDefaultData(): KarmaData {
  const settings = createDefaultSettings();
  return { version: DATA_VERSION, players: [], matches: [], settings, builder: createDefaultBuilder(settings) };
}

// ---------------------------------------------------------------------------
// Doğrulama (dışarıdan gelen her veri buradan geçer: localStorage, JSON, link)
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const isPosition = (v: unknown): v is Position => typeof v === "string" && (POSITIONS as readonly string[]).includes(v);
const isFormat = (v: unknown): v is MatchFormat => MATCH_FORMATS.includes(v as MatchFormat);
const isColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

function sanitizeSub(v: unknown): SubAttributes {
  const base = defaultSubAttributes();
  if (!isObj(v)) return base;
  for (const k of SUB_ATTRS) base[k] = clampAttr(num(v[k], base[k]));
  return base;
}

function sanitizeGk(v: unknown): GkAttributes | undefined {
  if (!isObj(v)) return undefined;
  const out = {} as GkAttributes;
  for (const k of GK_ATTRS) out[k] = clampAttr(num(v[k], 50));
  return out;
}

export function sanitizePlayer(v: unknown): Player | null {
  if (!isObj(v)) return null;
  const name = str(v.name, 40);
  const id = str(v.id, 80);
  if (!name || !id) return null;
  const primaryPosition = isPosition(v.primaryPosition) ? v.primaryPosition : "OS";
  const altPositions = Array.isArray(v.altPositions)
    ? [...new Set(v.altPositions.filter(isPosition))].filter((p) => p !== primaryPosition).slice(0, 2)
    : [];
  const foot: Foot = v.foot === "sol" || v.foot === "ikisi" ? v.foot : "sag";
  let avatar: Player["avatar"] = { type: "emoji", value: "⚽" };
  if (isObj(v.avatar)) {
    if (v.avatar.type === "photo" && typeof v.avatar.dataUrl === "string" && v.avatar.dataUrl.startsWith("data:image/")) {
      avatar = { type: "photo", dataUrl: v.avatar.dataUrl };
    } else if (v.avatar.type === "emoji" && str(v.avatar.value, 16)) {
      avatar = { type: "emoji", value: str(v.avatar.value, 16)! };
    }
  }
  const now = Date.now();
  return {
    id,
    name,
    nickname: str(v.nickname, 30),
    avatar,
    primaryPosition,
    altPositions,
    foot,
    active: v.active !== false,
    attributes: sanitizeSub(v.attributes),
    goalkeeping: sanitizeGk(v.goalkeeping),
    inputMode: v.inputMode === "quick" ? "quick" : "detailed",
    createdAt: num(v.createdAt, now),
    updatedAt: num(v.updatedAt, now),
  };
}

function sanitizeWeightSet<K extends string>(v: unknown, keys: readonly K[], fallback: Record<K, number>): Record<K, number> {
  if (!isObj(v)) return { ...fallback };
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = Math.min(100, Math.max(0, Math.round(num(v[k], fallback[k]))));
  // Toplamı 100 olmayan (bozuk) set varsayılana döner.
  const total = keys.reduce((s, k) => s + out[k], 0);
  return total === 100 ? out : { ...fallback };
}

export function sanitizeWeights(v: unknown): Weights {
  const d = DEFAULT_WEIGHTS;
  if (!isObj(v)) return structuredClone(d);
  return {
    DEF: sanitizeWeightSet(v.DEF, MAIN_ATTRS, d.DEF),
    OS: sanitizeWeightSet(v.OS, MAIN_ATTRS, d.OS),
    KNT: sanitizeWeightSet(v.KNT, MAIN_ATTRS, d.KNT),
    FV: sanitizeWeightSet(v.FV, MAIN_ATTRS, d.FV),
    KL: sanitizeWeightSet(v.KL, GK_ATTRS, d.KL),
    klPassShare: Math.min(50, Math.max(0, Math.round(num(v.klPassShare, d.klPassShare)))),
  };
}

function sanitizeTeamStyles(v: unknown, fallback: [TeamStyle, TeamStyle]): [TeamStyle, TeamStyle] {
  if (!Array.isArray(v) || v.length !== 2) return structuredClone(fallback);
  return [0, 1].map((i) => {
    const t = v[i];
    return {
      name: (isObj(t) && str(t.name, 24)) || fallback[i].name,
      color: isObj(t) && isColor(t.color) ? t.color : fallback[i].color,
    };
  }) as [TeamStyle, TeamStyle];
}

function sanitizeFormationId(v: unknown, format: MatchFormat): string {
  return typeof v === "string" && FORMATION_BY_ID[v]?.format === format ? v : DEFAULT_FORMATIONS[format];
}

export function sanitizeSettings(v: unknown): Settings {
  const d = createDefaultSettings();
  if (!isObj(v)) return d;
  const defaultFormat = isFormat(v.defaultFormat) ? v.defaultFormat : d.defaultFormat;
  const df = isObj(v.defaultFormations) ? v.defaultFormations : {};
  return {
    weights: sanitizeWeights(v.weights),
    defaultFormat,
    defaultFormations: {
      5: sanitizeFormationId(df[5], 5),
      6: sanitizeFormationId(df[6], 6),
      7: sanitizeFormationId(df[7], 7),
      8: sanitizeFormationId(df[8], 8),
    },
    teamStyles: sanitizeTeamStyles(v.teamStyles, d.teamStyles),
  };
}

function sanitizeConstraint(v: unknown, ids: Set<string>): Constraint | null {
  if (!isObj(v) || typeof v.id !== "string") return null;
  if ((v.type === "together" || v.type === "apart") && typeof v.a === "string" && typeof v.b === "string") {
    if (!ids.has(v.a) || !ids.has(v.b) || v.a === v.b) return null;
    return { id: v.id, type: v.type, a: v.a, b: v.b };
  }
  if (v.type === "position" && typeof v.playerId === "string" && ids.has(v.playerId) && isPosition(v.position)) {
    return { id: v.id, type: "position", playerId: v.playerId, position: v.position };
  }
  return null;
}

function sanitizeBuilder(v: unknown, settings: Settings, ids: Set<string>): BuilderState {
  const d = createDefaultBuilder(settings);
  if (!isObj(v)) return d;
  const format = isFormat(v.format) ? v.format : d.format;
  const f = Array.isArray(v.formations) ? v.formations : [];
  const idList = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((id): id is string => typeof id === "string" && ids.has(id)))] : []);
  return {
    selectedIds: idList(v.selectedIds),
    knownIds: idList(v.knownIds),
    format,
    formations: [sanitizeFormationId(f[0], format), sanitizeFormationId(f[1], format)],
    extraMode: v.extraMode === "rotate" ? "rotate" : "bench",
    benchIds: idList(v.benchIds),
    rotatingKeeper: v.rotatingKeeper === true,
    constraints: Array.isArray(v.constraints)
      ? v.constraints.map((c) => sanitizeConstraint(c, ids)).filter((c): c is Constraint => c !== null)
      : [],
    teamStyles: sanitizeTeamStyles(v.teamStyles, settings.teamStyles),
    // Hesaplanmış kadrolar oyuncu verisine bağlı; geçici kabul edilir ve
    // yüklemede güvenle sıfırlanır.
    alternatives: [],
    activeAlternative: 0,
    seed: Math.round(num(v.seed, 1)),
  };
}

function sanitizeMatchTeam(v: unknown, fallback: TeamStyle): MatchTeam | null {
  if (!isObj(v) || !Array.isArray(v.players)) return null;
  const players = v.players
    .filter(isObj)
    .map((p) => ({
      playerId: String(p.playerId ?? ""),
      name: str(p.name, 40) ?? "?",
      position: (isPosition(p.position) ? p.position : "YDK") as Position | "YDK",
      rating: clampAttr(num(p.rating, 50)),
    }))
    .filter((p) => p.playerId);
  return {
    name: str(v.name, 24) ?? fallback.name,
    color: isColor(v.color) ? v.color : fallback.color,
    formationId: typeof v.formationId === "string" ? v.formationId : "",
    players,
    total: num(v.total, 0),
    average: num(v.average, 0),
  };
}

export function sanitizeMatch(v: unknown): Match | null {
  if (!isObj(v) || typeof v.id !== "string" || !Array.isArray(v.teams) || v.teams.length !== 2) return null;
  const a = sanitizeMatchTeam(v.teams[0], DEFAULT_TEAM_STYLES[0]);
  const b = sanitizeMatchTeam(v.teams[1], DEFAULT_TEAM_STYLES[1]);
  if (!a || !b) return null;
  const score =
    isObj(v.score) && typeof v.score.a === "number" && typeof v.score.b === "number"
      ? { a: Math.max(0, Math.min(99, Math.round(v.score.a))), b: Math.max(0, Math.min(99, Math.round(v.score.b))) }
      : null;
  const date = typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : new Date().toISOString().slice(0, 10);
  return {
    id: v.id,
    date,
    format: isFormat(v.format) ? v.format : 7,
    rotatingKeeper: v.rotatingKeeper === true,
    teams: [a, b],
    out: Array.isArray(v.out) ? v.out.filter((x): x is string => typeof x === "string") : [],
    balance: num(v.balance, 0),
    score,
    mvpId: typeof v.mvpId === "string" ? v.mvpId : undefined,
    note: str(v.note, 280),
    createdAt: num(v.createdAt, Date.now()),
  };
}

function uniqueBy<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/** Herhangi bir girdiyi geçerli, güncel sürüm `KarmaData`'ya dönüştürür. */
export function sanitizeData(input: unknown): KarmaData {
  if (!isObj(input)) throw new KarmaImportError("Veri biçimi tanınmadı.");
  // Göçler: sürüm arttıkça burada adım adım dönüştürülür.
  const players = uniqueBy(
    (Array.isArray(input.players) ? input.players : []).map(sanitizePlayer).filter((p): p is Player => p !== null),
  );
  const matches = uniqueBy(
    (Array.isArray(input.matches) ? input.matches : []).map(sanitizeMatch).filter((m): m is Match => m !== null),
  );
  const settings = sanitizeSettings(input.settings);
  const ids = new Set(players.map((p) => p.id));
  return {
    version: DATA_VERSION,
    players,
    matches,
    settings,
    builder: sanitizeBuilder(input.builder, settings, ids),
  };
}

export class KarmaImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KarmaImportError";
  }
}

// ---------------------------------------------------------------------------
// JSON dışa / içe aktarma
// ---------------------------------------------------------------------------

export function exportJson(data: KarmaData): string {
  const { builder, ...rest } = data;
  return JSON.stringify({ app: "karma", exportedAt: new Date().toISOString(), ...rest, builder: { ...builder, alternatives: [] } }, null, 2);
}

export function importJson(text: string): KarmaData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new KarmaImportError("Dosya geçerli bir JSON değil.");
  }
  if (!isObj(parsed) || !Array.isArray(parsed.players)) {
    throw new KarmaImportError("Bu dosya bir Karma yedeği gibi görünmüyor.");
  }
  return sanitizeData(parsed);
}

/** Gelen veriyi mevcut veriyle birleştirir: aynı id'de daha yeni olan kazanır. */
export function mergeData(current: KarmaData, incoming: KarmaData): KarmaData {
  const players = new Map(current.players.map((p) => [p.id, p]));
  for (const p of incoming.players) {
    const existing = players.get(p.id);
    if (!existing || p.updatedAt >= existing.updatedAt) players.set(p.id, p);
  }
  const matches = new Map(current.matches.map((m) => [m.id, m]));
  for (const m of incoming.matches) if (!matches.has(m.id)) matches.set(m.id, m);
  return {
    ...current,
    players: [...players.values()],
    matches: [...matches.values()].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Link ile paylaşım: veri sıkıştırılıp URL'in hash kısmına konur (sunucuya
// hiç gitmez). Oyuncular kompakt dizi biçiminde kodlanır.
// ---------------------------------------------------------------------------

export const SHARE_PREFIX = "k1.";

type CompactPlayer = [
  id: string,
  name: string,
  nickname: string,
  avatar: string,
  primary: Position,
  alt: string,
  foot: Foot,
  active: 0 | 1,
  attrs: number[],
  gk: number[] | 0,
  mode: "q" | "d",
];

export interface SharePayload {
  players: Player[];
  matches: Match[];
  weights?: Weights;
}

export interface ShareOptions {
  includePhotos?: boolean;
  includeMatches?: boolean;
  includeWeights?: boolean;
}

export function encodeShare(data: Pick<KarmaData, "players" | "matches" | "settings">, opts: ShareOptions = {}): string {
  const p: CompactPlayer[] = data.players.map((pl) => [
    pl.id,
    pl.name,
    pl.nickname ?? "",
    pl.avatar.type === "emoji" ? pl.avatar.value : opts.includePhotos ? pl.avatar.dataUrl : "",
    pl.primaryPosition,
    pl.altPositions.join(","),
    pl.foot,
    pl.active ? 1 : 0,
    SUB_ATTRS.map((k) => pl.attributes[k]),
    pl.goalkeeping ? GK_ATTRS.map((k) => pl.goalkeeping![k]) : 0,
    pl.inputMode === "quick" ? "q" : "d",
  ]);
  const payload: Obj = { v: 1, p };
  if (opts.includeMatches) payload.m = data.matches;
  if (opts.includeWeights) payload.w = data.settings.weights;
  return SHARE_PREFIX + compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeShare(encoded: string): SharePayload {
  const body = encoded.startsWith("#") ? encoded.slice(1) : encoded;
  if (!body.startsWith(SHARE_PREFIX)) throw new KarmaImportError("Paylaşım linki tanınmadı.");
  const json = decompressFromEncodedURIComponent(body.slice(SHARE_PREFIX.length));
  if (!json) throw new KarmaImportError("Paylaşım linki bozuk veya eksik kopyalanmış.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new KarmaImportError("Paylaşım linki bozuk veya eksik kopyalanmış.");
  }
  if (!isObj(parsed) || !Array.isArray(parsed.p)) throw new KarmaImportError("Paylaşım linkinde oyuncu bulunamadı.");
  const now = Date.now();
  const players = parsed.p
    .map((row): Player | null => {
      if (!Array.isArray(row)) return null;
      const [id, name, nickname, avatar, primary, alt, foot, active, attrs, gk, mode] = row as CompactPlayer;
      return sanitizePlayer({
        id,
        name,
        nickname,
        avatar:
          typeof avatar === "string" && avatar.startsWith("data:image/")
            ? { type: "photo", dataUrl: avatar }
            : { type: "emoji", value: avatar || "⚽" },
        primaryPosition: primary,
        altPositions: typeof alt === "string" && alt ? alt.split(",") : [],
        foot,
        active: active === 1,
        attributes: Array.isArray(attrs) ? Object.fromEntries(SUB_ATTRS.map((k, i) => [k, attrs[i]])) : undefined,
        goalkeeping: Array.isArray(gk) ? Object.fromEntries(GK_ATTRS.map((k, i) => [k, gk[i]])) : undefined,
        inputMode: mode === "q" ? "quick" : "detailed",
        createdAt: now,
        updatedAt: now,
      });
    })
    .filter((p): p is Player => p !== null);
  const matches = Array.isArray(parsed.m) ? parsed.m.map(sanitizeMatch).filter((m): m is Match => m !== null) : [];
  return {
    players: uniqueBy(players),
    matches: uniqueBy(matches),
    weights: parsed.w ? sanitizeWeights(parsed.w) : undefined,
  };
}
