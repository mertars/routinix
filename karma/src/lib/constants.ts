import type {
  Foot,
  Formation,
  GkAttr,
  MainAttr,
  MatchFormat,
  Position,
  SubAttr,
  TeamStyle,
  Weights,
} from "./types";

export const POSITION_LABELS: Record<Position, string> = {
  KL: "Kaleci",
  DEF: "Defans",
  OS: "Orta saha",
  KNT: "Kanat",
  FV: "Forvet",
};

/**
 * Mevkiye özel kimlik rengi (rozetler, sahadaki mini kartlar). Koyu zemin için
 * aynı açıklık bandında seçildi ve renk körlüğü ayrımı doğrulandı; renk hiçbir
 * zaman tek başına bilgi taşımaz — yanında her zaman mevki kısaltması yazar.
 */
export const POSITION_COLORS: Record<Position, string> = {
  KL: "#bd8706",
  DEF: "#149ed8",
  OS: "#04af5d",
  KNT: "#ac72e4",
  FV: "#ec5a5c",
};

export const MAIN_ATTR_LABELS: Record<MainAttr, string> = {
  hiz: "Hız",
  sut: "Şut",
  pas: "Pas",
  dri: "Dripling",
  def: "Defans",
  fiz: "Fizik",
};

export const MAIN_ATTR_SHORT: Record<MainAttr, string> = {
  hiz: "HIZ",
  sut: "ŞUT",
  pas: "PAS",
  dri: "DRİ",
  def: "DEF",
  fiz: "FİZ",
};

export const ATTR_GROUPS: Record<MainAttr, SubAttr[]> = {
  hiz: ["hizlanma", "sprint"],
  sut: ["bitiricilik", "sutGucu", "uzaktanSut"],
  pas: ["kisaPas", "uzunPas", "vizyon"],
  dri: ["topKontrolu", "ceviklik", "topSurme"],
  def: ["topKapma", "markaj", "pasArasi", "kafa"],
  fiz: ["dayaniklilik", "guc", "agresiflik"],
};

export const SUB_ATTR_LABELS: Record<SubAttr, string> = {
  hizlanma: "Hızlanma",
  sprint: "Sprint hızı",
  bitiricilik: "Bitiricilik",
  sutGucu: "Şut gücü",
  uzaktanSut: "Uzaktan şut",
  kisaPas: "Kısa pas",
  uzunPas: "Uzun pas",
  vizyon: "Vizyon",
  topKontrolu: "Top kontrolü",
  ceviklik: "Çeviklik",
  topSurme: "Top sürme",
  topKapma: "Top kapma",
  markaj: "Markaj",
  pasArasi: "Pas arası",
  kafa: "Kafa",
  dayaniklilik: "Dayanıklılık",
  guc: "Güç",
  agresiflik: "Agresiflik",
};

export const GK_ATTR_LABELS: Record<GkAttr, string> = {
  ucus: "Uçuş",
  topTutma: "Top tutma",
  refleks: "Refleks",
  pozisyonAlma: "Pozisyon alma",
  oyunKurma: "Oyun kurma (ayakla)",
};

export const GK_ATTR_SHORT: Record<GkAttr, string> = {
  ucus: "UÇU",
  topTutma: "TUT",
  refleks: "REF",
  pozisyonAlma: "POZ",
  oyunKurma: "OYK",
};

export const FOOT_LABELS: Record<Foot, string> = {
  sag: "Sağ",
  sol: "Sol",
  ikisi: "İkisi",
};

export const DEFAULT_WEIGHTS: Weights = {
  DEF: { hiz: 15, sut: 3, pas: 12, dri: 5, def: 45, fiz: 20 },
  OS: { hiz: 10, sut: 12, pas: 35, dri: 20, def: 13, fiz: 10 },
  KNT: { hiz: 30, sut: 15, pas: 15, dri: 30, def: 3, fiz: 7 },
  FV: { hiz: 20, sut: 40, pas: 8, dri: 20, def: 2, fiz: 10 },
  KL: { refleks: 25, ucus: 20, pozisyonAlma: 20, topTutma: 20, oyunKurma: 15 },
  klPassShare: 15,
};

export const MATCH_FORMATS: MatchFormat[] = [5, 6, 7, 8];

export const TEAM_COLORS = [
  { value: "#ff8a1f", label: "Turuncu", emoji: "🟠" },
  { value: "#f4f7f5", label: "Beyaz", emoji: "⚪" },
  { value: "#3ef08a", label: "Neon yeşil", emoji: "🟢" },
  { value: "#4cc3ff", label: "Mavi", emoji: "🔵" },
  { value: "#ff4d6d", label: "Kırmızı", emoji: "🔴" },
  { value: "#ffd23f", label: "Sarı", emoji: "🟡" },
  { value: "#b184ff", label: "Mor", emoji: "🟣" },
  { value: "#1f2a24", label: "Siyah", emoji: "⚫" },
] as const;

export function teamColorEmoji(color: string): string {
  return TEAM_COLORS.find((c) => c.value.toLowerCase() === color.toLowerCase())?.emoji ?? "🔘";
}

export const POSITION_EMOJI: Record<Position, string> = { KL: "🧤", DEF: "🛡️", OS: "🧠", KNT: "⚡", FV: "🎯" };

export const DEFAULT_TEAM_STYLES: [TeamStyle, TeamStyle] = [
  { name: "Yelekliler", color: "#ff8a1f" },
  { name: "Yeleksizler", color: "#f4f7f5" },
];

