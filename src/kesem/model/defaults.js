// Hazır varsayılanlar. İkon/renk adları ui/icons.js ve kesem.css'teki
// `--kc-<renk>` değişkenlerine karşılık gelir (renk kodu burada YOK).
import { DEFAULT_CURRENCY } from "./schema";

const t = 0;
const mk = (id, kind, name, icon, color, order, parentId = null) => ({
  id, kind, name, icon, color, parentId, order, builtin: true, createdAt: t, updatedAt: t, deletedAt: null,
});

const EXPENSE = [
  ["market", "Market", "basket", "mint", ["Manav", "Şarküteri", "Temizlik", "Kuruyemiş"]],
  ["yeme", "Yeme-İçme", "utensils", "coral", ["Kahve", "Restoran", "Fast food", "Tatlı", "Paket servis"]],
  ["ulasim", "Ulaşım", "bus", "sky", ["Toplu taşıma", "Taksi", "Akaryakıt", "Otopark"]],
  ["fatura", "Fatura", "receipt", "amber", ["Elektrik", "Su", "Doğalgaz", "İnternet", "Telefon"]],
  ["kozmetik", "Kozmetik", "sparkles", "rose", ["Makyaj", "Cilt bakımı", "Kuaför", "Parfüm"]],
  ["giyim", "Giyim", "shirt", "violet", ["Giysi", "Ayakkabı", "Aksesuar"]],
  ["saglik", "Sağlık", "heart-pulse", "teal", ["Eczane", "Doktor", "Diş"]],
  ["eglence", "Eğlence", "clapperboard", "indigo", ["Sinema", "Abonelik", "Konser", "Oyun"]],
  ["hediye", "Hediye", "gift", "plum", []],
  ["ev", "Ev", "sofa", "stone", ["Mobilya", "Dekorasyon", "Tamir"]],
  ["egitim", "Eğitim", "graduation", "blue", []],
  ["teknoloji", "Teknoloji", "smartphone", "slate", []],
  ["seyahat", "Seyahat", "plane", "lime", []],
  ["evcil", "Evcil Hayvan", "paw", "amber", []],
  ["diger", "Diğer", "dots", "stone", []],
];

const INCOME = [
  ["maas", "Maaş", "briefcase", "mint"],
  ["harclik", "Harçlık", "wallet", "sky"],
  ["hediye-gelir", "Hediye", "gift", "plum"],
  ["ek-gelir", "Ek Gelir", "trending", "teal"],
  ["iade", "İade", "undo", "amber"],
  ["diger-gelir", "Diğer", "dots", "stone"],
];

export function buildDefaultCategories() {
  const out = [];
  EXPENSE.forEach(([key, name, icon, color, subs], i) => {
    const id = `cat-${key}`;
    out.push(mk(id, "expense", name, icon, color, i));
    subs.forEach((s, j) => out.push(mk(`${id}-${j}`, "expense", s, icon, color, j, id)));
  });
  INCOME.forEach(([key, name, icon, color], i) => out.push(mk(`cat-${key}`, "income", name, icon, color, i)));
  return out;
}

export function buildDefaultAccounts() {
  return [
    { id: "acc-nakit", type: "cash", name: "Nakit", color: "mint", order: 0, builtin: true, createdAt: t, updatedAt: t, deletedAt: null },
    { id: "acc-kart", type: "card", name: "Kart", color: "indigo", order: 1, builtin: true, createdAt: t, updatedAt: t, deletedAt: null },
  ];
}

// Menüdeki "sık harcama" fikirleri — fiyat UYDURMAYIZ; dokununca kullanıcı
// kendi tutarını girerek kısayol oluşturur.
export const STARTER_IDEAS = [
  { name: "Kahve", kind: "expense", categoryId: "cat-yeme", subcategoryId: "cat-yeme-0", icon: "coffee" },
  { name: "Simit", kind: "expense", categoryId: "cat-yeme", subcategoryId: null, icon: "utensils" },
  { name: "Toplu taşıma", kind: "expense", categoryId: "cat-ulasim", subcategoryId: "cat-ulasim-0", icon: "bus" },
];

export const CURRENCY = DEFAULT_CURRENCY;
