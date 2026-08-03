// Routinix Nexus — hazır kapak kütüphanesi. Kullanıcının kalitesiz/telifsiz
// görsel yüklemesini önlemek için 30 adet SAF CSS "mesh gradient" — dışarıdan
// TEK BİR görsel/ağ isteği YOK, bu yüzden asla kırılamaz/boş kalamaz.
//
// TASARIM NOTU (neon mesh, eski monokrom paletin YERİNE): İlk sürüm saf
// siyah/beyaz/zinc gradyanlardı ("Apple minimalist" modül kimliği) — ama
// modül "Routinix Nexus"a (koyu lacivert #080d1a zemin + mor/cyan/zümrüt
// ambient ışık) geçince o gradyanların çoğu zeminle neredeyse AYNI koyulukta
// kalıp "kapak yok/yüklenmiyor" hissi veriyordu. Şimdi her kapak, kategorinin
// neon aksan rengiyle (BackgroundScene.jsx'teki GLOW_BY_CATEGORY ile AYNI
// palet — modül genelinde tutarlı) kurulu, koyu lacivert zemin üzerine
// bindirilmiş 2 katmanlı radial-gradient bir "mesh" — blur filtresi YOK
// (yalnızca statik renk durakları), bu yüzden GPU'ya tek seferlik ucuz bir
// paint'ten fazlasına mal olmaz.
//
// GERİYE DÖNÜK UYUMLULUK: id'ler (mono-01..mono-30) DEĞİŞMEDİ — halihazırda
// veritabanında seed edilmiş `templates.cover_url` değerleri (bkz.
// supabase/seed_nexus_data.sql) hâlâ geçerli, hiçbir migrasyon gerekmez.
const GLOW = {
  software: { a: "#B26BFF", b: "#6E7BFF" },
  fitness: { a: "#F4406B", b: "#FB923C" },
  vacation: { a: "#2ED9A3", b: "#22D3EE" },
  general: { a: "#7DA2FF", b: "#64748B" },
};

const BASE = "linear-gradient(160deg, #10192c 0%, #080d1a 100%)";

function mesh(category, posA, posB, strongA = "66", strongB = "4a") {
  const { a, b } = GLOW[category];
  return `radial-gradient(circle at ${posA}, ${a}${strongA} 0%, transparent 55%), radial-gradient(circle at ${posB}, ${b}${strongB} 0%, transparent 60%), ${BASE}`;
}

const POSITIONS = [
  ["15% 15%", "85% 85%"],
  ["85% 10%", "10% 90%"],
  ["50% 0%", "50% 100%"],
  ["5% 50%", "95% 50%"],
  ["20% 85%", "85% 15%"],
  ["30% 25%", "80% 75%"],
  ["70% 20%", "20% 80%"],
  ["40% 10%", "65% 90%"],
];

const NAMES = {
  software: ["Sıfır Ufuk", "Devre Işığı", "Kod Nabzı", "Terminal Gecesi", "Yığın İzi", "Derleme Anı", "Sinyal Akışı", "Fonksiyon Işığı"],
  fitness: ["Kas Hafızası", "Nabız Zirvesi", "Direnç Halkası", "Tempo Işığı", "Kalp Ritmi", "Güç Merkezi", "Antrenman Şafağı"],
  vacation: ["Derin Su", "Ufuk Çizgisi", "Rüzgar Rotası", "Kıyı Işığı", "Gökyüzü Rotası", "Deniz Feneri", "Yol Işıltısı"],
  general: ["Sabah Berraklığı", "Akış Hali", "Zihin Netliği", "Sessiz Odak", "Yörünge", "Berrak An", "Sakin Ufuk", "Açık Zihin"],
};

function buildCategoryCovers(category, count, idStart) {
  return Array.from({ length: count }, (_, i) => {
    const [posA, posB] = POSITIONS[i % POSITIONS.length];
    const variantStrength = i % 3 === 0 ? ["70", "50"] : i % 3 === 1 ? ["5c", "42"] : ["66", "48"];
    return {
      id: `mono-${String(idStart + i).padStart(2, "0")}`,
      label: NAMES[category][i % NAMES[category].length],
      category,
      style: mesh(category, posA, posB, variantStrength[0], variantStrength[1]),
    };
  });
}

export const PRESET_COVERS = [
  ...buildCategoryCovers("software", 8, 1),
  ...buildCategoryCovers("fitness", 7, 9),
  ...buildCategoryCovers("vacation", 7, 16),
  ...buildCategoryCovers("general", 8, 23),
];

// Kategoriye göre en uygun ilk kapağı döner — GuidedTemplateForm'da kategori
// seçilince kapak alanı otomatik dolsun diye (kullanıcı isterse kütüphaneden
// başka birini seçebilir).
export function coverForCategory(category) {
  return PRESET_COVERS.find((c) => c.category === category) || PRESET_COVERS[0];
}

export function coverById(id) {
  return PRESET_COVERS.find((c) => c.id === id) || PRESET_COVERS[0];
}
