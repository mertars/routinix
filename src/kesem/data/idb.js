// Minimal IndexedDB katmanı. Her kullanıcı için AYRI veritabanı açılır
// (`kesem-<userId>`), bu yüzden veri kullanıcıya özeldir ve çıkış/giriş
// yapınca karışmaz. Tüm kayıtlar `id` anahtarlı; şema evrimi için
// `meta/schema` belgesi ve `MIGRATIONS` kullanılır (bkz. model/schema.js).
//
// Arayüz (Adapter) bilerek küçük: getAll / get / apply. İleride Supabase
// senkronizasyonu aynı arayüzü uygulayan bir adaptörle eklenebilir.

// Sürüm 2 (Parça 2): yalnızca YENİ depolar eklenir; mevcut kayıtlara dokunulmaz.
export const STORES = [
  "transactions", "categories", "accounts", "tags", "templates", "meta", "blobs",
  "installments", "recurrings", "people", "debts", "goals", "wishes", "shopping",
];
const DB_VERSION = 2;

const reqP = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function idbAdapter(db) {
  return {
    kind: "idb",
    getAll: (store) => reqP(db.transaction(store, "readonly").objectStore(store).getAll()),
    get: (store, id) => reqP(db.transaction(store, "readonly").objectStore(store).get(id)),
    // changes: [{ store, id, before, after }] — after === null → kaydı sil.
    // Hepsi TEK işlemde (atomik): ya hepsi yazılır ya hiçbiri.
    apply(changes) {
      if (!changes.length) return Promise.resolve();
      const names = [...new Set(changes.map((c) => c.store))];
      return new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction(names, "readwrite");
        } catch (e) {
          reject(e);
          return;
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("İşlem iptal edildi"));
        for (const c of changes) {
          const os = tx.objectStore(c.store);
          if (c.after) os.put(c.after);
          else os.delete(c.id);
        }
      });
    },
    close: () => db.close(),
  };
}

// IndexedDB yoksa/engelliyse (bazı gizli sekmeler) bellek içi yedek: uygulama
// çalışır ama veri oturum kapanınca gider — arayüz bunu kullanıcıya söyler.
export function memoryAdapter() {
  const data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  return {
    kind: "memory",
    getAll: async (store) => [...data[store].values()],
    get: async (store, id) => data[store].get(id),
    async apply(changes) {
      for (const c of changes) {
        if (c.after) data[c.store].set(c.id, c.after);
        else data[c.store].delete(c.id);
      }
    },
    close() {},
  };
}

export function openKesemDb(name) {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(memoryAdapter());
      return;
    }
    let settled = false;
    const done = (a) => {
      if (!settled) {
        settled = true;
        resolve(a);
      }
    };
    const timer = setTimeout(() => done(memoryAdapter()), 6000);
    let req;
    try {
      req = indexedDB.open(name, DB_VERSION);
    } catch {
      clearTimeout(timer);
      done(memoryAdapter());
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      const db = req.result;
      // Başka sekme sürüm yükseltirse bağlantıyı bırak (kilitlenmeyi önler).
      db.onversionchange = () => db.close();
      if (settled) db.close();
      else done(idbAdapter(db));
    };
    req.onerror = () => {
      clearTimeout(timer);
      done(memoryAdapter());
    };
    req.onblocked = () => {};
  });
}
