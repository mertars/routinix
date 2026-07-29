import { useState, memo } from "react";
import { MONO_FONT, categoryOf } from "../constants";
import Accordion from "./Accordion";
import TaskCard from "./TaskCard";

// Rutin sıklık anahtarını minik ikon + Türkçe etikete çevirir.
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

// Dairesel ilerleme halkalı gün rozeti (conic-gradient mor→kırmızı dolum).
// React.memo + `onSelect` (setActiveDay, referansı sabit) + `day` (primitif)
// sayesinde, aktif olmayan bir gün rozetinin tıklanması diğer gün rozetlerini
// yeniden render ETMEZ.
const DayCircle = memo(function DayCircle({ day, pct, active, accent, accentSoft, onSelect }) {
  return (
    <button onClick={() => onSelect(day)} className="shrink-0 flex flex-col items-center gap-1.5 card-glow" aria-label={`${day}. gün`}>
      <div
        className="w-[54px] h-[54px] rounded-full p-[3px]"
        style={{ background: `conic-gradient(from -90deg, #B26BFF, #F4406B ${pct}%, #23262F ${pct}% 100%)` }}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center transition-colors"
          style={{
            background: active ? accentSoft : "var(--bg-card)",
            border: active ? `1px solid ${accent}` : "1px solid transparent",
            boxShadow: active ? `0 0 14px -4px ${accent}` : "none",
          }}
        >
          <span
            className="text-[15px] font-bold"
            style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: MONO_FONT }}
          >
            {day}
          </span>
        </div>
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: active ? accent : "var(--text-faint)" }}>
        Gün
      </span>
    </button>
  );
});

