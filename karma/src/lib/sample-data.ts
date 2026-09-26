// Örnek grup: farklı mevki ve seviyelerde 14 oyuncu (2 kaleci dahil).

import { ATTR_GROUPS } from "./constants";
import { clampAttr } from "./scoring";
import { MAIN_ATTRS, type Foot, type GkAttributes, type Player, type Position, type SubAttributes } from "./types";

type Main6 = [hiz: number, sut: number, pas: number, dri: number, def: number, fiz: number];

interface Seed {
  name: string;
  nickname?: string;
  emoji: string;
  primary: Position;
  alt?: Position[];
  foot: Foot;
  main: Main6;
  gk?: [ucus: number, topTutma: number, refleks: number, pozisyonAlma: number, oyunKurma: number];
}

// Grup içinde toplamı sıfır olan sapmalar: alt özellikler gerçekçi biçimde
// dağılır ama ortalamaları (yani ana özellik) girilen değerde kalır.
const OFFSETS: Record<number, number[][]> = {
  2: [[2, -2], [-3, 3], [1, -1], [4, -4]],
  3: [[3, -1, -2], [-2, 4, -2], [1, 1, -2], [-3, 0, 3]],
  4: [[2, -3, 3, -2], [-4, 2, 1, 1], [3, 1, -2, -2], [0, -2, 4, -2]],
};

function expand(main: Main6, variant: number): SubAttributes {
  const out = {} as SubAttributes;
  MAIN_ATTRS.forEach((key, i) => {
    const subs = ATTR_GROUPS[key];
    const pattern = OFFSETS[subs.length][(variant + i) % 4];
    subs.forEach((sub, j) => (out[sub] = clampAttr(main[i] + pattern[j])));
  });
  return out;
}

const SEEDS: Seed[] = [
  { name: "Oğuz Şahin", nickname: "Kedi", emoji: "🧤", primary: "KL", foot: "sag", main: [55, 40, 66, 50, 48, 72], gk: [84, 80, 88, 82, 72] },
  { name: "Serkan Çelik", emoji: "🛡️", primary: "KL", alt: ["DEF"], foot: "sol", main: [58, 42, 58, 50, 64, 75], gk: [70, 72, 74, 70, 64] },
  { name: "Burak Demir", nickname: "Duvar", emoji: "🧱", primary: "DEF", alt: ["OS"], foot: "sag", main: [68, 45, 70, 58, 88, 86] },
  { name: "Kerem Arslan", emoji: "🦁", primary: "DEF", foot: "sol", main: [74, 50, 64, 60, 76, 78] },
  { name: "Volkan Kurt", nickname: "Tank", emoji: "🐂", primary: "DEF", alt: ["FV"], foot: "sag", main: [60, 58, 55, 50, 72, 88] },
  { name: "Barış Erdem", emoji: "🐺", primary: "DEF", alt: ["OS"], foot: "sag", main: [55, 40, 56, 48, 64, 66] },
  { name: "Emre Yılmaz", nickname: "Kaptan", emoji: "👑", primary: "OS", alt: ["DEF"], foot: "ikisi", main: [72, 74, 88, 82, 70, 74] },
  { name: "Hakan Öztürk", nickname: "Hoca", emoji: "🧙", primary: "OS", alt: ["DEF"], foot: "sag", main: [58, 70, 80, 72, 66, 62] },
  { name: "Onur Polat", emoji: "🍀", primary: "OS", foot: "sol", main: [62, 58, 66, 64, 58, 60] },
  { name: "Mert Kaya", nickname: "Roket", emoji: "🚀", primary: "KNT", alt: ["FV"], foot: "sol", main: [93, 76, 72, 88, 38, 70] },
  { name: "Umut Koç", emoji: "⚡", primary: "KNT", alt: ["OS"], foot: "sag", main: [82, 64, 68, 76, 44, 60] },
  { name: "Cem Yıldız", nickname: "Genç", emoji: "🦊", primary: "KNT", alt: ["FV"], foot: "sag", main: [78, 55, 52, 66, 32, 50] },
  { name: "Can Aydın", nickname: "Golcü", emoji: "🎯", primary: "FV", foot: "sag", main: [84, 91, 70, 84, 35, 82] },
  { name: "Tolga Aksoy", emoji: "🔥", primary: "FV", alt: ["KNT"], foot: "ikisi", main: [72, 76, 60, 70, 30, 66] },
];

export function createSamplePlayers(now: number = Date.now()): Player[] {
  return SEEDS.map((seed, i) => {
    const gk: GkAttributes | undefined = seed.gk
      ? { ucus: seed.gk[0], topTutma: seed.gk[1], refleks: seed.gk[2], pozisyonAlma: seed.gk[3], oyunKurma: seed.gk[4] }
      : undefined;
    return {
      id: `ornek-${i + 1}`,
      name: seed.name,
      nickname: seed.nickname,
      avatar: { type: "emoji", value: seed.emoji },
      primaryPosition: seed.primary,
      altPositions: seed.alt ?? [],
      foot: seed.foot,
      active: true,
      attributes: expand(seed.main, i),
      goalkeeping: gk,
      inputMode: "detailed",
      createdAt: now + i,
      updatedAt: now + i,
    };
  });
}
