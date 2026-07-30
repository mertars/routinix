import { useState, memo } from "react";
import { MONO_FONT, categoryOf } from "../constants";
import Accordion from "./Accordion";
import TaskCard from "./TaskCard";
import { routineEmoji, routineMicroLabel } from "../utils/routineText";
import { isRoutineChecked, setRoutineChecked } from "../utils/routineCheckin";

// Kompakt, tiklenebilir rutin hap rozeti — günlük check-in durumu
// (RoutinesPopover.jsx ile PAYLAŞILAN localStorage anahtarı üzerinden, bkz.
// utils/routineCheckin.js) her iki yüzeyde de tutarlı kalır. Tamamlanan rutin
// soluklaşır + üzeri çizilir.
function RoutinePill({ routine, accent, soft }) {
  const [on, setOn] = useState(() => isRoutineChecked(routine.id));
  const toggle = () => {
    setOn((prev) => {
      const next = !prev;
      setRoutineChecked(routine.id, next);
      return next;
    });
  };
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-1.5 transition-all card-glow"
      style={{ background: on ? "rgba(46,217,163,0.12)" : soft, opacity: on ? 0.6 : 1 }}
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0"
        style={{ background: on ? "rgba(46,217,163,0.2)" : "rgba(var(--overlay-rgb),0.08)", color: on ? "#2ED9A3" : accent }}
      >
        {on ? "✓" : routineEmoji(routine.content)}
      </span>
      <span
        className="text-[11.5px] font-semibold"
        style={{ color: on ? "var(--text-faint)" : accent, textDecoration: on ? "line-through" : "none" }}
      >
        {routineMicroLabel(routine.content)}
      </span>
    </button>
  );
}

