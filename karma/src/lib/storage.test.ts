import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS } from "./constants";
import { createSamplePlayers } from "./sample-data";
import {
  createDefaultData,
  createLocalStorage,
  createMemoryStorage,
  decodeShare,
  encodeShare,
  exportJson,
  importJson,
  KarmaImportError,
  mergeData,
  sanitizeData,
  sanitizePlayer,
} from "./storage";

function fakeLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

function sampleData() {
  const data = createDefaultData();
  data.players = createSamplePlayers(1000);
  return data;
}

describe("depolama adaptörleri", () => {
  it("localStorage adaptörü kaydeder ve geri yükler", async () => {
    const storage = createLocalStorage("test", fakeLocalStorage());
    expect(await storage.load()).toBeNull();
    const data = sampleData();
    await storage.save(data);
    const loaded = await storage.load();
    expect(loaded?.players).toEqual(data.players);
    await storage.clear();
    expect(await storage.load()).toBeNull();
  });

  it("bozuk localStorage verisinde çökmez", async () => {
    const ls = fakeLocalStorage();
    ls.setItem("test", "{bozuk json");
    expect(await createLocalStorage("test", ls).load()).toBeNull();
  });

  it("bellek adaptörü veriyi kopyalayarak saklar", async () => {
    const storage = createMemoryStorage();
    const data = sampleData();
    await storage.save(data);
    data.players[0].name = "Değişti";
    expect((await storage.load())?.players[0].name).not.toBe("Değişti");
  });
});

describe("doğrulama", () => {
  it("geçersiz değerleri düzeltir", () => {
    const p = sanitizePlayer({
      id: "x",
      name: "  Ali  ",
      primaryPosition: "XX",
      altPositions: ["DEF", "DEF", "FV", "KNT", "OS"],
      attributes: { hizlanma: 150, sprint: -3 },
      foot: "?",
    });
    expect(p?.name).toBe("Ali");
    expect(p?.primaryPosition).toBe("OS");
    expect(p?.altPositions).toEqual(["DEF", "FV"]);
    expect(p?.attributes.hizlanma).toBe(99);
    expect(p?.attributes.sprint).toBe(1);
    expect(p?.foot).toBe("sag");
  });

  it("isimsiz oyuncuyu reddeder", () => {
    expect(sanitizePlayer({ id: "x", name: "   " })).toBeNull();
    expect(sanitizePlayer(null)).toBeNull();
  });

  it("toplamı 100 olmayan ağırlıkları varsayılana döndürür", () => {
    const data = sanitizeData({ players: [], settings: { weights: { DEF: { hiz: 90, sut: 90, pas: 0, dri: 0, def: 0, fiz: 0 } } } });
    expect(data.settings.weights.DEF).toEqual(DEFAULT_WEIGHTS.DEF);
  });

  it("silinmiş oyunculara ait kısıtları temizler", () => {
    const data = sanitizeData({
      players: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      builder: {
        constraints: [
          { id: "1", type: "together", a: "a", b: "b" },
          { id: "2", type: "apart", a: "a", b: "silinmis" },
          { id: "3", type: "position", playerId: "a", position: "KL" },
        ],
      },
    });
    expect(data.builder.constraints.map((c) => c.id)).toEqual(["1", "3"]);
  });
});

describe("JSON dışa/içe aktarma", () => {
  it("gidiş-dönüş veriyi korur", () => {
    const data = sampleData();
    const back = importJson(exportJson(data));
    expect(back.players).toEqual(data.players);
    expect(back.settings).toEqual(data.settings);
  });

  it("geçersiz dosyada anlaşılır hata verir", () => {
    expect(() => importJson("merhaba")).toThrow(KarmaImportError);
    expect(() => importJson('{"foo": 1}')).toThrow(/Karma yedeği/);
  });
});

describe("link ile paylaşım", () => {
  it("oyuncuları sıkıştırıp URL güvenli metne çevirir ve geri açar", () => {
    const data = sampleData();
    const code = encodeShare(data);
    expect(code).toMatch(/^k1\.[A-Za-z0-9+\-$]+$/);
    // 14 oyuncu kısa bir linke sığmalı
    expect(code.length).toBeLessThan(3000);
    const decoded = decodeShare(code);
    expect(decoded.players.map((p) => p.attributes)).toEqual(data.players.map((p) => p.attributes));
    expect(decoded.players.map((p) => p.goalkeeping)).toEqual(data.players.map((p) => p.goalkeeping));
    expect(decoded.players.map((p) => p.name)).toEqual(data.players.map((p) => p.name));
  });

  it("fotoğrafları varsayılan olarak linke koymaz", () => {
    const data = sampleData();
    data.players[0].avatar = { type: "photo", dataUrl: "data:image/jpeg;base64," + "A".repeat(5000) };
    expect(decodeShare(encodeShare(data)).players[0].avatar.type).toBe("emoji");
    expect(decodeShare(encodeShare(data, { includePhotos: true })).players[0].avatar.type).toBe("photo");
  });

  it("isteğe bağlı olarak ağırlıkları taşır", () => {
    const data = sampleData();
    data.settings.weights.FV = { hiz: 10, sut: 50, pas: 10, dri: 20, def: 0, fiz: 10 };
    expect(decodeShare(encodeShare(data, { includeWeights: true })).weights?.FV).toEqual(data.settings.weights.FV);
    expect(decodeShare(encodeShare(data)).weights).toBeUndefined();
  });

  it("bozuk linkte hata verir", () => {
    expect(() => decodeShare("k1.bozuk!!")).toThrow(KarmaImportError);
    expect(() => decodeShare("baska-bir-sey")).toThrow(KarmaImportError);
  });
});

describe("birleştirme", () => {
  it("aynı id'de daha yeni olan kazanır, yeni oyuncular eklenir", () => {
    const current = sampleData();
    const incoming = sampleData();
    incoming.players[0] = { ...incoming.players[0], name: "Yeni İsim", updatedAt: 99999 };
    incoming.players.push({ ...incoming.players[1], id: "yeni", name: "Yeni Oyuncu" });
    current.players[1] = { ...current.players[1], name: "Yerel Değişiklik", updatedAt: 99999 };
    const merged = mergeData(current, incoming);
    expect(merged.players).toHaveLength(15);
    expect(merged.players.find((p) => p.id === incoming.players[0].id)?.name).toBe("Yeni İsim");
    expect(merged.players.find((p) => p.id === current.players[1].id)?.name).toBe("Yerel Değişiklik");
  });
});