export const AVATAR_EMOJIS = [
  "⚽", "🦁", "🐺", "🦅", "🐯", "🦊", "🐂", "🦈", "🐉", "🦍",
  "🔥", "⚡", "🚀", "🎯", "🧱", "🧤", "👑", "🌪️", "💎", "🛡️",
  "😎", "🤠", "🥷", "🧙", "🤖", "👽", "🦸", "🐐", "🍀", "⭐",
];

// ---------------------------------------------------------------------------
// Dizilişler. y: 0 = kendi kalemiz, 100 = orta çizgi. x: 0 sol, 100 sağ.
// ---------------------------------------------------------------------------

type SlotSpec = [Position, number, number];

function formation(format: MatchFormat, name: string, specs: SlotSpec[]): Formation {
  return {
    id: `${format}:${name}`,
    name,
    format,
    slots: specs.map(([position, x, y], i) => ({ id: `${position}${i}`, position, x, y })),
  };
}

const GK: SlotSpec = ["KL", 50, 9];

export const FORMATIONS: Formation[] = [
  // 5v5
  formation(5, "1-2-1-1", [GK, ["DEF", 28, 34], ["DEF", 72, 34], ["OS", 50, 58], ["FV", 50, 84]]),
  formation(5, "1-1-2-1", [GK, ["DEF", 50, 32], ["KNT", 20, 60], ["KNT", 80, 60], ["FV", 50, 84]]),
  formation(5, "1-2-2", [GK, ["DEF", 28, 36], ["DEF", 72, 36], ["FV", 30, 78], ["FV", 70, 78]]),
  // 6v6
  formation(6, "1-2-2-1", [GK, ["DEF", 28, 32], ["DEF", 72, 32], ["OS", 28, 58], ["OS", 72, 58], ["FV", 50, 85]]),
  formation(6, "1-2-1-2", [GK, ["DEF", 28, 32], ["DEF", 72, 32], ["OS", 50, 56], ["FV", 28, 82], ["FV", 72, 82]]),
  formation(6, "1-3-2", [GK, ["DEF", 18, 34], ["DEF", 50, 30], ["DEF", 82, 34], ["FV", 30, 76], ["FV", 70, 76]]),
  formation(6, "1-2-3", [GK, ["DEF", 28, 34], ["DEF", 72, 34], ["KNT", 16, 72], ["FV", 50, 80], ["KNT", 84, 72]]),
  // 7v7
  formation(7, "1-2-3-1", [
    GK, ["DEF", 28, 30], ["DEF", 72, 30], ["KNT", 14, 58], ["OS", 50, 54], ["KNT", 86, 58], ["FV", 50, 85],
  ]),
  formation(7, "1-3-2-1", [
    GK, ["DEF", 16, 32], ["DEF", 50, 28], ["DEF", 84, 32], ["OS", 30, 58], ["OS", 70, 58], ["FV", 50, 85],
  ]),
  formation(7, "1-2-2-2", [
    GK, ["DEF", 28, 30], ["DEF", 72, 30], ["OS", 28, 55], ["OS", 72, 55], ["FV", 30, 83], ["FV", 70, 83],
  ]),
  formation(7, "1-3-3", [
    GK, ["DEF", 16, 32], ["DEF", 50, 28], ["DEF", 84, 32], ["KNT", 16, 72], ["FV", 50, 80], ["KNT", 84, 72],
  ]),
  // 8v8
  formation(8, "1-3-3-1", [
    GK, ["DEF", 16, 30], ["DEF", 50, 26], ["DEF", 84, 30], ["KNT", 14, 58], ["OS", 50, 54], ["KNT", 86, 58], ["FV", 50, 86],
  ]),
  formation(8, "1-2-3-2", [
    GK, ["DEF", 28, 28], ["DEF", 72, 28], ["KNT", 14, 55], ["OS", 50, 52], ["KNT", 86, 55], ["FV", 32, 83], ["FV", 68, 83],
  ]),
  formation(8, "1-3-2-2", [
    GK, ["DEF", 16, 30], ["DEF", 50, 26], ["DEF", 84, 30], ["OS", 30, 55], ["OS", 70, 55], ["FV", 32, 83], ["FV", 68, 83],
  ]),
  formation(8, "1-2-4-1", [
    GK, ["DEF", 28, 28], ["DEF", 72, 28], ["KNT", 12, 58], ["OS", 36, 52], ["OS", 64, 52], ["KNT", 88, 58], ["FV", 50, 86],
  ]),
];

export const FORMATION_BY_ID: Record<string, Formation> = Object.fromEntries(
  FORMATIONS.map((f) => [f.id, f]),
);

export function formationsFor(format: MatchFormat): Formation[] {
  return FORMATIONS.filter((f) => f.format === format);
}

export const DEFAULT_FORMATIONS: Record<MatchFormat, string> = {
  5: "5:1-2-1-1",
  6: "6:1-2-2-1",
  7: "7:1-2-3-1",
  8: "8:1-3-3-1",
};

export function getFormation(id: string, format?: MatchFormat): Formation {
  const f = FORMATION_BY_ID[id];
  if (f && (format === undefined || f.format === format)) return f;
  return FORMATION_BY_ID[DEFAULT_FORMATIONS[format ?? 7]];
}

/** Hat grupları: dengeleme ve karşılaştırma için. */
export const LINE_OF: Record<Position, "KL" | "DEF" | "OS" | "FV"> = {
  KL: "KL",
  DEF: "DEF",
  OS: "OS",
  KNT: "OS",
  FV: "FV",
};

export const LINE_LABELS = { KL: "Kaleci", DEF: "Defans hattı", OS: "Orta saha", FV: "Hücum" } as const;
