import { memo, useState } from "react";
import { ChevronRight, Play, MapPin } from "lucide-react";
import FocusSidePanel from "./FocusSidePanel";
import { WidgetAddButton, WidgetList } from "./TaskWidgets";

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

// "Mikro-Arayüz": görev kartı artık tek satır — görev adı ve bir Başlat
// butonundan ibaret; Pomodoro rozeti YALNIZCA `showPomodoro` (odak/çalışma
// kategorisi) true olduğunda ve süre verisi varsa görünür — tatil/fitness/genel
// rutin gibi zamanlama gerektirmeyen içeriklerde tamamen gizlenir, zorunlu
// değildir. Etiket/açıklama/bütçe gibi detaylar varsayılan olarak GİZLİ; satıra
// dokununca (checkbox/Başlat HARİÇ) mobilde alttan açılan Bottom Sheet,
// masaüstünde sağdan süzülen Drawer ile açılır (bkz. FocusSidePanel.jsx).
// Sert çerçeve YOK — yalnızca arka plan ton farkıyla (bg-white/5 eşleniği) ayrışır.
function TaskCard({ task, accent, soft, isVacation, showPomodoro, onToggle, onStartPomodoro, onUpdateWidgets }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const pr = task.priority ? PRIORITY_STYLE[task.priority] : null;
  const pomodoros = showPomodoro ? estimatePomodoros(task.duration_min) : null;
  const hasDetails = Boolean(task.detail || task.duration_min || pr || task.estimated_cost || (isVacation && task.map_search_query));
  // Önceliğe göre renklendirilir; öncelik yoksa planın kategori aksanına düşer.
  const stripColor = pr?.color || accent;
  const widgets = task.widgets || [];

  return (
    <>
      {/* Widget-Based Task System: kart artık "Bento" bir kapsayıcı — GERÇEK
          bir kenarlık (border) taşır (bkz. spesifikasyon: "bg-slate-900/80
          border border-slate-800 rounded-2xl p-4"). Sabit slate rengi YERİNE
          bilerek var(--bg-card)/var(--border-default) tema token'ları
          kullanıldı — bu ekran (PlanBoard/TaskCard) uygulamanın GERİ KALANI
          gibi tam açık/koyu tema desteğine sahip (Focus Studio'nun aksine,
          bkz. o dosyanın "BİLEREK sabit koyu" notu); sabit slate-900 burada
          açık temayı KIRARDI. Koyu temada zaten neredeyse AYNI görünüyor
          (--bg-card koyu değeri #101319 ~ slate-900). Widget YOKSA (mevcut
          planların ezici çoğunluğu) kart eskisi kadar KOMPAKT kalır —
          alt widget satırı yalnızca 1+ widget varken render edilir.
          Görev başlığının yanındaki "+" tetikleyicisi ise HER ZAMAN görünür. */}
      <div
        className="task-card rounded-2xl card-glow flex flex-col overflow-hidden"
        style={{
          background: task.is_completed ? "rgba(var(--overlay-rgb),0.03)" : "rgba(var(--overlay-rgb),0.05)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-3.5 pl-0 pr-3 py-3.5">
        <div className="self-stretch w-[3px] shrink-0 rounded-r-full" style={{ background: task.is_completed ? "var(--border-strong)" : stripColor }} />

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

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => hasDetails && setDetailOpen(true)}
              className="flex-1 min-w-0 flex items-center gap-2 text-left"
              disabled={!hasDetails}
            >
              <span
                className="flex-1 min-w-0 truncate text-[14px] font-bold"
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
            {/* Widget Ekle — başlığın YANINDA (spesifikasyon), ayrı bir
                <button> olduğu için üstteki başlık butonunun İÇİNE değil
                YANINA (iç içe <button> geçersiz HTML olurdu) konur. */}
            {onUpdateWidgets && <WidgetAddButton onAdd={(w) => onUpdateWidgets(task.id, [...widgets, w])} />}
          </div>

          {/* Gezi görevlerinde bütçe — ÖNCEDEN yalnızca detay çekmecesinde
              görünüyordu (FocusSidePanel, aşağıda), kullanıcı karta dokunmadan
              göremiyordu. Artık kartın kendisinde, ikinci/küçük bir satırda —
              ana satırı (checkbox/başlık/Pomodoro/play) kalabalıklaştırmadan.
              Harita butonu BURADAN kaldırıldı — artık sağdaki aksiyon
              grubunda (play ile yan yana), bkz. aşağısı. */}
          {isVacation && task.estimated_cost && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: "var(--disabled-bg)", color: "var(--amber-accent)" }}
              >
                🏷️ {task.estimated_cost}
              </span>
            </div>
          )}
        </div>

        {/* Harita aksiyonu — kompakt ikon buton, sağdaki aksiyon grubunda
            (Play'in solunda). `soft`/`accent` planın kategori temasından
            gelir (gezi kategorisinin aksanı zaten yeşilimsi, #2ED9A3) —
            projedeki HER yerde kullanılan aynı tema token deseni, sabit bir
            Tailwind rengi (ör. emerald-500) YAZILMADI ki açık/koyu tema ve
            diğer kategori aksanlarıyla tutarlı kalsın. Başlık butonunun
            DIŞINDA bağımsız bir kardeş eleman olduğundan tıklanınca detay
            çekmecesini açmaz; yine de stopPropagation defensif olarak
            eklendi (checkbox/play'deki AYNI desen). */}
        {isVacation && task.map_search_query && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.map_search_query)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Google Haritalar'da aç"
            title="Haritada Aç"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:opacity-80"
            style={{ background: soft, color: accent }}
          >
            <MapPin className="w-3.5 h-3.5" strokeWidth={2.25} />
          </a>
        )}

        {onStartPomodoro && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartPomodoro(task);
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

        {widgets.length > 0 && onUpdateWidgets && (
          <div className="pl-[55px] pr-3 pb-3.5">
            <WidgetList widgets={widgets} onChange={(next) => onUpdateWidgets(task.id, next)} />
          </div>
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
    prev.showPomodoro === next.showPomodoro &&
    prev.onToggle === next.onToggle &&
    prev.onStartPomodoro === next.onStartPomodoro &&
    prev.onUpdateWidgets === next.onUpdateWidgets
);
