import { memo, useState } from "react";
import { ChevronRight, Lightbulb, Clock, Flag, Wallet, Play, MapPin } from "lucide-react";
import { WidgetAddButton, WidgetList } from "./TaskWidgets";

const PRIORITY_STYLE = {
  Yüksek: { color: "#FF6E92", bg: "rgba(244,64,107,0.14)" },
  Orta: { color: "var(--amber-accent)", bg: "rgba(240,179,126,0.14)" },
  Düşük: { color: "#6FCF97", bg: "rgba(111,207,151,0.14)" },
};

// Backend (bkz. api/_lib/planPrompt.js WHY_IT_WORKS_RULE) her görevin
// description'ının SONUNA, tek tip "Neden Bu Görev?: " işaretiyle başlayan
// ayrı bir cümle olarak stratejik gerekçe gömer — şema/tuple şekli DEĞİŞMEDİ,
// tek bir string alanın İÇİNDE bir konvansiyon. Burada bu işaretten ayrıştırıp
// "ana açıklama" + "gerekçe"yi ayrı, rozetli bölümler olarak gösteriyoruz.
// İşaret yoksa (eski planlar, ya da model kuralı atladıysa) `why` boş kalır,
// tüm metin `main`'e düşer — GERİYE DÖNÜK UYUMLU, hiçbir şey kaybolmaz.
const WHY_MARKER = "Neden Bu Görev?:";

function parseTaskDetail(detail) {
  if (!detail) return { main: "", why: "" };
  const idx = detail.indexOf(WHY_MARKER);
  if (idx === -1) return { main: detail.trim(), why: "" };
  return { main: detail.slice(0, idx).trim(), why: detail.slice(idx + WHY_MARKER.length).trim() };
}

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

