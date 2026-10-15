// Yedekleme: CSV / JSON dışa aktarma ve JSON içe aktarma (doğrulama + önizleme). SAF fonksiyonlar.
import { baseOf, BASE_CURRENCY, CURRENCIES } from "./money";

export const BACKUP_APP = "kesem-backup";
export const BACKUP_VERSION = 2;
export const MAX_BACKUP_BYTES = 60 * 1024 * 1024;
export const COLLECTIONS = ["transactions", "categories", "accounts", "tags", "templates", "installments", "recurrings", "people", "debts", "goals", "wishes", "shopping"];
export const COLLECTION_LABEL = {
  transactions: "işlem", categories: "kategori", accounts: "ödeme yöntemi", tags: "etiket", templates: "kısayol", installments: "taksit planı",
  recurrings: "tekrarlayan ödeme", people: "kişi", debts: "borç/alacak", goals: "kumbara", wishes: "istek", shopping: "alışveriş ürünü",
};

// ------------------------------------------------------------------ CSV
const p2 = (n) => String(n).padStart(2, "0");
const csvCell = (v) => {
  let s = v == null ? "" : String(v);
  // CSV/Excel formül enjeksiyonuna karşı: =,+,-,@ ile başlayan METİN hücrelerine ' eklenir (sayılar hariç)
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const num = (minor) => (minor / 100).toFixed(2).replace(".", ","); // Türkçe Excel: ondalık virgül
export function buildCsv(txs, ctx) {
  const head = ["Tarih", "Saat", "Tür", "Tutar", "Para birimi", "₺ karşılığı", "Kategori", "Alt kategori", "Ödeme yöntemi", "Yer", "Not", "Etiketler", "Taksit", "Bölüşülen toplam"];
  const rows = [...txs].sort((a, b) => a.occurredAt - b.occurredAt).map((t) => {
    const d = new Date(t.occurredAt);
    return [
      `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`, `${p2(d.getHours())}:${p2(d.getMinutes())}`,
      t.kind === "income" ? "Gelir" : "Gider", num(t.amountMinor), t.currency || BASE_CURRENCY, num(baseOf(t, ctx.rates)),
      ctx.catName(t.categoryId), t.subcategoryId ? ctx.catName(t.subcategoryId) : "", ctx.accName(t.accountId), t.merchant || "", t.note || "",
      (t.tagIds || []).map(ctx.tagName).filter(Boolean).join(", "), t.installment ? `${t.installment.index + 1}/${t.installment.total}` : "", t.split ? num(t.split.totalMinor) : "",
    ].map(csvCell).join(";");
  });
  // UTF-8 BOM: Excel Türkçe karakterleri doğru açsın
  return "﻿" + [head.join(";"), ...rows].join("\r\n") + "\r\n";
}

// ----------------------------------------------------------------- JSON dışa aktarma
export function buildBackup({ data, meta, receipts }) {
  const out = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: {}, meta: {} };
  for (const c of COLLECTIONS) out.data[c] = data[c] || [];
  if (meta?.budget) out.meta.budget = meta.budget;
  if (meta?.rates) out.meta.rates = meta.rates;
  if (receipts?.length) out.receipts = receipts;
  return out;
}

// ----------------------------------------------------------- Doğrulama (içe aktarma)
const isStr = (v, max = 200) => typeof v === "string" && v.length <= max;
const isId = (v) => typeof v === "string" && /^[\w.\-:]{1,80}$/.test(v);
const isTs = (v) => Number.isFinite(v) && v > 631152000000 && v < 4102444800000; // 1990–2100
const isMinor = (v) => Number.isInteger(v) && v >= 0 && v <= 1e12;
const isCur = (v) => typeof v === "string" && (CURRENCIES.includes(v) || /^[A-Z]{3}$/.test(v));
const optTs = (v) => v == null || isTs(v);
const clip = (s, n) => (typeof s === "string" ? s.slice(0, n) : "");

