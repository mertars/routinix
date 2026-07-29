import { useState, useEffect } from "react";
import { categoryOf } from "../constants";
import { fetchDashboardData, setTaskCompleted } from "../services/planService";
import logger from "../utils/logger";

// Bir planın "bugün"ü: ilk tamamlanmamış görev içeren gün; yoksa ilk gün.
function todayOf(tasks) {
  const byDay = new Map();
  for (const t of tasks || []) {
    const d = t.day_number ?? 1;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(t);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  if (!days.length) return { day: null, tasks: [] };
  const firstIncomplete = days.find((d) => byDay.get(d).some((t) => !t.is_completed));
  const day = firstIncomplete ?? days[0];
  return { day, tasks: byDay.get(day) };
}

// Tek bir planın "o günün görevleri" bölümü — kompakt akordeon.
function PlanAccordion({ plan, onToggle }) {
  const [open, setOpen] = useState(false);
  const cat = categoryOf(plan.mode);
  const { day, tasks } = todayOf(plan.tasks);
  const done = tasks.filter((t) => t.is_completed).length;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${cat.accent}30`, background: "rgba(var(--overlay-rgb),0.03)" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <span className="text-[14px] shrink-0">{cat.emoji}</span>
        <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{plan.title || "Plan"}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: cat.accentSoft, color: cat.accent }}>
          {done}/{tasks.length}
        </span>
        <span className={`accordion-chevron text-[var(--text-muted)] text-[11px] ${open ? "open" : ""}`}>▾</span>
      </button>
      <div className={`accordion-body ${open ? "open" : ""}`}>
        <div className="accordion-inner">
          <div className="px-3 pb-3 pt-0.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: cat.accent }}>
              {day ? `${day}. Günün Görevleri` : "Görev yok"}
            </p>
            <div className="flex flex-col gap-1.5">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onToggle(plan.id, t.id, !t.is_completed)}
                  className="w-full text-left flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <span
                    className="w-4 h-4 rounded-[5px] border flex items-center justify-center text-[9px] shrink-0 mt-0.5"
                    style={{
                      borderColor: t.is_completed ? "#2ED9A3" : "var(--border-strong)",
                      background: t.is_completed ? "rgba(46,217,163,0.16)" : "transparent",
                      color: "#2ED9A3",
                    }}
                  >
                    {t.is_completed ? "✓" : ""}
                  </span>
                  <span
                    className="text-[12.5px] font-medium leading-relaxed text-slate-900 dark:text-slate-100"
                    style={{ opacity: t.is_completed ? 0.55 : 1, textDecoration: t.is_completed ? "line-through" : "none" }}
                  >
                    {t.title}
                  </span>
                </button>
              ))}
              {tasks.length === 0 && <p className="text-[11px] text-[var(--text-faint)] px-2">Bu plan için görev bulunamadı.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// "Bugünün Görevleri" popover'ı: tüm planların rutinleri (plan rozetli) + plan
// bazında bugünün görevleri akordeonu.
export default function TodayPopover({ open, userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    fetchDashboardData(userId)
      .then((d) => !cancelled && setData(d))
      .catch((err) => logger.error("TODAY", "Bugünün verisi getirilemedi", { userId, error: err?.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const plans = data || [];
  const toggle = (planId, taskId, next) => {
    setData((prev) =>
      (prev || []).map((p) =>
        p.id !== planId ? p : { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, is_completed: next } : t)) }
      )
    );
    setTaskCompleted(taskId, next).catch((err) => logger.error("TASK", "Görev güncellenemedi", { taskId, error: err?.message }));
  };

  return (
    <>
      <div className="fixed inset-0 z-[65]" onClick={onClose} />
      <div
        className="pop-in fixed top-[62px] right-3 z-[70] w-[calc(100vw-24px)] max-w-[380px] rounded-2xl p-4 shadow-2xl font-sans"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: "0 24px 60px -18px rgba(0,0,0,0.75), inset 0 1px 22px -14px rgba(178,107,255,0.5)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">⚡ Bugünün Görevleri</h3>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.05)" }}
          >
            ✕
          </button>
        </div>

        {loading && !data ? (
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400 py-6 text-center font-medium">Yükleniyor...</p>
        ) : plans.length === 0 ? (
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400 py-6 text-center font-medium">Henüz aktif planın yok.</p>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto no-scrollbar flex flex-col gap-2">
            {plans.map((p) => (
              <PlanAccordion key={p.id} plan={p} onToggle={toggle} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
