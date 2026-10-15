import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { openKesemDb } from "../data/idb";
import { DEFAULT_SETTINGS, EMPTY_TX_EXTRAS, SCHEMA_VERSION, DEFAULT_CURRENCY, uid } from "../model/schema";
import { buildDefaultAccounts, buildDefaultCategories } from "../model/defaults";
import { formatMoneyText, setMoneyMask, rateOf } from "../model/money";
import { dueGenerated, splitEqual, installmentRows, upcomingItems, occurrenceKey } from "../model/finance";
import { dayKey } from "../model/dates";
import { COLLECTIONS as BACKUP_COLLECTIONS } from "../model/backup";
import { trLower } from "../model/dates";

// Kesem durum yönetimi. Tüm veri bellekte tutulur (kişisel harcama hacmi için
// yeterli) ve HER değişiklik bir "değişiklik kümesi"dir:
//   [{ store, id, before, after }]
// Küme IndexedDB'ye ATOMİK yazılır, sonra duruma uygulanır. Geri al = kümenin
// tersini uygulamak → geri al/yinele her veri türü için (ve sonraki parçalarda
// eklenecek taksit/borç/bütçe için de) otomatik çalışır.

const KesemCtx = createContext(null);
export const useKesem = () => {
  const v = useContext(KesemCtx);
  if (!v) throw new Error("useKesem, <KesemProvider> içinde kullanılmalı");
  return v;
};

const COLLECTIONS = ["transactions", "categories", "accounts", "tags", "templates", "installments", "recurrings", "people", "debts", "goals", "wishes", "shopping"];
const META_IDS = ["budget", "rates", "activity", "lock"];
const emptyCols = () => Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
const initial = { status: "loading", persistent: true, cols: emptyCols(), settings: DEFAULT_SETTINGS, meta: {} };

function applyToState(state, changes) {
  const cols = { ...state.cols };
  let settings = state.settings;
  let meta = state.meta;
  const copied = new Set();
  for (const c of changes) {
    if (c.store === "blobs") continue;
    if (c.store === "meta") {
      if (c.id === "settings") settings = c.after ? { ...DEFAULT_SETTINGS, ...c.after } : DEFAULT_SETTINGS;
      else if (META_IDS.includes(c.id)) meta = { ...meta, [c.id]: c.after || undefined };
      continue;
    }
    if (!cols[c.store]) continue;
    if (!copied.has(c.store)) {
      cols[c.store] = new Map(cols[c.store]);
      copied.add(c.store);
    }
    if (c.after) cols[c.store].set(c.id, c.after);
    else cols[c.store].delete(c.id);
  }
  return { ...state, cols, settings, meta };
}

function reducer(state, a) {
  switch (a.type) {
    case "LOAD": {
      const cols = emptyCols();
      for (const col of COLLECTIONS) for (const r of a.data[col] || []) cols[col].set(r.id, r);
      return { status: "ready", persistent: a.persistent, cols, settings: { ...DEFAULT_SETTINGS, ...(a.settings || {}) }, meta: a.meta || {} };
    }
    case "RESET":
      return initial;
    case "ERROR":
      return { ...state, status: "error" };
    case "APPLY":
      return applyToState(state, a.changes);
    default:
      return state;
  }
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name || "").localeCompare(b.name || "", "tr");
const MISSING_CAT = { id: null, name: "Kategorisiz", icon: "tag", color: "stone", kind: "expense", parentId: null };
const MISSING_ACC = { id: null, name: "Belirtilmemiş", type: "other", color: "stone" };

