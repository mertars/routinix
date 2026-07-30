import { useState, useEffect } from "react";
import { categoryOf } from "../constants";
import { fetchDashboardData } from "../services/planService";
import logger from "../utils/logger";
import { routineEmoji, routineMicroLabel } from "../utils/routineText";
import { isRoutineChecked as readCheckin, setRoutineChecked as writeCheckin } from "../utils/routineCheckin";
import RoutineDetailModal from "./RoutineDetailModal";

// "🔁 Rutinler" popover'ı: tüm planların günlük rutinlerini tek sütunlu,
// okunaklı kartlar olarak gösterir (başlık 2 satıra kadar kesilmeden sarar,
// tam metin önizlemesi de 2 satıra kadar görünür — hiçbir yerde manuel
// karakter kesme YOK). Karta tıklayınca tam metni/sıklığı/planı gösteren
// RoutineDetailModal açılır. Günlük check-in localStorage'da tutulur (rutin
// tablosunda tarih-bazlı kolon olmadığı için sayfa yenilense de korunur).
export default function RoutinesPopover({ open, userId, onClose }) {
  const [routines, setRoutines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState({}); // { [routineId]: true }
  const [detailRoutine, setDetailRoutine] = useState(null);

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

  const toggle = (e, id) => {
    e.stopPropagation();
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeCheckin(id, next[id]);
      return next;
    });
  };

  // Detay modalından tiklenirse listedeki checkbox'ın da anında yansıması için.
  const syncFromModal = (id, next) => {
    setChecked((prev) => ({ ...prev, [id]: next }));
  };

  const list = routines || [];
  const detailCat = detailRoutine ? categoryOf(detailRoutine.mode) : null;

  return (
    <>
      <div className="fixed inset-0 z-[65]" onClick={onClose} />
      <div
        className="pop-in fixed top-[62px] right-3 z-[70] w-[calc(100vw-24px)] max-w-[420px] rounded-2xl p-4 shadow-2xl font-sans"
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
          <div className="max-h-[70vh] overflow-y-auto no-scrollbar flex flex-col gap-2.5">
            {list.map((r, i) => {
              const on = !!checked[r.id];
              const cat = categoryOf(r.mode);
              return (
                <div
                  key={r.id || i}
                  onClick={() => setDetailRoutine(r)}
                  role="button"
                  tabIndex={0}
                  className="glass rounded-2xl p-4 flex flex-col gap-1.5 transition-colors cursor-pointer"
                  style={{ borderColor: on ? "rgba(46,217,163,0.45)" : `${cat.accent}22` }}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={(e) => toggle(e, r.id)}
                      className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-[11px] ${on ? "check-glow" : ""}`}
                      style={{
                        borderColor: on ? "#2ED9A3" : "var(--border-strong)",
                        background: on ? "rgba(46,217,163,0.18)" : "transparent",
                        color: "#2ED9A3",
                      }}
                      aria-label="Bugün için işaretle"
                    >
                      {on ? "✓" : routineEmoji(r.content)}
                    </button>
                    <p
                      className="flex-1 min-w-0 text-[14px] font-semibold leading-relaxed break-words line-clamp-2 text-gray-900 dark:text-gray-100"
                      style={{ textDecoration: on ? "line-through" : "none", opacity: on ? 0.6 : 1 }}
                    >
                      {routineMicroLabel(r.content)}
                    </p>
                  </div>
                  <p className="pl-[34px] text-[12.5px] leading-relaxed break-words line-clamp-2 text-gray-600 dark:text-gray-300">{r.content}</p>
                  <span
                    className="ml-[34px] inline-block w-fit text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: cat.accentSoft, color: cat.accent }}
                  >
                    {r.planTitle}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RoutineDetailModal
        open={!!detailRoutine}
        onClose={() => setDetailRoutine(null)}
        routine={detailRoutine}
        cat={detailCat}
        planTitle={detailRoutine?.planTitle}
        onToggled={syncFromModal}
      />
    </>
  );
}