// "Pill Calendar" — minimalist, dikey hap biçimli gün rozeti. Aktif gün
// aksan renkle dolu/fosforlu bir dolgu + glow taşır; diğerleri sade tonal
// zemin. Alttaki ince çubuk günün tamamlanma yüzdesini gösterir (halka yerine
// düz bir dolgu — daha sakin, daha "Apple/Linear" bir okuma). React.memo +
// `onSelect` (setActiveDay, referansı sabit) + `day` (primitif) sayesinde,
// aktif olmayan bir gün rozetinin tıklanması diğer rozetleri yeniden render ETMEZ.
function DayPillImpl({ day, pct, active, accent, onSelect }) {
  return (
    <button onClick={() => onSelect(day)} className="shrink-0 flex flex-col items-center gap-1.5 card-glow" aria-label={`${day}. gün`}>
      <div
        className="w-11 h-16 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-300"
        style={{
          background: active ? `linear-gradient(160deg, ${accent}, ${accent}CC)` : "rgba(var(--overlay-rgb),0.05)",
          boxShadow: active ? `0 0 22px -4px ${accent}, 0 6px 16px -8px ${accent}` : "none",
        }}
      >
        <span
          className="text-[16px] font-bold leading-none"
          style={{ color: active ? "#04040a" : "var(--text-primary)", fontFamily: MONO_FONT }}
        >
          {day}
        </span>
        <div className="w-5 h-[3px] rounded-full overflow-hidden" style={{ background: active ? "rgba(4,4,10,0.25)" : "rgba(var(--overlay-rgb),0.12)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: active ? "#04040a" : accent }} />
        </div>
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: active ? accent : "var(--text-faint)" }}>
        Gün
      </span>
    </button>
  );
}
const DayPill = memo(
  DayPillImpl,
  (prev, next) =>
    prev.day === next.day && prev.pct === next.pct && prev.active === next.active && prev.accent === next.accent && prev.onSelect === next.onSelect
);

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
  onStartPomodoro,
  onPrint,
  onBack,
}) {
  const [activeDay, setActiveDay] = useState(null);
  if (!plan) return null;

  const cat = categoryOf(plan.mode);
  const accent = cat.accent;
  const soft = cat.accentSoft;
  const isVacation = plan.mode === "vacation";
  // Pomodoro rozeti YALNIZCA odak/çalışma gerektiren içerikte anlamlı —
  // tatil/fitness/genel rutinde zamanlama kavramı yok, zorunlu göstermiyoruz.
  const showPomodoro = plan.mode === "software";

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
    <div className="flex flex-col gap-6 animate-[fadeIn_0.4s_ease]">
      {/* Başlık + genel ilerleme */}
      <div className="glass rounded-2xl p-4 md:p-5" style={{ borderColor: `${accent}33` }}>
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
          <span className="text-base md:text-lg">{cat.emoji}</span>
          <h1 className="text-[15.5px] md:text-[18px] font-bold leading-snug text-balance text-[var(--text-primary)]">{plan.title || "Planım"}</h1>
        </div>
        {/* Akıllı Başlık: bu planın NEDEN/NASIL böyle kurgulandığını tek
            bakışta anlatan mikro-açıklama — plana özel özet + kategorinin
            metodolojisi (tagline). Sol aksan şerit + yumuşak zemin + ikon.
            Mobilde daha küçük font + daha sıkı dolgu + satırlar arasında
            biraz daha fazla boşluk — sıkışıklık gidermek için. */}
        <div
          className="flex items-start gap-2.5 md:gap-3 rounded-xl px-3 py-2.5 md:px-3.5 md:py-3 mt-1"
          style={{ background: "rgba(var(--overlay-rgb),0.05)", borderLeft: `3px solid ${accent}` }}
        >
          <span className="shrink-0 w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center text-[12px] md:text-[13px] mt-0.5" style={{ background: soft }}>
            {cat.emoji}
          </span>
          <div className="min-w-0 flex flex-col gap-2">
            {plan.summary && <p className="text-[11.5px] md:text-[12.5px] text-[var(--text-secondary)] leading-relaxed">{plan.summary}</p>}
            <p className="text-[10px] md:text-[11px] font-medium leading-relaxed" style={{ color: accent }}>
              🧭 Yaklaşım: {cat.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: accent, fontFamily: MONO_FONT }}>
            {completedTasks}/{totalTasks} görev
          </span>
          <span className="text-[11px] text-[var(--text-faint)]" style={{ fontFamily: MONO_FONT }}>
            %{overallPct} tamamlandı
          </span>
        </div>
        {/* Mikro ilerleme çizgisi — 3px, hafifçe içbükey (neomorfik) iz üzerinde
            ince bir dolgu; kalın bir "bar" değil, minimalist bir çizgi. */}
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: "var(--disabled-bg)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.18)" }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${overallPct}%`,
              background: "linear-gradient(90deg, #B26BFF, #F4406B)",
              boxShadow: overallPct > 0 ? "0 0 6px -1px rgba(178,107,255,0.7)" : "none",
            }}
          />
        </div>
      </div>

      {/* Genel rutinler — kompakt, tiklenebilir hap rozetleri (accordion içinde) */}
      {routines.length > 0 && (
        <Accordion title="Genel Rutinler" icon="🔁" accent={accent} defaultOpen>
          <div className="flex flex-wrap gap-2">
            {routines.map((r, i) => (
              <RoutinePill key={r.id || i} routine={r} accent={accent} soft={soft} />
            ))}
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
                <div className="frost-lock w-11 h-16 rounded-2xl flex items-center justify-center">
                  <span className="text-[15px]" style={{ filter: "grayscale(0.3)", opacity: 0.85 }}>
                    {loadingNextWeek && cell.dayNumber === firstLockedDay ? "⏳" : "🔒"}
                  </span>
                </div>
                <span className="text-[9px] font-semibold" style={{ color: "var(--text-faint)", fontFamily: MONO_FONT }}>
                  {cell.dayNumber}
                </span>
              </button>
            ) : (
              <DayPill
                key={cell.dayNumber}
                day={cell.dayNumber}
                pct={dayPct(cell)}
                active={cell.dayNumber === effectiveActiveDay}
                accent={accent}
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
        <div key={effectiveActiveDay} className="day-reveal flex flex-col gap-4">
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

          {/* Tek sütun, minimalist tek-satır liste (mikro-arayüz) — detaylar
              varsayılan gizli, karta dokununca Drawer/Bottom Sheet ile açılır
              (bkz. TaskCard.jsx). Her satır memoized — dokunulmayan görevler
              bir tık sırasında hiç render edilmez (bkz. usePlanStudio.toggleTask). */}
          <div className="task-grid flex flex-col gap-2.5">
            {activeDayObj.tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                accent={accent}
                soft={soft}
                isVacation={isVacation}
                showPomodoro={showPomodoro}
                onToggle={onToggleTask}
                onStartPomodoro={onStartPomodoro}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