// Aktif plan ekranı: sabit başlık + genel ilerleme, rutinler (accordion), takvim
// rozet şeridi (dolum halkalı + kilitli günler) ve seçili günün görev kartları.
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
  onPrint,
  onBack,
}) {
  const [activeDay, setActiveDay] = useState(null);
  if (!plan) return null;

  const cat = categoryOf(plan.mode);
  const accent = cat.accent;
  const soft = cat.accentSoft;
  const isVacation = plan.mode === "vacation";

  // Yüklü (AI/DB) günleri gün no → gün verisi eşlemesine çevir.
  const loadedDays = weeks
    .flatMap((w) => w.days.map((d) => ({ ...d, weekNumber: w.weekNumber })))
    .sort((a, b) => a.dayNumber - b.dayNumber);
  const loadedByDay = new Map(loadedDays.map((d) => [d.dayNumber, d]));
  const maxLoadedDay = loadedDays.length ? loadedDays[loadedDays.length - 1].dayNumber : 0;

  // Kullanıcının hedefine göre toplam gün sayısı — takvim TAM olarak bu kadar
  // kutucuk üretir. Sabit "8 gün / +7 kilitli" mantığı yok. total_days yoksa
  // (eski planlar) yüklü son güne düşer, o da yoksa 7.
  const targetDays = Number(plan.total_days) || Math.max(maxLoadedDay, 7);

  // Tam targetDays kadar hücre: yüklüyse gerçek veri, değilse kilitli placeholder.
  // (Veri fazladan gün içeriyorsa Map araması targetDays'i aşmadığı için doğal kesilir.)
  const calendar = Array.from({ length: targetDays }, (_, i) => {
    const dayNumber = i + 1;
    const loaded = loadedByDay.get(dayNumber);
    return loaded ? { ...loaded, locked: false } : { dayNumber, tasks: [], locked: true };
  });
  const firstLockedDay = maxLoadedDay + 1; // yükleme göstergesi için

  // Aktif gün: seçili olan hâlâ yüklüyse onu, değilse ilk yüklü günü kullan.
  const effectiveActiveDay =
    loadedDays.find((d) => d.dayNumber === activeDay)?.dayNumber ?? loadedDays[0]?.dayNumber ?? null;
  const activeDayObj = loadedDays.find((d) => d.dayNumber === effectiveActiveDay) || null;

  const dayPct = (d) => {
    const total = d.tasks.length;
    if (!total) return 0;
    return Math.round((d.tasks.filter((t) => t.is_completed).length / total) * 100);
  };

  return (
    <div className="flex flex-col gap-5 animate-[fadeIn_0.4s_ease]">
      {/* Başlık + genel ilerleme */}
      <div className="glass rounded-2xl p-5" style={{ borderColor: `${accent}33` }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            ‹ Ana Sayfa
          </button>
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 rounded-lg px-2.5 h-8 text-[11.5px] font-semibold transition-colors"
            style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}44` }}
          >
            🖨️ PDF / Yazdır
          </button>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{cat.emoji}</span>
          <h1 className="text-[18px] font-bold leading-snug text-balance text-[var(--text-primary)]">{plan.title || "Planım"}</h1>
        </div>
        {plan.summary && <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed">{plan.summary}</p>}

        <div className="flex items-center justify-between mt-4 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: accent, fontFamily: MONO_FONT }}>
            {completedTasks}/{totalTasks} görev
          </span>
          <span className="text-[11px] text-[var(--text-faint)]" style={{ fontFamily: MONO_FONT }}>
            %{overallPct} tamamlandı
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--disabled-bg)" }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${overallPct}%`, background: "linear-gradient(90deg, #B26BFF, #F4406B)" }}
          />
        </div>
      </div>

      {/* Genel rutinler — accordion */}
      {routines.length > 0 && (
        <Accordion title="Genel Rutinler" icon="🔁" accent={accent} defaultOpen>
          <div className="flex flex-col gap-2.5">
            {routines.map((r, i) => {
              const fm = frequencyMeta(r.frequency);
              return (
                <div
                  key={r.id || i}
                  className="rounded-xl border p-3 flex items-start gap-3"
                  style={{ borderColor: `${accent}22`, background: "var(--bg-input)" }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] shrink-0" style={{ background: soft }}>
                    {fm.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block text-[9px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full mb-1"
                      style={{ background: soft, color: accent }}
                    >
                      {fm.label}
                    </span>
                    <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">{r.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Accordion>
      )}

      {/* Takvim rozet şeridi */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">
            Performans Çerçevesi · {targetDays} gün
          </p>
          {nextWeekError && (
            <span className="text-[10.5px] font-medium" style={{ color: "#F0827A" }}>
              {nextWeekError}
            </span>
          )}
        </div>
        {/* Tam olarak targetDays kadar kutucuk: yüklü günler dolu, kalanlar kilitli. */}
        <div className="edge-fade-x flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:-mx-8 md:px-8" style={{ scrollSnapType: "x proximity" }}>
          {calendar.map((cell) =>
            cell.locked ? (
              <button
                key={`lock-${cell.dayNumber}`}
                onClick={onLoadNextWeek}
                disabled={loadingNextWeek}
                className="shrink-0 flex flex-col items-center gap-1.5 disabled:opacity-70"
                aria-label={`${cell.dayNumber}. gün kilitli — sonraki haftayı aç`}
              >
                <div className="frost-lock w-[54px] h-[54px] rounded-full flex items-center justify-center">
                  <span className="text-[15px]" style={{ filter: "grayscale(0.3)", opacity: 0.85 }}>
                    {loadingNextWeek && cell.dayNumber === firstLockedDay ? "⏳" : "🔒"}
                  </span>
                </div>
                <span className="text-[9px] font-semibold" style={{ color: "var(--text-faint)", fontFamily: MONO_FONT }}>
                  {cell.dayNumber}
                </span>
              </button>
            ) : (
              <DayCircle
                key={cell.dayNumber}
                day={cell.dayNumber}
                pct={dayPct(cell)}
                active={cell.dayNumber === effectiveActiveDay}
                accent={accent}
                accentSoft={soft}
                onSelect={setActiveDay}
              />
            )
          )}
        </div>
        <p className="mt-2.5 text-[11px] text-[var(--text-faint)] leading-relaxed">
          🔒 Kilitli güne dokunarak bir sonraki haftanın stratejisini aç.
        </p>
      </div>

      {/* Günün Stratejik Adımları */}
      {activeDayObj && (
        <div key={effectiveActiveDay} className="day-reveal flex flex-col gap-3">
          {/* Aktif günün arkasından sızan hafif neon aura */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="text-[10.5px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: soft, color: accent, fontFamily: MONO_FONT }}
              >
                {effectiveActiveDay}. GÜN
              </span>
              <span className="text-[11px] text-[var(--text-faint)]" style={{ fontFamily: MONO_FONT }}>
                {activeDayObj.weekNumber}. hafta
              </span>
            </div>
          </div>
          <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] -mt-1.5">Günün Stratejik Adımları</h2>

          {activeDayObj.tasks.length > 0 && activeDayObj.tasks.every((t) => t.is_completed) && (
            <div
              className="rounded-xl border px-4 py-3 text-[12.5px] font-medium leading-relaxed"
              style={{ borderColor: "rgba(46,217,163,0.3)", background: "rgba(46,217,163,0.08)", color: "#7DE9C3" }}
            >
              ✅ Bugünkü disiplin halkan tamamlandı. Zarif bir tutarlılık — devam et.
            </div>
          )}

          {/* Masaüstünde 2/3/4'lü grid — mobilde tek sütun. Her kart memoized
              TaskCard — dokunulmayan görevler, bir tık sırasında hiç render
              edilmez (bkz. TaskCard.jsx + usePlanStudio.toggleTask). */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeDayObj.tasks.map((t) => (
              <TaskCard key={t.id} task={t} accent={accent} soft={soft} isVacation={isVacation} onToggle={onToggleTask} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