// Her koleksiyon için: kayıt → temizlenmiş kayıt | hata mesajı (string)
const SANITIZE = {
  transactions(r) {
    if (!["expense", "income"].includes(r.kind)) return "geçersiz tür";
    if (!isMinor(r.amountMinor)) return "geçersiz tutar";
    if (!isTs(r.occurredAt)) return "geçersiz tarih";
    if (r.currency != null && !isCur(r.currency)) return "geçersiz para birimi";
    return {
      ...base(r), kind: r.kind, amountMinor: r.amountMinor, currency: r.currency || BASE_CURRENCY, baseMinor: Number.isFinite(r.baseMinor) && r.baseMinor >= 0 && r.baseMinor <= 1e13 ? Math.round(r.baseMinor) : undefined,
      categoryId: isId(r.categoryId) ? r.categoryId : null, subcategoryId: isId(r.subcategoryId) ? r.subcategoryId : null, accountId: isId(r.accountId) ? r.accountId : null,
      occurredAt: r.occurredAt, merchant: clip(r.merchant, 80), note: clip(r.note, 500), tagIds: Array.isArray(r.tagIds) ? r.tagIds.filter(isId).slice(0, 40) : [],
      receiptId: isId(r.receiptId) ? r.receiptId : null, templateId: isId(r.templateId) ? r.templateId : null,
      installment: r.installment && isId(r.installment.planId) && Number.isInteger(r.installment.index) && Number.isInteger(r.installment.total) ? { planId: r.installment.planId, index: r.installment.index, total: r.installment.total } : null,
      recurringId: isId(r.recurringId) ? r.recurringId : null, debtId: null, goalId: null,
      fx: r.fx && Number.isFinite(r.fx.rate) && r.fx.rate > 0 ? { rate: r.fx.rate, baseCurrency: BASE_CURRENCY } : null,
      split: r.split && isMinor(r.split.totalMinor) && Number.isInteger(r.split.n) ? { totalMinor: r.split.totalMinor, n: r.split.n, paidBy: clip(r.split.paidBy, 80), personIds: Array.isArray(r.split.personIds) ? r.split.personIds.filter(isId) : [] } : null,
    };
  },
  categories(r) {
    if (!isStr(r.name, 60) || !r.name.trim()) return "ad yok";
    if (!["expense", "income"].includes(r.kind)) return "geçersiz tür";
    return { ...base(r), kind: r.kind, name: r.name.trim(), icon: clip(r.icon, 30) || "tag", color: clip(r.color, 20) || "stone", parentId: isId(r.parentId) ? r.parentId : null, order: Number.isFinite(r.order) ? r.order : 0, builtin: !!r.builtin };
  },
  accounts(r) {
    if (!isStr(r.name, 60) || !r.name.trim()) return "ad yok";
    return { ...base(r), type: ["cash", "card", "other"].includes(r.type) ? r.type : "other", name: r.name.trim(), color: clip(r.color, 20) || "stone", order: Number.isFinite(r.order) ? r.order : 0, builtin: !!r.builtin };
  },
  tags(r) { return isStr(r.name, 40) && r.name.trim() ? { ...base(r), name: r.name.trim() } : "ad yok"; },
  templates(r) {
    if (!isStr(r.name, 60) || !r.name.trim()) return "ad yok";
    if (!["expense", "income"].includes(r.kind)) return "geçersiz tür";
    if (r.amountMinor != null && !isMinor(r.amountMinor)) return "geçersiz tutar";
    return { ...base(r), name: r.name.trim(), kind: r.kind, amountMinor: r.amountMinor ?? null, currency: r.currency || BASE_CURRENCY, categoryId: isId(r.categoryId) ? r.categoryId : null, subcategoryId: isId(r.subcategoryId) ? r.subcategoryId : null, accountId: isId(r.accountId) ? r.accountId : null, merchant: clip(r.merchant, 80), note: clip(r.note, 500), tagIds: Array.isArray(r.tagIds) ? r.tagIds.filter(isId) : [], quick: !!r.quick, order: Number.isFinite(r.order) ? r.order : 0, useCount: Number.isInteger(r.useCount) ? r.useCount : 0 };
  },
  installments(r) {
    if (!isMinor(r.totalMinor) || !Number.isInteger(r.count) || r.count < 1 || r.count > 120) return "geçersiz taksit";
    if (!isTs(r.firstAt)) return "geçersiz tarih";
    return { ...base(r), title: clip(r.title, 60) || "Taksit", totalMinor: r.totalMinor, count: r.count, firstAt: r.firstAt, currency: r.currency || BASE_CURRENCY, rate: Number.isFinite(r.rate) && r.rate > 0 ? r.rate : 1, categoryId: isId(r.categoryId) ? r.categoryId : null, subcategoryId: isId(r.subcategoryId) ? r.subcategoryId : null, accountId: isId(r.accountId) ? r.accountId : null, merchant: clip(r.merchant, 80), note: clip(r.note, 200), tagIds: Array.isArray(r.tagIds) ? r.tagIds.filter(isId) : [], stoppedAt: optTs(r.stoppedAt) ? r.stoppedAt ?? null : null, kind: "expense" };
  },
  recurrings(r) {
    if (!isStr(r.title, 60) || !r.title.trim()) return "ad yok";
    if (!isMinor(r.amountMinor)) return "geçersiz tutar";
    if (!["weekly", "monthly", "yearly"].includes(r.frequency)) return "geçersiz sıklık";
    if (!isTs(r.anchorAt)) return "geçersiz tarih";
    return { ...base(r), title: r.title.trim(), type: ["subscription", "bill", "rent", "other"].includes(r.type) ? r.type : "other", kind: r.kind === "income" ? "income" : "expense", amountMinor: r.amountMinor, currency: r.currency || BASE_CURRENCY, frequency: r.frequency, interval: Number.isInteger(r.interval) && r.interval >= 1 && r.interval <= 52 ? r.interval : 1, anchorAt: r.anchorAt, endAt: optTs(r.endAt) ? r.endAt ?? null : null, autoPost: !!r.autoPost, paused: !!r.paused, skipped: Array.isArray(r.skipped) ? r.skipped.filter(Number.isInteger).slice(0, 500) : [], categoryId: isId(r.categoryId) ? r.categoryId : null, subcategoryId: null, accountId: isId(r.accountId) ? r.accountId : null, merchant: clip(r.merchant, 80), tagIds: Array.isArray(r.tagIds) ? r.tagIds.filter(isId) : [] };
  },
  people(r) { return isStr(r.name, 40) && r.name.trim() ? { ...base(r), name: r.name.trim() } : "ad yok"; },
  debts(r) {
    if (!isId(r.personId)) return "kişi yok";
    if (!["lent", "borrowed"].includes(r.direction)) return "geçersiz yön";
    if (!isMinor(r.amountMinor)) return "geçersiz tutar";
    return { ...base(r), personId: r.personId, direction: r.direction, amountMinor: r.amountMinor, paidMinor: isMinor(r.paidMinor) ? Math.min(r.paidMinor, r.amountMinor) : 0, currency: r.currency || BASE_CURRENCY, rate: Number.isFinite(r.rate) && r.rate > 0 ? r.rate : 1, dueAt: optTs(r.dueAt) ? r.dueAt ?? null : null, note: clip(r.note, 200), txId: isId(r.txId) ? r.txId : null, settledAt: optTs(r.settledAt) ? r.settledAt ?? null : null };
  },
  goals(r) {
    if (!isStr(r.name, 60) || !r.name.trim()) return "ad yok";
    if (!isMinor(r.targetMinor) || r.targetMinor === 0) return "geçersiz hedef";
    const deps = Array.isArray(r.deposits) ? r.deposits.filter((d) => d && isId(d.id) && Number.isInteger(d.amountMinor) && Math.abs(d.amountMinor) <= 1e12 && isTs(d.at)).slice(0, 5000).map((d) => ({ id: d.id, amountMinor: d.amountMinor, at: d.at, note: clip(d.note, 100) })) : [];
    return { ...base(r), name: r.name.trim(), icon: clip(r.icon, 30) || "piggy", color: clip(r.color, 20) || "rose", targetMinor: r.targetMinor, currency: r.currency || BASE_CURRENCY, targetDate: optTs(r.targetDate) ? r.targetDate ?? null : null, monthlyPlanMinor: isMinor(r.monthlyPlanMinor) ? r.monthlyPlanMinor : null, deposits: deps };
  },
  wishes(r) {
    if (!isStr(r.name, 80) || !r.name.trim()) return "ad yok";
    return { ...base(r), name: r.name.trim(), priceMinor: isMinor(r.priceMinor) ? r.priceMinor : 0, currency: r.currency || BASE_CURRENCY, note: clip(r.note, 200), priority: [1, 2, 3].includes(r.priority) ? r.priority : 2, categoryId: isId(r.categoryId) ? r.categoryId : null, boughtAt: optTs(r.boughtAt) ? r.boughtAt ?? null : null, txId: isId(r.txId) ? r.txId : null };
  },
  shopping(r) {
    if (!isStr(r.name, 80) || !r.name.trim()) return "ad yok";
    return { ...base(r), name: r.name.trim(), estimateMinor: isMinor(r.estimateMinor) ? r.estimateMinor : 0, categoryId: isId(r.categoryId) ? r.categoryId : null, checked: !!r.checked, doneAt: optTs(r.doneAt) ? r.doneAt ?? null : null, txId: isId(r.txId) ? r.txId : null };
  },
};
function base(r) {
  const t = Date.now();
  return { id: r.id, createdAt: isTs(r.createdAt) ? r.createdAt : t, updatedAt: isTs(r.updatedAt) ? r.updatedAt : t, deletedAt: optTs(r.deletedAt) ? r.deletedAt ?? null : null, order: Number.isFinite(r.order) ? r.order : undefined };
}

