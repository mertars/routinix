import { memo } from "react";

const PRIORITY_STYLE = {
  Yüksek: { color: "#FF6E92", bg: "rgba(244,64,107,0.14)" },
  Orta: { color: "var(--amber-accent)", bg: "rgba(240,179,126,0.14)" },
  Düşük: { color: "#6FCF97", bg: "rgba(111,207,151,0.14)" },
};

function openInMaps(query) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// Tek bir görev kartı — React.memo ile sarmalı: yalnızca KENDİ `task` referansı
// değiştiğinde (bkz. usePlanStudio.toggleTask'ın artık dokunulmayan görevleri
// aynı referansla bıraktığı yapı) yeniden render olur. `onToggle` ve `accent`/
// `soft` gibi diğer proplar sabit tutulduğu sürece, listedeki diğer kartlar bir
// tık sırasında ASLA yeniden render edilmez — mobildeki tik/seçim FPS düşüşünün
// düzeltmesi budur.
function TaskCard({ task, accent, soft, isVacation, onToggle }) {
  const pr = task.priority ? PRIORITY_STYLE[task.priority] : null;

  return (
    <div
      className="task-card rounded-2xl border p-3.5 card-glow"
      style={{ borderColor: task.is_completed ? "var(--border-header)" : `${accent}44`, background: "var(--bg-card)" }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(task.id, !task.is_completed)}
          className="w-6 h-6 rounded-full border flex items-center justify-center text-[11px] shrink-0 mt-0.5"
          style={{
            borderColor: task.is_completed ? "#2ED9A3" : "var(--border-strong)",
            background: task.is_completed ? "rgba(46,217,163,0.16)" : "transparent",
            color: "#2ED9A3",
          }}
          aria-label="Tamamlandı olarak işaretle"
        >
          {task.is_completed ? "✓" : ""}
        </button>
        <div className="flex-1 min-w-0">
          <p
            className="text-[14px] font-semibold leading-snug text-balance"
            style={{ color: task.is_completed ? "var(--text-faint)" : "var(--text-primary)", textDecoration: task.is_completed ? "line-through" : "none" }}
          >
            {task.title}
          </p>
          {task.detail && <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mt-1">{task.detail}</p>}

          {/* Şık rozetler: süre / öncelik / bütçe */}
          {(task.duration_min || pr || task.estimated_cost) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {task.duration_min ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--disabled-bg)", color: "#9BB0C0" }}>
                  ⏱ {task.duration_min} dk
                </span>
              ) : null}
              {pr && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: pr.bg, color: pr.color }}>
                  {task.priority}
                </span>
              )}
              {task.estimated_cost && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--disabled-bg)", color: "var(--amber-accent)" }}>
                  💰 {task.estimated_cost}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {isVacation && task.map_search_query && (
        <button
          onClick={() => openInMaps(task.map_search_query)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition-colors"
          style={{ background: soft, color: accent }}
        >
          📍 Konumu Haritada Aç
        </button>
      )}
    </div>
  );
}

// Nokta atışı karşılaştırıcı: `task` objesi usePlanStudio.toggleTask'ta yalnızca
// dokunulan görev için yeniden oluşturulduğundan (diğerleri aynı referansı
// korur), bu tam olarak "bu görev değişti mi?" sorusuna denk gelir.
export default memo(
  TaskCard,
  (prev, next) =>
    prev.task === next.task &&
    prev.accent === next.accent &&
    prev.soft === next.soft &&
    prev.isVacation === next.isVacation &&
    prev.onToggle === next.onToggle
);
