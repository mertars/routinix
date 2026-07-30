import { useState, useEffect } from "react";
import { routineEmoji, routineFrequencyLabel } from "../utils/routineText";
import { isRoutineChecked, setRoutineChecked } from "../utils/routineCheckin";

// 🔁 Rutin Detayları — merkezi, tema-duyarlı modal. Hem PlanBoard'daki (plan
// içi) hem RoutinesPopover'daki (Rutinler ekranı) rutin kartlarından AYNI
// bileşen açılır: tam metin (hiçbir kısaltma yok), sıklık ve bağlı plan tek
// bakışta okunur. Günlük "yaptım" tikleme kendi kendine yeterli — paylaşılan
// localStorage check-in anahtarını (utils/routineCheckin.js) doğrudan okur/
// yazar, dışarıdan bir state/callback gerekmez.
export default function RoutineDetailModal({ open, onClose, routine, cat, planTitle, onToggled }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (open && routine) setChecked(isRoutineChecked(routine.id));
  }, [open, routine]);

  if (!open || !routine) return null;

  const toggle = () => {
    setChecked((prev) => {
      const next = !prev;
      setRoutineChecked(routine.id, next);
      onToggled?.(routine.id, next);
      return next;
    });
  };
  const freq = routineFrequencyLabel(routine.frequency);

  return (
    <>
      <div className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="pop-in fixed inset-0 z-[86] flex items-center justify-center px-5" onClick={onClose}>
        <div
          className="w-full max-w-[420px] rounded-2xl p-5 shadow-2xl"
          style={{
            background: "rgba(var(--glass-rgb), var(--alpha-modal))",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid var(--modal-border)",
            boxShadow: "0 24px 60px -18px rgba(0,0,0,0.75)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px] shrink-0" style={{ background: cat.accentSoft }}>
                {routineEmoji(routine.content)}
              </span>
              <span className="text-[10.5px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: cat.accentSoft, color: cat.accent }}>
                {planTitle}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0"
              style={{ background: "rgba(var(--overlay-rgb),0.06)" }}
            >
              ✕
            </button>
          </div>

          {/* Tam metin — kısaltma/line-clamp YOK */}
          <p className="text-[14px] font-medium leading-relaxed break-words text-gray-900 dark:text-gray-100">{routine.content}</p>

          <div className="flex items-center gap-1.5 mt-3.5">
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-muted)" }}
            >
              {freq.icon} {freq.label}
            </span>
          </div>

          <button
            onClick={toggle}
            className={`mt-4 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-all ${checked ? "check-glow" : ""}`}
            style={{
              background: checked ? "rgba(46,217,163,0.16)" : "rgba(var(--overlay-rgb),0.06)",
              color: checked ? "#2ED9A3" : "var(--text-primary)",
              border: `1px solid ${checked ? "rgba(46,217,163,0.4)" : "var(--modal-border)"}`,
            }}
          >
            {checked ? "✓ Bugün Yapıldı" : "Bugün İçin İşaretle"}
          </button>
        </div>
      </div>
    </>
  );
}
