import { useState, useEffect } from "react";
import { categoryOf } from "../constants";
import { fetchDashboardData } from "../services/planService";
import logger from "../utils/logger";

// Uzun rutin metnini eylem odaklı kısa etikete indirger + duruma göre emoji seçer.
const KEYWORD_EMOJI = [
  [/(plaj|deniz|kumsal|koy|tekne)/i, "🏖️"],
  [/(sabah|erken|uyan|kalk)/i, "🌅"],
  [/(koş|kardiyo|yürü|cardio)/i, "🏃"],
  [/(\bsu\b|hidra|matara)/i, "💧"],
  [/(kitap|oku|makale|döküman)/i, "📚"],
  [/(kod|yazılım|program|docker|git|api)/i, "💻"],
  [/(kelime|anki|srs|tekrar|spaced)/i, "🧠"],
  [/(beslen|protein|öğün|yemek|diyet|kalori)/i, "🥗"],
  [/(uyku|dinlen|toparlan|recovery)/i, "😴"],
  [/(esne|mobility|ısın|stretch)/i, "🤸"],
  [/(medita|nefes|zihin|farkındalık)/i, "🧘"],
  [/(pratik|egzersiz|çalış|antren)/i, "✍️"],
  [/(fotoğraf|gez|rota|ziyaret)/i, "📍"],
];
function routineEmoji(text) {
  for (const [re, e] of KEYWORD_EMOJI) if (re.test(text)) return e;
  return "🔁";
}
function microLabel(text) {
  let s = (text || "").trim();
  s = s.replace(/^[^:]{0,22}:\s*/, ""); // "Sabah (15 dk): ..." önekini at
  s = s.split(/[.;]|\s[—-]\s/)[0].trim(); // ilk cümle/clause
  if (s.length > 34) s = s.slice(0, 33).trim() + "…";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const todayKey = new Date().toISOString().slice(0, 10);
const storeKey = (id) => `routine_${id}_${todayKey}`;

// localStorage private-tarama/quota gibi durumlarda throw edebilir — bu bir
// check-in senkronizasyon hatasıdır, uygulamayı çökertmemeli (WARN yeterli).
function readCheckin(id) {
  try {
    return localStorage.getItem(storeKey(id)) === "1";
  } catch (err) {
    logger.warn("ROUTINE_CHECKIN", "localStorage okunamadı", { routineId: id, error: err?.message });
    return false;
  }
}
function writeCheckin(id, value) {
  try {
    if (value) localStorage.setItem(storeKey(id), "1");
    else localStorage.removeItem(storeKey(id));
  } catch (err) {
    logger.warn("ROUTINE_CHECKIN", "localStorage senkronize edilemedi", { routineId: id, value, error: err?.message });
  }
}

// "🔁 Rutinler" popover'ı: tüm planların günlük rutinlerini kompakt tikleme
// çipleri (2'li grid) olarak gösterir. Günlük check-in localStorage'da tutulur
// (rutin tablosunda tarih-bazlı kolon olmadığı için sayfa yenilense de korunur).
export default function RoutinesPopover({ open, userId, onClose }) {
  const [routines, setRoutines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState({}); // { [routineId]: true }
  const [infoId, setInfoId] = useState(null); // açık ℹ️ baloncuğu

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    fetchDashboardData(userId)
      .then((plans) => {
        if (cancelled) return;
        const flat = plans.flatMap((p) =>
          (p.routines || []).map((r) => ({ ...r, planTitle: p.title || "Plan", mode: p.mode }))
        );
        setRoutines(flat);
        // localStorage'dan bugünün check-in durumları
        const init = {};
        for (const r of flat) if (readCheckin(r.id)) init[r.id] = true;
        setChecked(init);
      })
      .catch((err) => logger.error("ROUTINES", "Rutinler getirilemedi", { userId, error: err?.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const toggle = (id) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeCheckin(id, next[id]);
      return next;
    });
  };

  const list = routines || [];

  return (
    <>
      <div className="fixed inset-0 z-[65]" onClick={onClose} />
      <div
        className="pop-in fixed top-[62px] right-3 z-[70] w-[calc(100vw-24px)] max-w-[400px] rounded-2xl p-4 shadow-2xl font-sans"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: "0 24px 60px -18px rgba(0,0,0,0.75), inset 0 1px 22px -14px rgba(46,217,163,0.45)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">🔁 Günlük Rutinler</h3>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.05)" }}
          >
            ✕
          </button>
        </div>

        {loading && !routines ? (
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400 py-6 text-center font-medium">Yükleniyor...</p>
        ) : list.length === 0 ? (
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400 py-6 text-center font-medium">Aktif planlarında rutin bulunmuyor.</p>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto no-scrollbar grid grid-cols-2 gap-2">
            {list.map((r, i) => {
              const on = !!checked[r.id];
              const cat = categoryOf(r.mode);
              const showInfo = infoId === (r.id || i);
              return (
                <div
                  key={r.id || i}
                  className="relative glass rounded-xl p-2.5 flex items-start gap-2"
                  style={{ borderColor: on ? "rgba(46,217,163,0.45)" : `${cat.accent}22` }}
                >
                  <button
                    onClick={() => toggle(r.id)}
                    className={`shrink-0 mt-0.5 w-5 h-5 rounded-[6px] border flex items-center justify-center text-[10px] ${on ? "check-glow" : ""}`}
                    style={{
                      borderColor: on ? "#2ED9A3" : "var(--border-strong)",
                      background: on ? "rgba(46,217,163,0.18)" : "transparent",
                      color: "#2ED9A3",
                    }}
                    aria-label="Bugün için işaretle"
                  >
                    {on ? "✓" : ""}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1">
                      <span className="text-[13px] leading-none mt-0.5">{routineEmoji(r.content)}</span>
                      <span
                        className="flex-1 text-[12.5px] font-medium leading-relaxed text-slate-900 dark:text-slate-100"
                        style={{ textDecoration: on ? "line-through" : "none", opacity: on ? 0.6 : 1 }}
                      >
                        {microLabel(r.content)}
                      </span>
                      <button
                        onClick={() => setInfoId(showInfo ? null : r.id || i)}
                        title={r.content}
                        aria-label="Detay"
                        className="shrink-0 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-[12px] leading-none mt-0.5"
                      >
                        ℹ️
                      </button>
                    </div>
                    <span
                      className="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: cat.accentSoft, color: cat.accent }}
                    >
                      {r.planTitle.length > 12 ? r.planTitle.slice(0, 11) + "…" : r.planTitle}
                    </span>
                  </div>

                  {/* ℹ️ baloncuğu — tam metin */}
                  {showInfo && (
                    <div
                      className="absolute z-10 left-2 right-2 top-full mt-1 rounded-lg p-2.5 text-[11.5px] font-medium leading-relaxed text-slate-900 dark:text-slate-100"
                      style={{ background: "rgba(var(--glass-rgb), var(--alpha-modal))", border: "1px solid rgba(var(--overlay-rgb),0.12)", boxShadow: "0 12px 30px -10px rgba(0,0,0,0.8)" }}
                      onClick={() => setInfoId(null)}
                    >
                      {r.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
