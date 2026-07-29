// Günlük rutin "bugün yaptım" tikleme durumu — rutin tablosunda tarih bazlı
// bir kolon olmadığı için localStorage'da, günün tarihine göre anahtarlanarak
// tutulur (gece yarısı otomatik sıfırlanmış olur). RoutinesPopover.jsx ve
// PlanBoard.jsx (Rutin rozetleri) ortak kullanır — tek doğruluk kaynağı.
import logger from "./logger";

const todayKey = new Date().toISOString().slice(0, 10);
const storeKey = (id) => `routine_${id}_${todayKey}`;

// localStorage private-tarama/quota gibi durumlarda throw edebilir — bu bir
// check-in senkronizasyon hatasıdır, uygulamayı çökertmemeli (WARN yeterli).
export function isRoutineChecked(id) {
  try {
    return localStorage.getItem(storeKey(id)) === "1";
  } catch (err) {
    logger.warn("ROUTINE_CHECKIN", "localStorage okunamadı", { routineId: id, error: err?.message });
    return false;
  }
}

export function setRoutineChecked(id, value) {
  try {
    if (value) localStorage.setItem(storeKey(id), "1");
    else localStorage.removeItem(storeKey(id));
  } catch (err) {
    logger.warn("ROUTINE_CHECKIN", "localStorage senkronize edilemedi", { routineId: id, value, error: err?.message });
  }
}
