// Karma veri modeli. Tüm tipler saf veri — UI ve depolama katmanından bağımsız.

export const POSITIONS = ["KL", "DEF", "OS", "KNT", "FV"] as const;
export type Position = (typeof POSITIONS)[number];

export const OUTFIELD_POSITIONS = ["DEF", "OS", "KNT", "FV"] as const;
export type OutfieldPosition = (typeof OUTFIELD_POSITIONS)[number];

export type Foot = "sag" | "sol" | "ikisi";

export const MAIN_ATTRS = ["hiz", "sut", "pas", "dri", "def", "fiz"] as const;
export type MainAttr = (typeof MAIN_ATTRS)[number];

export const SUB_ATTRS = [
  "hizlanma",
  "sprint",
  "bitiricilik",
  "sutGucu",
  "uzaktanSut",
  "kisaPas",
  "uzunPas",
  "vizyon",
  "topKontrolu",
  "ceviklik",
  "topSurme",
  "topKapma",
  "markaj",
  "pasArasi",
  "kafa",
  "dayaniklilik",
  "guc",
  "agresiflik",
] as const;
export type SubAttr = (typeof SUB_ATTRS)[number];

export const GK_ATTRS = ["ucus", "topTutma", "refleks", "pozisyonAlma", "oyunKurma"] as const;
export type GkAttr = (typeof GK_ATTRS)[number];

export type SubAttributes = Record<SubAttr, number>;
export type GkAttributes = Record<GkAttr, number>;
export type MainAttributes = Record<MainAttr, number>;

export type Avatar = { type: "emoji"; value: string } | { type: "photo"; dataUrl: string };

export type InputMode = "quick" | "detailed";

export interface Player {
  id: string;
  name: string;
  nickname?: string;
  avatar: Avatar;
  primaryPosition: Position;
  /** En fazla 2 alternatif mevki. */
  altPositions: Position[];
  foot: Foot;
  /** Bu hafta geliyor mu? */
  active: boolean;
  attributes: SubAttributes;
  /** Yalnızca KL olan veya kaleye geçebilen oyuncular için. */
  goalkeeping?: GkAttributes;
  inputMode: InputMode;
  createdAt: number;
  updatedAt: number;
}

/** Dış saha mevkileri için 6 ana özellik ağırlığı (toplam 100). */
export type OutfieldWeights = Record<MainAttr, number>;

export interface Weights {
  DEF: OutfieldWeights;
  OS: OutfieldWeights;
  KNT: OutfieldWeights;
  FV: OutfieldWeights;
  /** Kalecilik alt özelliklerinin ağırlıkları (toplam 100). */
  KL: Record<GkAttr, number>;
  /** KL genel puanına eklenen PAS etkisi (yüzde). */
  klPassShare: number;
}

export type MatchFormat = 5 | 6 | 7 | 8;

export interface FormationSlot {
  id: string;
  position: Position;
  /** 0 = sol, 100 = sağ */
  x: number;
  /** 0 = kendi kalesi, 100 = orta çizgi */
  y: number;
}

export interface Formation {
  id: string;
  name: string;
  format: MatchFormat;
  slots: FormationSlot[];
}

export type ExtraMode = "bench" | "rotate";

export type Constraint =
  | { id: string; type: "together"; a: string; b: string }
  | { id: string; type: "apart"; a: string; b: string }
  | { id: string; type: "position"; playerId: string; position: Position };

export interface TeamLineup {
  formationId: string;
  /** Diziliş slotu başına oyuncu id'si (slot sırası diziliştekiyle aynı). */
  slots: (string | null)[];
  /** Dönüşümlü oynayan yedekler. */
  subs: string[];
}

export interface Lineup {
  id: string;
  teams: [TeamLineup, TeamLineup];
  /** Bu maç oynamayan (yedek kalan) oyuncular. */
  out: string[];
}

export interface TeamStyle {
  name: string;
  color: string;
}

export interface MatchPlayerSnapshot {
  playerId: string;
  name: string;
  position: Position | "YDK";
  rating: number;
}

export interface MatchTeam extends TeamStyle {
  formationId: string;
  players: MatchPlayerSnapshot[];
  total: number;
  average: number;
}

export interface Match {
  id: string;
  /** ISO tarih (yyyy-mm-dd) */
  date: string;
  format: MatchFormat;
  rotatingKeeper: boolean;
  teams: [MatchTeam, MatchTeam];
  out: string[];
  balance: number;
  score: { a: number; b: number } | null;
  mvpId?: string;
  note?: string;
  createdAt: number;
}

export interface Settings {
  weights: Weights;
  defaultFormat: MatchFormat;
  /** Format başına varsayılan diziliş id'si. */
  defaultFormations: Record<MatchFormat, string>;
  teamStyles: [TeamStyle, TeamStyle];
}

export interface BuilderState {
  selectedIds: string[];
  /** Seçim listesi en son hangi oyunculara göre oluşturuldu (yeni eklenen aktifleri otomatik seçmek için). */
  knownIds: string[];
  format: MatchFormat;
  formations: [string, string];
  extraMode: ExtraMode;
  rotatingKeeper: boolean;
  constraints: Constraint[];
  teamStyles: [TeamStyle, TeamStyle];
  alternatives: Lineup[];
  activeAlternative: number;
  seed: number;
}

export interface KarmaData {
  version: number;
  players: Player[];
  matches: Match[];
  settings: Settings;
  builder: BuilderState;
}