// text → { ok, error?, data?, meta?, receipts?, report }
export function validateBackup(text, sizeBytes) {
  const fail = (error) => ({ ok: false, error });
  if (typeof text !== "string" || !text.trim()) return fail("Dosya boş.");
  if ((sizeBytes ?? text.length) > MAX_BACKUP_BYTES) return fail("Dosya çok büyük (en fazla 60 MB).");
  let j;
  try { j = JSON.parse(text.replace(/^\uFEFF/, "")); } catch { return fail("Dosya geçerli bir JSON değil; bozuk ya da yanlış dosya olabilir."); }
  if (!j || typeof j !== "object" || Array.isArray(j)) return fail("Dosya biçimi tanınmadı.");
  if (j.app !== BACKUP_APP) return fail("Bu dosya Harcama Takibi yedeği değil.");
  if (!Number.isInteger(j.version) || j.version < 1) return fail("Yedek sürümü okunamadı.");
  if (j.version > BACKUP_VERSION) return fail("Bu yedek daha yeni bir sürümle alınmış; uygulamayı güncelleyip tekrar dene.");
  if (!j.data || typeof j.data !== "object") return fail("Yedekte veri bölümü yok.");
  const data = {};
  const counts = {};
  const skipped = [];
  const warnings = [];
  for (const c of COLLECTIONS) {
    const arr = j.data[c];
    data[c] = [];
    if (arr == null) continue;
    if (!Array.isArray(arr)) { warnings.push(`“${COLLECTION_LABEL[c]}” bölümü liste değil, atlandı.`); continue; }
    const seen = new Set();
    for (const [i, r] of arr.entries()) {
      if (!r || typeof r !== "object" || !isId(r.id)) { skipped.push({ c, i, reason: "geçersiz kimlik" }); continue; }
      if (seen.has(r.id)) { skipped.push({ c, i, reason: "yinelenen kimlik" }); continue; }
      const res = SANITIZE[c](r);
      if (typeof res === "string") { skipped.push({ c, i, reason: res }); continue; }
      seen.add(r.id);
      data[c].push(JSON.parse(JSON.stringify(res)));
    }
    counts[c] = data[c].length;
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  if (total === 0) return fail("Yedekte içe aktarılabilir kayıt bulunamadı.");
  // başvuru bütünlüğü: kategori/hesap bulunamayan işlem sayısı (uyarı)
  const catIds = new Set(data.categories.map((x) => x.id));
  const orphan = data.transactions.filter((t) => t.categoryId && !catIds.has(t.categoryId)).length;
  if (orphan && !catIds.size) warnings.push(`${orphan} işlemin kategorisi yedekte yok; mevcut kategorilerle eşleşmezse “Kategorisiz” görünür.`);
  const meta = {};
  if (j.meta?.budget && typeof j.meta.budget === "object") {
    const b = j.meta.budget;
    meta.budget = { monthlyMinor: isMinor(b.monthlyMinor) ? b.monthlyMinor : 0, byCategory: Object.fromEntries(Object.entries(b.byCategory || {}).filter(([k, v]) => isId(k) && isMinor(v))), startDay: Number.isInteger(b.startDay) && b.startDay >= 1 && b.startDay <= 28 ? b.startDay : 1, includePlanned: b.includePlanned !== false };
  }
  if (j.meta?.rates && typeof j.meta.rates === "object") {
    const rt = {};
    for (const [k, v] of Object.entries(j.meta.rates.rates || {})) if (/^[A-Z]{3}$/.test(k) && v && Number.isFinite(v.rate) && v.rate > 0) rt[k] = { rate: v.rate, updatedAt: isTs(v.updatedAt) ? v.updatedAt : Date.now() };
    meta.rates = { enabled: Array.isArray(j.meta.rates.enabled) ? j.meta.rates.enabled.filter((x) => /^[A-Z]{3}$/.test(x)) : ["TRY"], rates: rt };
  }
  const receipts = Array.isArray(j.receipts) ? j.receipts.filter((r) => r && isId(r.id) && typeof r.dataUrl === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(r.dataUrl)).slice(0, 2000) : [];
  return { ok: true, data, meta, receipts, report: { version: j.version, exportedAt: typeof j.exportedAt === "string" ? j.exportedAt : null, counts, total, skipped, warnings } };
}

// Önizleme: mevcut verilerle karşılaştır → yeni / güncellenen / aynı
export function planImport(data, existing) {
  const plan = {};
  for (const c of COLLECTIONS) {
    const ex = existing[c] || new Map();
    let add = 0, update = 0, same = 0;
    for (const r of data[c]) {
      const cur = ex.get(r.id);
      if (!cur) add++;
      else if ((r.updatedAt || 0) > (cur.updatedAt || 0)) update++;
      else same++;
    }
    plan[c] = { add, update, same };
  }
  return plan;
}
