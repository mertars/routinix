// Arama ve filtre — SAF. Tutar aralığı ₺ karşılığına göre.
import { startOfDay, trLower } from "./dates";
import { baseOf } from "./money";

export const emptyFilter = () => ({ query: "", kind: "all", min: null, max: null, categoryIds: [], accountIds: [], tagIds: [], from: null, to: null });

export function activeFilterCount(f) {
  return (f.query?.trim() ? 1 : 0) + (f.kind !== "all" ? 1 : 0) + (f.min != null ? 1 : 0) + (f.max != null ? 1 : 0) + (f.categoryIds.length ? 1 : 0) + (f.accountIds.length ? 1 : 0) + (f.tagIds.length ? 1 : 0) + (f.from != null || f.to != null ? 1 : 0);
}
// Dönem seçicisini bypass eden (tüm tarihlerde arayan) filtre var mı? Metin araması ve tarih aralığı: evet.
// Tutar/kategori/ödeme/etiket/tür filtreleri seçili dönemin İÇİNDE çalışır.
export const isGlobalScope = (f) => !!f.query?.trim() || f.from != null || f.to != null;

// ctx: { catName(id), accName(id), tagName(id), rates }
export function applyFilter(txs, f, ctx) {
  const q = trLower((f.query || "").trim());
  const from = f.from != null ? startOfDay(f.from) : null;
  const to = f.to != null ? startOfDay(f.to) + 86400000 : null;
  const cats = new Set(f.categoryIds);
  const accs = new Set(f.accountIds);
  const tags = new Set(f.tagIds);
  return txs.filter((t) => {
    if (f.kind !== "all" && t.kind !== f.kind) return false;
    if (from != null && t.occurredAt < from) return false;
    if (to != null && t.occurredAt >= to) return false;
    if (cats.size && !cats.has(t.categoryId)) return false;
    if (accs.size && !accs.has(t.accountId)) return false;
    if (tags.size && !(t.tagIds || []).some((id) => tags.has(id))) return false;
    if (f.min != null || f.max != null) {
      const v = baseOf(t, ctx.rates);
      if (f.min != null && v < f.min) return false;
      if (f.max != null && v > f.max) return false;
    }
    if (q) {
      const hay = [t.merchant, t.note, ctx.catName(t.categoryId), t.subcategoryId && ctx.catName(t.subcategoryId), ctx.accName(t.accountId), ...(t.tagIds || []).map(ctx.tagName)].filter(Boolean).map(trLower).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
