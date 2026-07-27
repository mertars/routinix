import { MONO_FONT, categoryOf } from "../constants";

// Rutin sıklık anahtarını (frequency) minik ikon + Türkçe etikete çevirir.
// "weekly" gibi teknik metni ham göstermek yerine döngü ikonuyla görselleştirir.
const FREQUENCY_META = {
  daily: { icon: "🔆", label: "Günlük" },
  weekly: { icon: "🔁", label: "Haftalık" },
  biweekly: { icon: "🔁", label: "2 Haftada" },
  monthly: { icon: "🗓️", label: "Aylık" },
};
function frequencyMeta(freq) {
  const key = String(freq || "weekly").toLowerCase();
  return FREQUENCY_META[key] || { icon: "🔁", label: freq || "Düzenli" };
}

// Aktif plan ekranı: üstte sabit başlık + genel ilerleme, altında genel
// rutinler ve hafta hafta (gün → görev) tam açık liste. Görevler checkbox ile
// tamamlanır (DB'ye yansır); en altta "Sonraki Haftayı Oluştur" ile lazy-load.
export default function PlanBoard({
  plan,
  routines,
  weeks,
  overallPct,
  completedTasks,
  totalTasks,
  loadingNextWeek,
  nextWeekError,
  onToggleTask,
  onLoadNextWeek,
  onBack,
}) {
  if (!plan) return null;
  const cat = categoryOf(plan.mode);
  const accent = cat.accent;
  const soft = cat.accentSoft;
  const isVacation = plan.mode === "vacation";

  const openInMaps = (query) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease]">
      {/* Başlık + genel ilerleme */}
      <div>
        <button onClick={onBack} className="text-[12px] font-medium text-[#8695A3] hover:text-[#ECF2F4] transition-colors mb-3">
          ‹ Ana Sayfa
        </button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{cat.emoji}</span>
          <h1 className="text-[18px] font-bold leading-snug text-balance text-[#ECF2F4]">{plan.title || "Planım"}</h1>
        </div>
        {plan.summary && <p className="text-[12.5px] text-[#8695A3] leading-relaxed">{plan.summary}</p>}

        <div className="flex items-center justify-between mt-4 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: accent, fontFamily: MONO_FONT }}>
            {completedTasks}/{totalTasks} görev
          </span>
          <span className="text-[11px] text-[#55636F]" style={{ fontFamily: MONO_FONT }}>
            %{overallPct} tamamlandı
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1A222B" }}>
          <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${overallPct}%`, background: accent }} />
        </div>
      </div>

      {/* Genel rutinler — modern ikonlu kartlar */}
      {routines.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: accent }}>
            Genel Rutinler
          </p>
          <div className="flex flex-col gap-2.5">
            {routines.map((r, i) => {
              const fm = frequencyMeta(r.frequency);
              return (
                <div
                  key={r.id || i}
                  className="rounded-2xl border p-3.5 flex items-start gap-3"
                  style={{ borderColor: `${accent}33`, background: "#12181F" }}
                >
                  {/* Süreklilik ikonu (döngü) */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] shrink-0"
                    style={{ background: soft }}
                    aria-hidden="true"
                  >
                    {fm.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full mb-1.5"
                      style={{ background: soft, color: accent }}
                    >
                      {fm.label}
                    </span>
                    <p className="text-[13px] text-[#C5D0D8] leading-relaxed">{r.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Haftalar */}
      {weeks.map((w) => (
        <div key={w.weekNumber} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[10.5px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: soft, color: accent, fontFamily: MONO_FONT }}
            >
              {w.weekNumber}. HAFTA
            </span>
          </div>

          {w.days.map((d) => (
            <div key={d.dayNumber} className="rounded-2xl border p-4" style={{ borderColor: "#232C36", background: "#12181F" }}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: "#55636F" }}>
                {d.dayNumber}. Gün
              </p>
              <div className="flex flex-col gap-2.5">
                {d.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border p-3.5"
                    style={{ borderColor: t.is_completed ? "#1E2731" : "#232C36", background: "#0F151B" }}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => onToggleTask(t.id, !t.is_completed)}
                        className="w-6 h-6 rounded-full border flex items-center justify-center text-[11px] shrink-0 mt-0.5"
                        style={{
                          borderColor: t.is_completed ? "#2ED9A3" : "#3A4653",
                          background: t.is_completed ? "rgba(46,217,163,0.16)" : "transparent",
                          color: "#2ED9A3",
                        }}
                        aria-label="Tamamlandı olarak işaretle"
                      >
                        {t.is_completed ? "✓" : ""}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[14px] font-semibold leading-snug text-balance"
                          style={{ color: t.is_completed ? "#55636F" : "#ECF2F4", textDecoration: t.is_completed ? "line-through" : "none" }}
                        >
                          {t.title}
                        </p>
                        {t.detail && <p className="text-[12px] text-[#8695A3] leading-relaxed mt-1">{t.detail}</p>}
                        {(t.estimated_cost || (isVacation && t.map_search_query)) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {t.estimated_cost && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#1A222B", color: "#F0B37E" }}>
                                💰 {t.estimated_cost}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isVacation && t.map_search_query && (
                      <button
                        onClick={() => openInMaps(t.map_search_query)}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-semibold transition-colors"
                        style={{ background: soft, color: accent }}
                      >
                        📍 Konumu Haritada Aç
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Lazy-load: sonraki hafta */}
      <div className="flex flex-col gap-2">
        {nextWeekError && (
          <p className="text-[12px] font-medium text-center" style={{ color: "#F0827A" }}>
            {nextWeekError}
          </p>
        )}
        <button
          onClick={onLoadNextWeek}
          disabled={loadingNextWeek}
          className="w-full rounded-2xl py-3.5 text-[14px] font-semibold border transition-colors disabled:opacity-50"
          style={{ borderColor: accent, color: accent, background: soft }}
        >
          {loadingNextWeek ? "Sonraki hafta hazırlanıyor..." : `+ ${weeks.length + 1}. Haftayı Oluştur`}
        </button>
      </div>
    </div>
  );
}
