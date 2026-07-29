import { memo, useState } from "react";
import { ChevronRight, Play } from "lucide-react";
import FocusSidePanel from "./FocusSidePanel";

const PRIORITY_STYLE = {
  Yüksek: { color: "#FF6E92", bg: "rgba(244,64,107,0.14)" },
  Orta: { color: "var(--amber-accent)", bg: "rgba(240,179,126,0.14)" },
  Düşük: { color: "#6FCF97", bg: "rgba(111,207,151,0.14)" },
};

function openInMaps(query) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// Bir görevin süresinden kabaca kaç Pomodoro (25dk) birimi tuttuğunu tahmin
// eder. Veri yoksa null döner — sahte bir sayı UYDURULMAZ.
function estimatePomodoros(durationMin) {
  if (!durationMin) return null;
  return Math.max(1, Math.round(durationMin / 25));
}

// "Mikro-Arayüz": görev kartı artık tek satır — görev adı, tahmini Pomodoro
// sayısı ve bir Başlat butonundan ibaret. Etiket/açıklama/bütçe gibi detaylar
// varsayılan olarak GİZLİ; satıra dokununca (checkbox/Başlat HARİÇ) mobilde
// alttan açılan Bottom Sheet, masaüstünde sağdan süzülen Drawer ile açılır
// (bkz. FocusSidePanel.jsx — genel amaçlı duyarlı Drawer/Bottom Sheet
// primitifi). Sert çerçeve yerine ton farkı: tamamlanmamış görev biraz daha
// belirgin bir zemin tonu taşır, tamamlanmış görev soluklaşır.
function TaskCard({ task, accent, soft, isVacation, onToggle, onStartPomodoro }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const pr = task.priority ? PRIORITY_STYLE[task.priority] : null;
  const pomodoros = estimatePomodoros(task.duration_min);
  const hasDetails = Boolean(task.detail || task.duration_min || pr || task.estimated_cost || (isVacation && task.map_search_query));

  return (
    <>
      <div
        className="task-card rounded-2xl card-glow flex items-center gap-3 pl-3.5 pr-2.5 py-3"
        style={{ background: task.is_completed ? "rgba(var(--overlay-rgb),0.03)" : "rgba(var(--overlay-rgb),0.05)" }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id, !task.is_completed);
          }}
          className="w-6 h-6 rounded-full border flex items-center justify-center text-[11px] shrink-0"
          style={{
            borderColor: task.is_completed ? "#2ED9A3" : "var(--border-strong)",
            background: task.is_completed ? "rgba(46,217,163,0.16)" : "transparent",
            color: "#2ED9A3",
          }}
          aria-label="Tamamlandı olarak işaretle"
        >
          {task.is_completed ? "✓" : ""}
        </button>

        <button
          onClick={() => hasDetails && setDetailOpen(true)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
          disabled={!hasDetails}
        >
          <span
            className="flex-1 min-w-0 truncate text-[13.5px] font-semibold"
            style={{ color: task.is_completed ? "var(--text-faint)" : "var(--text-primary)", textDecoration: task.is_completed ? "line-through" : "none" }}
          >
            {task.title}
          </span>
          {pomodoros ? (
            <span className="shrink-0 text-[10.5px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: soft, color: accent }}>
              🍅×{pomodoros}
            </span>
          ) : null}
          {hasDetails && <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />}
        </button>

        {onStartPomodoro && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartPomodoro(task.id);
            }}
            aria-label="Bu görev için Pomodoro başlat"
            title="Pomodoro'da başlat"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: soft, color: accent }}
          >
            <Play className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
          </button>
        )}
      </div>

      {hasDetails && (
        <FocusSidePanel open={detailOpen} onClose={() => setDetailOpen(false)} side="right" title={task.title}>
          <div className="flex flex-col gap-4">
            {task.detail && <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{task.detail}</p>}

            {(task.duration_min || pr || task.estimated_cost) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {task.duration_min ? (
                  <span className="text-[10.5px] font-semibold px-2 py-1 rounded-full" style={{ background: "var(--disabled-bg)", color: "#9BB0C0" }}>
                    ⏱ {task.duration_min} dk
                  </span>
                ) : null}
                {pr && (
                  <span className="text-[10.5px] font-semibold px-2 py-1 rounded-full" style={{ background: pr.bg, color: pr.color }}>
                    {task.priority}
                  </span>
                )}
                {task.estimated_cost && (
                  <span className="text-[10.5px] font-semibold px-2 py-1 rounded-full" style={{ background: "var(--disabled-bg)", color: "var(--amber-accent)" }}>
                    💰 {task.estimated_cost}
                  </span>
                )}
              </div>
            )}

            {isVacation && task.map_search_query && (
              <button
                onClick={() => openInMaps(task.map_search_query)}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[12.5px] font-semibold transition-colors"
                style={{ background: soft, color: accent }}
              >
                📍 Konumu Haritada Aç
              </button>
            )}
          </div>
        </FocusSidePanel>
      )}
    </>
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
    prev.onToggle === next.onToggle &&
    prev.onStartPomodoro === next.onStartPomodoro
);
