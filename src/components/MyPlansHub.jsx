import { useState, useEffect } from "react";
import { categoryOf } from "../constants";
import { fetchDashboardData } from "../services/planService";
import logger from "../utils/logger";

// "📂 Planlarım" — kullanıcının tüm kayıtlı planlarını ilerleme durumuyla
// listeleyen tam ekran glassmorphism hub. Karta tıklayınca modal kapanır ve
// ilgili planın board'u açılır (onOpenPlan → usePlanStudio.openSavedPlan).
export default function MyPlansHub({ open, userId, onOpenPlan, onClose }) {
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    fetchDashboardData(userId)
      .then((d) => !cancelled && setPlans(d))
      .catch((err) => logger.error("PLANS_HUB", "Planlar getirilemedi", { userId, error: err?.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  if (!open) return null;

  const list = plans || [];

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col animate-[fadeIn_0.2s_ease]"
      style={{ background: "rgba(var(--glass-rgb), var(--alpha-modal))", backdropFilter: "blur(28px) saturate(150%)", WebkitBackdropFilter: "blur(28px) saturate(150%)" }}
    >
      {/* Üst bar */}
      <div className="shrink-0 px-4 md:px-8 pt-5 pb-4 border-b border-slate-200 dark:border-white/8">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div>
            <h2 className="text-[18px] md:text-[22px] font-bold text-slate-900 dark:text-slate-100">📂 Planlarım</h2>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{list.length} aktif plan</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.06)" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Kart grid'i */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        <div className="max-w-6xl mx-auto w-full">
          {loading && !plans ? (
            <p className="text-[13px] text-slate-500 dark:text-slate-400 py-10 text-center font-medium">Yükleniyor...</p>
          ) : list.length === 0 ? (
            <p className="text-[13px] text-slate-500 dark:text-slate-400 py-10 text-center font-medium">Henüz kayıtlı bir planın yok.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((p) => {
                const cat = categoryOf(p.mode);
                const total = p.tasks.length;
                const done = p.tasks.filter((t) => t.is_completed).length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onOpenPlan(p.id);
                      onClose();
                    }}
                    className="glass rounded-2xl p-4 text-left flex flex-col gap-3 card-glow transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    style={{ borderColor: `${cat.accent}30` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[20px] shrink-0">{cat.emoji}</span>
                        <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 leading-snug truncate">{p.title || "Plan"}</h3>
                      </div>
                      {p.total_days ? (
                        <span
                          className="shrink-0 text-[10.5px] font-bold px-2 py-1 rounded-full"
                          style={{ background: cat.accentSoft, color: cat.accent }}
                        >
                          {p.total_days} Gün
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11.5px] font-semibold text-slate-600 dark:text-slate-300" style={{ fontFamily: "ui-monospace, monospace" }}>
                          {done}/{total} Görev
                        </span>
                        <span className="text-[11px] text-slate-500" style={{ fontFamily: "ui-monospace, monospace" }}>
                          %{pct}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--disabled-bg)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #B26BFF, #F4406B)" }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