export function KesemProvider({ userId, children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Gizlilik maskesi: metin bağlamlarındaki tutarlar (formatMoneyText) çocuklar RENDER OLMADAN önce doğru olsun diye
  // senkron ayarlanır (efektte ayarlansa ilk boyamada maskesiz sızardı). Modül değişkeni, yan etkisi idempotent.
  setMoneyMask(state.settings.privacy);
  const dbRef = useRef(null);
  const stacks = useRef({ undo: [], redo: [] });
  const [stackTick, setStackTick] = useState(0);
  const [toast, setToast] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  // --- Yükleme + ilk kurulum (varsayılanlar) ------------------------------
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "RESET" });
    (async () => {
      try {
        const db = await openKesemDb(`kesem-${userId || "misafir"}`);
        if (cancelled) {
          db.close();
          return;
        }
        dbRef.current = db;
        // Kalıcılık iste (sessiz; tarayıcı depoyu otomatik silmesin).
        try {
          navigator.storage?.persist?.();
        } catch {
          /* yoksay */
        }
        let schema = await db.get("meta", "schema");
        if (!schema) {
          const now = Date.now();
          const seed = [
            ...buildDefaultCategories().map((r) => ({ store: "categories", id: r.id, before: null, after: { ...r, createdAt: now, updatedAt: now } })),
            ...buildDefaultAccounts().map((r) => ({ store: "accounts", id: r.id, before: null, after: { ...r, createdAt: now, updatedAt: now } })),
            { store: "meta", id: "schema", before: null, after: { id: "schema", version: SCHEMA_VERSION } },
            { store: "meta", id: "settings", before: null, after: { ...DEFAULT_SETTINGS } },
          ];
          await db.apply(seed);
        }
        // v1 → v2: şema belgesini yükselt (yeni depolar upgrade'de açıldı, veri taşımaya gerek yok).
        if (schema && schema.version < SCHEMA_VERSION) await db.apply([{ store: "meta", id: "schema", before: schema, after: { ...schema, version: SCHEMA_VERSION } }]);
        const data = {};
        await Promise.all(COLLECTIONS.map(async (c) => (data[c] = await db.getAll(c))));
        const settings = await db.get("meta", "settings");
        const meta = {};
        await Promise.all(META_IDS.map(async (id) => (meta[id] = (await db.get("meta", id)) || undefined)));
        if (cancelled) return;
        stacks.current = { undo: [], redo: [] };
        dispatch({ type: "LOAD", data, settings, meta, persistent: db.kind === "idb" });
      } catch {
        if (!cancelled) dispatch({ type: "ERROR" });
      }
    })();
    return () => {
      cancelled = true;
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [userId, resetKey]);

  // --- Çekirdek: değişiklik kümesi uygula ---------------------------------
  const commit = useCallback(async (changes, { label, undoable = true } = {}) => {
    const db = dbRef.current;
    if (!db || !changes.length) return false;
    try {
      await db.apply(changes);
    } catch {
      setToast({ id: uid(), message: "Kaydedilemedi. Depolama dolu olabilir.", tone: "error" });
      return false;
    }
    // ref'i hemen güncelle: aynı tikte arka arkaya yazan eylemler (ör. kişi oluştur → borç yaz) bayat durumu okumasın
    stateRef.current = reducer(stateRef.current, { type: "APPLY", changes });
    dispatch({ type: "APPLY", changes });
    if (undoable) {
      stacks.current.undo.push({ label, changes });
      if (stacks.current.undo.length > 30) stacks.current.undo.shift();
      stacks.current.redo = [];
      setStackTick((n) => n + 1);
    }
    return true;
  }, []);

  const invert = (changes) => [...changes].reverse().map((c) => ({ store: c.store, id: c.id, before: c.after, after: c.before }));

  const notify = useCallback((t) => setToast({ id: uid(), ...t }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const undo = useCallback(async () => {
    const entry = stacks.current.undo.pop();
    if (!entry) return;
    const ok = await commit(invert(entry.changes), { undoable: false });
    if (ok) {
      stacks.current.redo.push(entry);
      notify({ message: `Geri alındı · ${entry.label}`, actionLabel: "Yinele", action: "redo" });
    } else stacks.current.undo.push(entry);
    setStackTick((n) => n + 1);
  }, [commit, notify]);

  const redo = useCallback(async () => {
    const entry = stacks.current.redo.pop();
    if (!entry) return;
    const ok = await commit(entry.changes, { undoable: false });
    if (ok) {
      stacks.current.undo.push(entry);
      notify({ message: `Yinelendi · ${entry.label}`, actionLabel: "Geri Al", action: "undo" });
    } else stacks.current.redo.push(entry);
    setStackTick((n) => n + 1);
  }, [commit, notify]);

  // --- Türetilmiş görünüm -------------------------------------------------
  const view = useMemo(() => {
    const { cols } = state;
    const all = (m) => [...m.values()];
    const live = (arr) => arr.filter((r) => !r.deletedAt);
    const allTx = all(cols.transactions);
    const transactions = live(allTx).sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt);
    const deletedTransactions = allTx.filter((r) => r.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
    const categories = live(all(cols.categories)).sort(byOrder);
    const accounts = live(all(cols.accounts)).sort(byOrder);
    const tags = live(all(cols.tags)).sort((a, b) => a.name.localeCompare(b.name, "tr"));
    const templates = live(all(cols.templates)).sort(byOrder);
    const byCreated = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
    const rates = state.meta.rates?.rates || {};
    return {
      installments: live(all(cols.installments)).sort(byCreated),
      recurrings: live(all(cols.recurrings)).sort(byCreated),
      people: live(all(cols.people)).sort((a, b) => a.name.localeCompare(b.name, "tr")),
      debts: live(all(cols.debts)).sort(byCreated),
      goals: live(all(cols.goals)).sort(byCreated),
      wishes: live(all(cols.wishes)).sort(byCreated),
      shopping: live(all(cols.shopping)).sort(byCreated),
      lock: state.meta.lock || { enabled: false },
      budget: { monthlyMinor: 0, byCategory: {}, startDay: 1, includePlanned: true, ...(state.meta.budget || {}) },
      rates,
      enabledCurrencies: state.meta.rates?.enabled || ["TRY"],
      activityDays: state.meta.activity?.days || [],
      // Sabit kimlikli (g-...) üretilmiş işlem var mı? Silinmiş olsa bile "var" sayılır → yeniden doğmaz.
      txExists: (key) => cols.transactions.has(key),
      personById: (id) => cols.people.get(id) || null,
      transactions,
      deletedTransactions,
      categories,
      accounts,
      tags,
      templates,
      txById: (id) => cols.transactions.get(id) || null,
      // Silinmiş kategori/hesap kayıtları da çözülebilir (eski harcamalar bozulmasın).
      catById: (id) => cols.categories.get(id) || MISSING_CAT,
      accById: (id) => cols.accounts.get(id) || MISSING_ACC,
      tagById: (id) => cols.tags.get(id) || null,
      topCategories: (kind) => categories.filter((c) => c.kind === kind && !c.parentId),
      subCategories: (parentId) => categories.filter((c) => c.parentId === parentId),
    };
  }, [state]);

  // --- Etiket çözümleme (ad → id, yoksa oluştur) ---------------------------
  const resolveTags = (names, now) => {
    const changes = [];
    const ids = [];
    const known = [...stateRef.current.cols.tags.values()];
    for (const raw of names || []) {
      const name = raw.trim().replace(/^#/, "").slice(0, 24);
      if (!name) continue;
      const key = trLower(name);
      const hit = known.find((t) => trLower(t.name) === key);
      if (hit) {
        if (hit.deletedAt) {
          const revived = { ...hit, deletedAt: null, updatedAt: now };
          changes.push({ store: "tags", id: hit.id, before: hit, after: revived });
        }
        if (!ids.includes(hit.id)) ids.push(hit.id);
      } else {
        const tag = { id: uid(), name, createdAt: now, updatedAt: now, deletedAt: null };
        known.push(tag);
        changes.push({ store: "tags", id: tag.id, before: null, after: tag });
        ids.push(tag.id);
      }
    }
    return { ids, changes };
  };

  // Kişi çözümleme (ad → id, yoksa oluştur) — etiketlerle aynı kalıp.
  const resolvePeople = (names, now) => {
    const changes = [];
    const ids = [];
    const outNames = [];
    const known = [...stateRef.current.cols.people.values()];
    for (const raw of names || []) {
      const name = raw.trim().slice(0, 28);
      if (!name) continue;
      const hit = known.find((p) => trLower(p.name) === trLower(name));
      if (hit) {
        if (hit.deletedAt) changes.push({ store: "people", id: hit.id, before: hit, after: { ...hit, deletedAt: null, updatedAt: now } });
        ids.push(hit.id);
      } else {
        const p = { id: uid(), name, createdAt: now, updatedAt: now, deletedAt: null };
        known.push(p);
        changes.push({ store: "people", id: p.id, before: null, after: p });
        ids.push(p.id);
      }
      outNames.push(name);
    }
    return { ids, changes, names: outNames };
  };

  const receiptChange = (receipt, now) => {
    if (!receipt?.blob) return null;
    const id = uid();
    return { id, change: { store: "blobs", id, before: null, after: { id, blob: receipt.blob, type: receipt.blob.type || "image/jpeg", createdAt: now } } };
  };

  const rememberChoice = (kind, categoryId, accountId) => {
    const s = stateRef.current.settings;
    const next = { ...s, lastCategory: { ...s.lastCategory, [kind]: categoryId }, lastAccount: accountId || s.lastAccount };
    commit([{ store: "meta", id: "settings", before: s, after: next }], { undoable: false });
  };

  // --- İşlem (harcama/gelir) eylemleri -------------------------------------
  const addTransaction = useCallback(
    async (input, { silent = false, label } = {}) => {
      const now = Date.now();
      const tg = resolveTags(input.tagNames, now);
      const rc = receiptChange(input.receipt, now);
      const currency = input.currency || DEFAULT_CURRENCY;
      const rates = stateRef.current.meta.rates?.rates || {};
      const fxRate = input.rate ?? rateOf(currency, rates) ?? 1;
      // Bölüşme: amountMinor = BENİM payım; geri kalanı borç/alacak defterine yazılır.
      let amountMinor = input.amountMinor;
      let split = null;
      const splitChanges = [];
      if (input.split && input.split.names?.length) {
        const ppl = resolvePeople(input.split.names, now);
        splitChanges.push(...ppl.changes);
        const n = ppl.ids.length + 1;
        const paidByMe = input.split.paidBy === "me" || !input.split.paidBy;
        const sh = splitEqual(input.amountMinor, n, paidByMe);
        amountMinor = sh.myShare;
        const payerId = paidByMe ? "me" : ppl.ids[Math.max(0, ppl.names.indexOf(input.split.paidBy))] || ppl.ids[0];
        split = { totalMinor: input.amountMinor, n, paidBy: payerId, personIds: ppl.ids };
        input.__splitDebts = paidByMe
          ? ppl.ids.map((pid) => ({ personId: pid, direction: "lent", amountMinor: sh.otherShare }))
          : [{ personId: payerId, direction: "borrowed", amountMinor: sh.myShare }];
      }
      const txId = input.id || uid();
      const tx = {
        id: txId,
        kind: input.kind,
        amountMinor,
        currency,
        baseMinor: Math.round(amountMinor * fxRate),
        categoryId: input.categoryId || null,
        subcategoryId: input.subcategoryId || null,
        accountId: input.accountId || null,
        occurredAt: input.occurredAt ?? now,
        merchant: (input.merchant || "").trim(),
        note: (input.note || "").trim(),
        tagIds: input.tagIds ? [...input.tagIds, ...tg.ids] : tg.ids,
        receiptId: rc ? rc.id : input.receiptId || null,
        templateId: input.templateId || null,
        ...EMPTY_TX_EXTRAS,
        ...(input.extra || {}),
        fx: currency === DEFAULT_CURRENCY ? null : { rate: fxRate, baseCurrency: DEFAULT_CURRENCY },
        split,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      for (const d of input.__splitDebts || []) {
        const id = uid();
        splitChanges.push({
          store: "debts", id, before: null,
          after: { id, personId: d.personId, direction: d.direction, amountMinor: d.amountMinor, paidMinor: 0, currency, rate: fxRate, dueAt: null, note: tx.merchant || (input.categoryId && stateRef.current.cols.categories.get(input.categoryId)?.name) || "Bölüşülen harcama", txId: tx.id, settledAt: null, createdAt: now, updatedAt: now, deletedAt: null },
        });
      }
      // Bağlantılı kayıtlar (istek "alındı", alışveriş listesi "kaydedildi" …) — aynı işlemde.
      for (const l of input.links || []) {
        const cur = stateRef.current.cols[l.store]?.get(l.id);
        if (cur) splitChanges.push({ store: l.store, id: l.id, before: cur, after: { ...cur, ...l.patch(tx), updatedAt: now } });
      }
      const changes = [...tg.changes, ...splitChanges, ...(rc ? [rc.change] : []), { store: "transactions", id: tx.id, before: null, after: tx }];
      if (input.templateId) {
        const tpl = stateRef.current.cols.templates.get(input.templateId);
        if (tpl) changes.push({ store: "templates", id: tpl.id, before: tpl, after: { ...tpl, useCount: (tpl.useCount || 0) + 1, lastUsedAt: now, updatedAt: now } });
      }
      const ok = await commit(changes, { label: label || (tx.kind === "income" ? "gelir eklendi" : "harcama eklendi") });
      if (!ok) return null;
      if (!silent) {
        notify({
          message: `${tx.kind === "income" ? "Gelir eklendi" : tx.split ? "Bölüşülen harcama eklendi" : "Harcama eklendi"} · ${formatMoneyText(tx.kind === "income" ? tx.amountMinor : -tx.amountMinor, tx.currency)}`,
          actionLabel: "Geri Al",
          action: "undo",
        });
      }
      rememberChoice(tx.kind, tx.categoryId, tx.accountId);
      return tx;
    },
    [commit, notify] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const updateTransaction = useCallback(
    async (id, input) => {
      const before = stateRef.current.cols.transactions.get(id);
      if (!before) return false;
      const now = Date.now();
      const tg = resolveTags(input.tagNames, now);
      let receiptId = before.receiptId;
      const extra = [];
      if (input.receipt === null) receiptId = null;
      else if (input.receipt?.blob) {
        const rc = receiptChange(input.receipt, now);
        receiptId = rc.id;
        extra.push(rc.change);
      }
      const currency = input.currency || before.currency || DEFAULT_CURRENCY;
      const fxRate = input.rate ?? (currency === before.currency ? before.fx?.rate : null) ?? rateOf(currency, stateRef.current.meta.rates?.rates || {}) ?? 1;
      const after = {
        ...before,
        kind: input.kind,
        amountMinor: input.amountMinor,
        currency,
        baseMinor: Math.round(input.amountMinor * (currency === DEFAULT_CURRENCY ? 1 : fxRate)),
        fx: currency === DEFAULT_CURRENCY ? null : { rate: fxRate, baseCurrency: DEFAULT_CURRENCY },
        categoryId: input.categoryId || null,
        subcategoryId: input.subcategoryId || null,
        accountId: input.accountId || null,
        occurredAt: input.occurredAt ?? before.occurredAt,
        merchant: (input.merchant || "").trim(),
        note: (input.note || "").trim(),
        tagIds: tg.ids,
        receiptId,
        updatedAt: now,
      };
      const ok = await commit([...tg.changes, ...extra, { store: "transactions", id, before, after }], { label: "düzenleme" });
      if (ok) {
        notify({ message: "Değişiklikler kaydedildi", actionLabel: "Geri Al", action: "undo" });
        rememberChoice(after.kind, after.categoryId, after.accountId);
      }
      return ok;
    },
    [commit, notify] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Bölüşülmüş bir harcama silinirse ona bağlı borç/alacak kayıtları da (aynı işlemde) silinir; geri alınca döner.
  const linkedDebts = (txId) => [...stateRef.current.cols.debts.values()].filter((d) => d.txId === txId);

  const deleteTransaction = useCallback(
    async (id) => {
      const before = stateRef.current.cols.transactions.get(id);
      if (!before) return false;
      const now = Date.now();
      const debts = linkedDebts(id).filter((d) => !d.deletedAt).map((d) => ({ store: "debts", id: d.id, before: d, after: { ...d, deletedAt: now, updatedAt: now } }));
      const ok = await commit([...debts, { store: "transactions", id, before, after: { ...before, deletedAt: now, updatedAt: now } }], { label: "silme" });
      if (ok) notify({ message: "Kayıt silindi", actionLabel: "Geri Al", action: "undo" });
      return ok;
    },
    [commit, notify]
  );

  const restoreTransaction = useCallback(
    async (id) => {
      const before = stateRef.current.cols.transactions.get(id);
      if (!before) return false;
      const now = Date.now();
      const debts = linkedDebts(id).filter((d) => d.deletedAt).map((d) => ({ store: "debts", id: d.id, before: d, after: { ...d, deletedAt: null, updatedAt: now } }));
      const ok = await commit([...debts, { store: "transactions", id, before, after: { ...before, deletedAt: null, updatedAt: now } }], { label: "geri yükleme" });
      if (ok) notify({ message: "Kayıt geri yüklendi" });
      return ok;
    },
    [commit, notify]
  );

  const purgeTransaction = useCallback(
    async (id) => {
      const before = stateRef.current.cols.transactions.get(id);
      if (!before) return false;
      const ok = await commit([{ store: "transactions", id, before, after: null }], { label: "kalıcı silme", undoable: false });
      if (ok) notify({ message: "Kalıcı olarak silindi" });
      return ok;
    },
    [commit, notify]
  );

  // Aynı kaydın şimdi tarihli kopyası (tek dokunuş) — "son harcamayı tekrarla".
  const repeatTransaction = useCallback(
    (tx) =>
      addTransaction(
        { ...tx, receiptId: null, occurredAt: Date.now(), tagNames: tx.tagIds.map((i) => stateRef.current.cols.tags.get(i)?.name).filter(Boolean) },
        { label: "tekrarlanan kayıt" }
      ),
    [addTransaction]
  );

  // --- Genel "liste öğesi" eylemleri (kategori, hesap, şablon, etiket) -----
  const upsert = useCallback(
    async (store, record, label) => {
      const before = stateRef.current.cols[store].get(record.id) || null;
      const now = Date.now();
      const after = before
        ? { ...before, ...record, updatedAt: now }
        : { createdAt: now, deletedAt: null, order: stateRef.current.cols[store].size, ...record, updatedAt: now };
      const ok = await commit([{ store, id: after.id, before, after }], { label });
      return ok ? after : null;
    },
    [commit]
  );

  const softDelete = useCallback(
    async (store, id, label) => {
      const cols = stateRef.current.cols;
      const now = Date.now();
      const targets = [cols[store].get(id)];
      if (store === "categories") targets.push(...[...cols.categories.values()].filter((c) => c.parentId === id && !c.deletedAt));
      const changes = targets.filter(Boolean).map((r) => ({ store, id: r.id, before: r, after: { ...r, deletedAt: now, updatedAt: now } }));
      const ok = await commit(changes, { label });
      if (ok) notify({ message: `${label} tamamlandı`, actionLabel: "Geri Al", action: "undo" });
      return ok;
    },
    [commit, notify]
  );

  const saveCategory = useCallback((c) => upsert("categories", { ...c, id: c.id || uid() }, "kategori kaydı"), [upsert]);
  const deleteCategory = useCallback((id) => softDelete("categories", id, "kategori silme"), [softDelete]);
  const saveAccount = useCallback((a) => upsert("accounts", { ...a, id: a.id || uid() }, "ödeme yöntemi kaydı"), [upsert]);
  const deleteAccount = useCallback((id) => softDelete("accounts", id, "ödeme yöntemi silme"), [softDelete]);
  const saveTag = useCallback((t) => upsert("tags", { ...t, id: t.id || uid() }, "etiket kaydı"), [upsert]);
  const deleteTag = useCallback((id) => softDelete("tags", id, "etiket silme"), [softDelete]);
  const saveTemplate = useCallback((t) => upsert("templates", { useCount: 0, ...t, id: t.id || uid() }, "kısayol kaydı"), [upsert]);
  const deleteTemplate = useCallback((id) => softDelete("templates", id, "kısayol silme"), [softDelete]);

  const updateSettings = useCallback(
    (patch) => {
      const s = stateRef.current.settings;
      return commit([{ store: "meta", id: "settings", before: s, after: { ...s, ...patch } }], { undoable: false });
    },
    [commit]
  );

  // Şablondan TEK DOKUNUŞ ekleme (tutarı kayıtlıysa).
  const quickAdd = useCallback(
    (tpl) =>
      addTransaction(
        {
          kind: tpl.kind,
          amountMinor: tpl.amountMinor,
          currency: tpl.currency,
          categoryId: tpl.categoryId,
          subcategoryId: tpl.subcategoryId,
          accountId: tpl.accountId,
          merchant: tpl.merchant,
          note: tpl.note,
          tagIds: tpl.tagIds || [],
          templateId: tpl.id,
        },
        { label: `“${tpl.name}” eklendi` }
      ),
    [addTransaction]
  );

  // ---------------- Parça 2: para yönetimi eylemleri ----------------
  const saveRecord = useCallback((store, rec, label) => upsert(store, { ...rec, id: rec.id || uid() }, label), [upsert]);
  const removeRecord = useCallback((store, id, label) => softDelete(store, id, label), [softDelete]);

  const saveMeta = useCallback(
    (id, patch, label, defaults = {}) => {
      const before = stateRef.current.meta[id] || null;
      return commit([{ store: "meta", id, before, after: { ...defaults, ...(before || {}), ...patch, id } }], { label, undoable: !!label });
    },
    [commit]
  );
  const saveBudget = useCallback((patch) => saveMeta("budget", patch, "bütçe değişikliği", { monthlyMinor: 0, byCategory: {}, startDay: 1, includePlanned: true }), [saveMeta]);
  const saveRates = useCallback((patch) => saveMeta("rates", patch, "kur değişikliği", { enabled: ["TRY"], rates: {} }), [saveMeta]);

  // Açılışta: bugün "kayıt tuttuğun gün" olarak işaretlenir (harcamasız gün serisi için).
  const touchActivity = useCallback(() => {
    const key = dayKey(Date.now());
    const cur = stateRef.current.meta.activity;
    if (cur?.days?.includes(key)) return;
    return saveMeta("activity", { days: [...(cur?.days || []), key].slice(-800) }, null, { days: [] });
  }, [saveMeta]);

  // Vadesi gelen taksit / otomatik abonelik kayıtlarını GERÇEK işleme çevirir (sabit kimlik → idempotent).
  const materialize = useCallback(async () => {
    const st = stateRef.current;
    if (st.status !== "ready") return 0;
    const cols = st.cols;
    const live = (m) => [...m.values()].filter((r) => !r.deletedAt);
    const due = dueGenerated({ installments: live(cols.installments), recurrings: live(cols.recurrings), now: Date.now(), exists: (k) => cols.transactions.has(k) });
    if (!due.length) return 0;
    const rates = st.meta.rates?.rates || {};
    const now = Date.now();
    const changes = due.map((d) => {
      const src = d.type === "installment" ? d.plan : d.rule;
      const currency = src.currency || DEFAULT_CURRENCY;
      const amountMinor = d.type === "installment" ? d.amountMinor : src.amountMinor;
      const fx = d.type === "installment" ? src.rate || 1 : rateOf(currency, rates) ?? 1;
      const tx = {
        id: d.key, kind: src.kind || "expense", amountMinor, currency, baseMinor: Math.round(amountMinor * fx),
        categoryId: src.categoryId || null, subcategoryId: src.subcategoryId || null, accountId: src.accountId || null,
        occurredAt: d.dateTs, merchant: src.merchant || src.title, note: d.type === "installment" ? `${d.index + 1}/${src.count}. taksit` : "",
        tagIds: src.tagIds || [], receiptId: null, templateId: null, ...EMPTY_TX_EXTRAS,
        installment: d.type === "installment" ? { planId: src.id, index: d.index, total: src.count } : null,
        recurringId: d.type === "recurring" ? src.id : null,
        fx: currency === DEFAULT_CURRENCY ? null : { rate: fx, baseCurrency: DEFAULT_CURRENCY },
        split: null, createdAt: now, updatedAt: now, deletedAt: null,
      };
      return { store: "transactions", id: tx.id, before: null, after: tx };
    });
    await commit(changes, { undoable: false });
    return changes.length;
  }, [commit]);

  // Taksitli alışveriş: plan + vadesi gelen (ilk) taksit aynı işlemde; geri alınabilir.
  const createInstallmentPlan = useCallback(
    async (input) => {
      const now = Date.now();
      const tg = resolveTags(input.tagNames, now);
      const rates = stateRef.current.meta.rates?.rates || {};
      const currency = input.currency || DEFAULT_CURRENCY;
      const plan = {
        id: uid(), title: (input.title || input.merchant || "Taksitli alışveriş").trim().slice(0, 40), totalMinor: input.totalMinor, currency,
        rate: input.rate ?? rateOf(currency, rates) ?? 1, count: input.count, firstAt: input.firstAt ?? now,
        categoryId: input.categoryId || null, subcategoryId: input.subcategoryId || null, accountId: input.accountId || null,
        merchant: (input.merchant || "").trim(), note: (input.note || "").trim(), tagIds: tg.ids, stoppedAt: null,
        kind: "expense", order: 0, createdAt: now, updatedAt: now, deletedAt: null,
      };
      const first = installmentRows(plan).filter((r) => r.dateTs <= now);
      const txs = first.map((r) => ({
        store: "transactions", id: r.key, before: null,
        after: {
          id: r.key, kind: "expense", amountMinor: r.amountMinor, currency, baseMinor: Math.round(r.amountMinor * plan.rate), categoryId: plan.categoryId, subcategoryId: plan.subcategoryId,
          accountId: plan.accountId, occurredAt: r.dateTs, merchant: plan.merchant || plan.title, note: `${r.index + 1}/${plan.count}. taksit`, tagIds: plan.tagIds, receiptId: null, templateId: null,
          ...EMPTY_TX_EXTRAS, installment: { planId: plan.id, index: r.index, total: plan.count }, fx: currency === DEFAULT_CURRENCY ? null : { rate: plan.rate, baseCurrency: DEFAULT_CURRENCY },
          split: null, createdAt: now, updatedAt: now, deletedAt: null,
        },
      }));
      const ok = await commit([...tg.changes, { store: "installments", id: plan.id, before: null, after: plan }, ...txs], { label: "taksitli alışveriş" });
      if (ok) notify({ message: `${plan.count} taksit planlandı · ${formatMoneyText(plan.totalMinor, currency)}`, actionLabel: "Geri Al", action: "undo" });
      return ok ? plan : null;
    },
    [commit, notify]
  );

  // Elle ödenen (fatura) kalemi "ödendi" yap: sabit kimlikli gerçek gider yazılır.
  const payOccurrence = useCallback(
    async (item) => {
      const rule = stateRef.current.cols.recurrings.get(item.ruleId);
      if (!rule) return null;
      return addTransaction(
        { id: occurrenceKey(rule.id, item.index), kind: rule.kind || "expense", amountMinor: item.amountMinor, currency: rule.currency, categoryId: rule.categoryId, subcategoryId: rule.subcategoryId, accountId: rule.accountId, merchant: rule.merchant || rule.title, tagIds: rule.tagIds || [], extra: { recurringId: rule.id } },
        { label: `“${rule.title}” ödendi` }
      );
    },
    [addTransaction]
  );
  const skipOccurrence = useCallback(
    async (item) => {
      const rule = stateRef.current.cols.recurrings.get(item.ruleId);
      if (!rule) return false;
      const ok = await commit([{ store: "recurrings", id: rule.id, before: rule, after: { ...rule, skipped: [...(rule.skipped || []), item.index], updatedAt: Date.now() } }], { label: "ödemeyi atlama" });
      if (ok) notify({ message: `“${rule.title}” bu dönem atlandı`, actionLabel: "Geri Al", action: "undo" });
      return ok;
    },
    [commit, notify]
  );
  // Planlı ödemeler (dönem sonuna kadar) — bütçe hesabında düşülür.
  const plannedItems = useCallback(
    (horizonDays = 45) => {
      const cols = stateRef.current.cols;
      const live = (m) => [...m.values()].filter((r) => !r.deletedAt);
      return upcomingItems({ installments: live(cols.installments), recurrings: live(cols.recurrings), debts: live(cols.debts), people: live(cols.people), exists: (k) => cols.transactions.has(k), now: Date.now(), horizonDays, rates: stateRef.current.meta.rates?.rates || {} });
    },
    []
  );

  const settleDebt = useCallback(
    async (id, paidMinor) => {
      const d = stateRef.current.cols.debts.get(id);
      if (!d) return false;
      const now = Date.now();
      const paid = Math.max(0, Math.min(d.amountMinor, paidMinor));
      const ok = await commit([{ store: "debts", id, before: d, after: { ...d, paidMinor: paid, settledAt: paid >= d.amountMinor ? now : null, updatedAt: now } }], { label: paid >= d.amountMinor ? "ödendi işareti" : "kısmi ödeme" });
      if (ok) notify({ message: paid >= d.amountMinor ? "Ödendi olarak işaretlendi" : "Ödeme kaydedildi", actionLabel: "Geri Al", action: "undo" });
      return ok;
    },
    [commit, notify]
  );

  // ---------------- Parça 3: kilit, yedek, tanışma ----------------
  const saveLock = useCallback((patch) => saveMeta("lock", patch, null, { enabled: false, autoLock: 0, fails: 0, lockedUntil: 0, bio: null }), [saveMeta]);

  const hideCategories = useCallback(
    async (ids) => {
      const cols = stateRef.current.cols;
      const now = Date.now();
      const set = new Set(ids);
      const changes = [...cols.categories.values()].filter((c) => !c.deletedAt && (set.has(c.id) || set.has(c.parentId))).map((c) => ({ store: "categories", id: c.id, before: c, after: { ...c, deletedAt: now, updatedAt: now } }));
      return commit(changes, { undoable: false });
    },
    [commit]
  );

  // Tüm veriyi (silinenler dahil) yedek için ver.
  const exportData = useCallback(() => {
    const st = stateRef.current;
    const data = {};
    for (const c of BACKUP_COLLECTIONS) data[c] = [...st.cols[c].values()];
    return { data, meta: { budget: st.meta.budget, rates: st.meta.rates } };
  }, []);
  const getAllBlobs = useCallback(async () => (dbRef.current ? dbRef.current.getAll("blobs") : []), []);

  // İçe aktar: 'merge' → yeni kayıtlar eklenir, çakışmada daha yeni olan kalır; 'replace' → mevcut her şey silinir.
  // Tek değişiklik kümesi → ATOMİK ve geri alınabilir.
  const importBackup = useCallback(
    async (valid, mode, receiptBlobs = []) => {
      const cols = stateRef.current.cols;
      const changes = [];
      const incomingIds = {};
      for (const c of BACKUP_COLLECTIONS) incomingIds[c] = new Set(valid.data[c].map((r) => r.id));
      if (mode === "replace") {
        for (const c of BACKUP_COLLECTIONS) for (const r of cols[c].values()) if (!incomingIds[c].has(r.id)) changes.push({ store: c, id: r.id, before: r, after: null });
      }
      for (const c of BACKUP_COLLECTIONS) {
        for (const r of valid.data[c]) {
          const cur = cols[c].get(r.id) || null;
          if (!cur) changes.push({ store: c, id: r.id, before: null, after: r });
          else if (mode === "replace" || (r.updatedAt || 0) > (cur.updatedAt || 0)) changes.push({ store: c, id: r.id, before: cur, after: r });
        }
      }
      for (const id of ["budget", "rates"]) {
        if (valid.meta[id]) changes.push({ store: "meta", id, before: stateRef.current.meta[id] || null, after: { ...valid.meta[id], id } });
      }
      for (const b of receiptBlobs) changes.push({ store: "blobs", id: b.id, before: null, after: { id: b.id, blob: b.blob, type: b.blob.type, createdAt: Date.now() } });
      if (!changes.length) return { ok: true, changed: 0 };
      const ok = await commit(changes, { label: "içe aktarma" });
      if (ok) notify({ message: `İçe aktarıldı · ${changes.length} değişiklik`, actionLabel: "Geri Al", action: "undo" });
      return { ok, changed: changes.length };
    },
    [commit, notify]
  );

  // Tüm yerel veriyi (kilit dahil) siler ve modülü ilk kuruluma döndürür.
  const wipeAll = useCallback(async () => {
    const db = dbRef.current;
    dbRef.current = null;
    db?.close();
    await new Promise((res) => {
      try {
        const r = indexedDB.deleteDatabase(`kesem-${userId || "misafir"}`);
        r.onsuccess = r.onerror = r.onblocked = () => res();
      } catch {
        res();
      }
    });
    stacks.current = { undo: [], redo: [] };
    setResetKey((n) => n + 1);
  }, [userId]);

  const getBlob = useCallback(async (id) => (id && dbRef.current ? dbRef.current.get("blobs", id) : null), []);

  const value = useMemo(
    () => ({
      ready: state.status === "ready",
      failed: state.status === "error",
      persistent: state.persistent,
      settings: state.settings,
      ...view,
      canUndo: stacks.current.undo.length > 0,
      canRedo: stacks.current.redo.length > 0,
      stackTick,
      undo,
      redo,
      toast,
      notify,
      dismissToast,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      restoreTransaction,
      purgeTransaction,
      repeatTransaction,
      quickAdd,
      saveCategory,
      deleteCategory,
      saveAccount,
      deleteAccount,
      saveTag,
      deleteTag,
      saveTemplate,
      deleteTemplate,
      updateSettings,
      getBlob,
      saveRecord, removeRecord, saveBudget, saveRates, touchActivity, materialize, createInstallmentPlan, payOccurrence, skipOccurrence, plannedItems, settleDebt,
      saveLock, hideCategories, exportData, getAllBlobs, importBackup, wipeAll,
    }),
    [state, view, stackTick, toast, undo, redo, notify, dismissToast, addTransaction, updateTransaction, deleteTransaction, restoreTransaction, purgeTransaction, repeatTransaction, quickAdd, saveCategory, deleteCategory, saveAccount, deleteAccount, saveTag, deleteTag, saveTemplate, deleteTemplate, updateSettings, getBlob, saveRecord, removeRecord, saveBudget, saveRates, touchActivity, materialize, createInstallmentPlan, payOccurrence, skipOccurrence, plannedItems, settleDebt, saveLock, hideCategories, exportData, getAllBlobs, importBackup, wipeAll]
  );

  return <KesemCtx.Provider value={value}>{children}</KesemCtx.Provider>;
}