// "Mikro-Arayüz": görev kartı tek satır — görev adı ve bir Başlat butonundan
// ibaret; Pomodoro rozeti YALNIZCA `showPomodoro` (odak/çalışma kategorisi)
// true olduğunda ve süre verisi varsa görünür. Etiket/açıklama/bütçe gibi
// detaylar varsayılan olarak GİZLİ; başlığa dokununca kartın KENDİ İÇİNDE,
// tam altında AÇILAN bir inline accordion ile gösterilir (ESKİDEN ayrı bir
// fixed-position FocusSidePanel/Drawer-Bottom-Sheet kullanılıyordu — bu,
// listenin akışı DIŞINDA bir overlay olduğundan "ekranın en altına yapışan,
// kartla ilişkisi belirsiz panel" hissi veriyordu; artık detay DOĞRUDAN
// tıklanan kartın gövdesinin bir parçası, aynı `rounded-2xl` sınır içinde).
// Sert çerçeve YOK — yalnızca arka plan ton farkıyla (bg-white/5 eşleniği) ayrışır.
function TaskCard({ task, accent, soft, isVacation, showPomodoro, onToggle, onStartPomodoro, onUpdateWidgets }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const pr = task.priority ? PRIORITY_STYLE[task.priority] : null;
  const pomodoros = showPomodoro ? estimatePomodoros(task.duration_min) : null;
  const hasDetails = Boolean(task.detail || task.duration_min || pr || task.estimated_cost || (isVacation && task.map_search_query));
  const { main, why } = parseTaskDetail(task.detail);
  // Önceliğe göre renklendirilir; öncelik yoksa planın kategori aksanına düşer.
  const stripColor = pr?.color || accent;
  const widgets = task.widgets || [];

  return (
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
            {/* Tek tetikleyici: tıklama anında AÇIK/KAPALI durumunu tersine
                çevirir (önceden yalnızca `true`'ya sabitliyordu, kapatmak için
                ayrı bir X/backdrop'a muhtaçtı — artık aynı buton hem açar hem
                kapatır, gecikme/çoklu-tıklama hissi yaratan ekstra dolaylama
                YOK). disabled tek koşul (`!hasDetails`) — rakip/iç içe başka
                bir onClick handler'ı bu butonun ÜZERİNDE YOK. */}
            <button
              onClick={() => hasDetails && setDetailOpen((v) => !v)}
              className="flex-1 min-w-0 flex items-center gap-2 text-left"
              disabled={!hasDetails}
              aria-expanded={detailOpen}
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
              {hasDetails && (
                <ChevronRight
                  className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
                  style={{ color: "var(--text-faint)", transform: detailOpen ? "rotate(90deg)" : "none" }}
                />
              )}
            </button>
            {/* Widget Ekle — başlığın YANINDA (spesifikasyon), ayrı bir
                <button> olduğu için üstteki başlık butonunun İÇİNE değil
                YANINA (iç içe <button> geçersiz HTML olurdu) konur. */}
            {onUpdateWidgets && <WidgetAddButton onAdd={(w) => onUpdateWidgets(task.id, [...widgets, w])} />}
          </div>

          {/* Gezi görevlerinde bütçe — kartın kendisinde, ikinci/küçük bir
              satırda; ana satırı (checkbox/başlık/Pomodoro/play) kalabalıklaştırmadan. */}
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
            (Play'in solunda). Başlık butonunun DIŞINDA bağımsız bir kardeş
            eleman olduğundan tıklanınca accordion'u açıp kapatmaz; yine de
            stopPropagation defensif olarak eklendi (checkbox/play'deki AYNI desen). */}
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

      {/* Görev Açıklama Kartı — INLINE accordion, tıklanan kartın KENDİ
          gövdesinin bir parçası (ayrı bir fixed overlay/drawer DEĞİL).
          `grid-template-rows: 0fr → 1fr` tekniği: içeriğin gerçek yüksekliği
          ÖNCEDEN bilinmese de (metin uzunluğu değişken) pürüzsüz açılıp
          kapanmasını sağlar — sabit bir `max-height` tahmini gerekmez, ani
          zıplama/kırpılma olmaz. İç `overflow-hidden` sarmalayıcı, kapalıyken
          (0fr) içeriğin taşmasını gizler. */}
      {hasDetails && (
        <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: detailOpen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <div
              className="mx-3 mb-3.5 rounded-xl backdrop-blur-md p-3.5 flex flex-col gap-3"
              style={{ background: "rgba(var(--overlay-rgb),0.06)", border: "1px solid var(--border-default)" }}
            >
              {why && (
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 mt-0.5 rounded-md flex items-center justify-center shrink-0" style={{ background: soft, color: accent }}>
                    <Lightbulb className="w-3 h-3" strokeWidth={2.5} />
                  </span>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: accent }}>
                      Neden Bu Görev?
                    </span>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {why}
                    </p>
                  </div>
                </div>
              )}

              {main && (
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {main}
                </p>
              )}

              {(task.duration_min || pr || task.estimated_cost) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {task.duration_min ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: "var(--disabled-bg)", color: "#9BB0C0" }}
                    >
                      <Clock className="w-2.5 h-2.5" strokeWidth={2.5} /> {task.duration_min} dk
                    </span>
                  ) : null}
                  {pr && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-full" style={{ background: pr.bg, color: pr.color }}>
                      <Flag className="w-2.5 h-2.5" strokeWidth={2.5} /> {task.priority}
                    </span>
                  )}
                  {task.estimated_cost && (
                    <span
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: "var(--disabled-bg)", color: "var(--amber-accent)" }}
                    >
                      <Wallet className="w-2.5 h-2.5" strokeWidth={2.5} /> {task.estimated_cost}
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
                  <MapPin className="w-3.5 h-3.5" strokeWidth={2.25} /> Konumu Haritada Aç
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {widgets.length > 0 && onUpdateWidgets && (
        <div className="pl-[55px] pr-3 pb-3.5">
          <WidgetList widgets={widgets} onChange={(next) => onUpdateWidgets(task.id, next)} />
        </div>
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
    prev.showPomodoro === next.showPomodoro &&
    prev.onToggle === next.onToggle &&
    prev.onStartPomodoro === next.onStartPomodoro &&
    prev.onUpdateWidgets === next.onUpdateWidgets
);
