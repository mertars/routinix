import { useState, useEffect, useMemo } from "react";
import { X, Sparkles, Moon, ChevronRight, Zap, CheckCircle2, Circle, Timer } from "lucide-react";
import { MONO_FONT, categoryOf } from "../constants";
import { fetchDashboardData } from "../services/planService";
import { callRhythmAction, fetchReportHistory, fetchFocusSessions } from "../services/rhythmService";
import { callCoachAction } from "../services/coachActionService";
import { isRoutineChecked } from "../utils/routineCheckin";
import {
  aggregateDeepWorkByCategory,
  aggregateHeatmapBuckets,
  computeFlexibilityIndex,
  computeReliefDistribution,
  rangeStartFor,
  daysBetween,
  sessionsForDate,
  collectTodayTasks,
} from "../utils/rhythmAnalytics";
import { FlexibilityRing, DeepWorkBars, ProductivityHeatmap, ReliefDonut } from "./RhythmCharts";
import logger from "../utils/logger";

// Modülün marka rengi — Header/DrawerMenu'deki mevcut aksanlardan (cyan/
// emerald/indigo/amber/rose) net ayrışan yumuşak bir violet (bkz. Header.jsx).
const ACCENT = "#A78BFA";
const ACCENT_SOFT = "rgba(167,139,250,0.14)";

// "Glassmorphism Card" — tüm Dashboard grid'i BOYUNCA tekrar eden tek
// kaynak. Bilerek `bg-slate-900/60` gibi sabit koyu renkler DEĞİL, projenin
// paylaşılan `.glass` sınıfı (index.css) kullanılır: uygulama genelindeki
// light/dark tema token'larına (--glass-rgb, --alpha-card, --glass-border)
// göre otomatik uyum sağlar — sabit slate tonu kullanmak açık temada
// paneli KARARTIR ve tüm uygulamadaki tema-duyarlılık çalışmasını bozardı.
const CARD = "glass rounded-2xl p-6";

const PERIOD_TABS = [
  { key: "week", label: "Haftalık" },
  { key: "month", label: "Aylık" },
  { key: "year", label: "Yıllık" },
];

// routineCheckin.js ile AYNI (UTC-bazlı) tarih anahtarı — sunucudaki
// todayDate() (api/rhythm-report.js) ile tutarlı kalması için bilerek yerel
// saat değil UTC kullanılır (bkz. o dosyadaki yorum).
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function formatClock(iso) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function StatChip({ label, value, accent }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl px-3.5 py-3" style={{ background: "rgba(var(--overlay-rgb),0.045)" }}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-faint)]">{label}</span>
      <span className="text-[19px] font-bold tabular-nums leading-none" style={{ fontFamily: MONO_FONT, color: accent || "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

// 🌙 Rhythm & Insights — "Esnek Sistem" felsefesinin gün sonu ritüeli.
// Modern çok kolonlu Dashboard Izgarası: masaüstünde (lg+) 12 kolonluk grid,
// sol (8 kolon) ana akış — günün başlığı, 2x2 grafik matrisi, görev/seans
// listesi — sağ (4 kolon) yan panel — AI rapor özeti, AI kotası + hızlı
// istatistikler, yarının odak noktaları. Mobilde (<lg) tek kolon, mantıklı
// sırayla alt alta. TAMAMEN kendi kendine yeterli (usePlanStudio'nun canlı
// state'ine bağımlı değil) — yalnızca `userId` alır.
export default function RhythmStudio({ open, userId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [coachQuota, setCoachQuota] = useState(null); // { remaining, dailyLimit } | null
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [period, setPeriod] = useState("week");
  const [generating, setGenerating] = useState(false);
  const [endingDay, setEndingDay] = useState(false);
  const [endDayResult, setEndDayResult] = useState(null);
  // Mobilde (<lg) 12 kolonlu grid'i sonsuz dikey liste olarak vermek yerine
  // Segmented Control ile iki mantıksal gruba ayırır — "focus" (odaklanma/
  // görevler) ve "insights" (grafikler/AI raporu). Yalnızca `lg:hidden`
  // alanda kullanılır; masaüstünde (`hidden lg:grid`) hiç render edilmez.
  const [mobileTab, setMobileTab] = useState("focus"); // "focus" | "insights"

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setEndDayResult(null);
    setSelectedDate(todayKey());
    Promise.all([fetchReportHistory(userId), fetchFocusSessions(userId), fetchDashboardData(userId), callCoachAction({ action: "status" })])
      .then(([reportRows, sessionRows, planRows, quotaRes]) => {
        if (cancelled) return;
        setReports(reportRows);
        setSessions(sessionRows);
        setPlans(planRows);
        if (quotaRes?.unlimited) {
          setCoachQuota({ unlimited: true, remaining: null, dailyLimit: null });
        } else if (quotaRes && typeof quotaRes.remaining === "number") {
          setCoachQuota({ unlimited: false, remaining: quotaRes.remaining, dailyLimit: quotaRes.dailyLimit });
        }
      })
      .catch((err) => logger.error("RHYTHM_STUDIO", "Veriler getirilemedi", { userId, error: err?.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // NOT: Aşağıdaki tüm useMemo'lar `if (!open) return null;`'DAN ÖNCE
  // tanımlı olmak ZORUNDA (React hook sırası kuralı — bu turda TaskDrawer.jsx/
  // PlanBoard.jsx/ilk RhythmStudio taslağında bulunup düzeltilen aynı hata
  // sınıfı). `reports`/`sessions`/`plans` henüz boş dizi olsa bile güvenlidir.
  const dateStrip = useMemo(() => {
    const dates = new Set(reports.map((r) => r.report_date));
    dates.add(todayKey());
    return [...dates].sort((a, b) => (a < b ? 1 : -1));
  }, [reports]);

  const rangeStart = rangeStartFor(period);
  const sessionsInRange = useMemo(() => sessions.filter((s) => new Date(s.started_at) >= rangeStart), [sessions, rangeStart]);
  const reportsInRange = useMemo(() => reports.filter((r) => new Date(`${r.report_date}T00:00:00Z`) >= rangeStart), [reports, rangeStart]);
  const rangeDays = daysBetween(rangeStart, new Date());

  const deepWorkData = useMemo(() => aggregateDeepWorkByCategory(sessionsInRange, plans), [sessionsInRange, plans]);
  const heatmapBuckets = useMemo(() => aggregateHeatmapBuckets(sessionsInRange), [sessionsInRange]);
  const flexibilityPct = useMemo(() => computeFlexibilityIndex(reportsInRange, rangeDays), [reportsInRange, rangeDays]);
  const relief = useMemo(() => computeReliefDistribution(reportsInRange), [reportsInRange]);

  const todayTasks = useMemo(() => collectTodayTasks(plans), [plans]);
  const selectedDateSessions = useMemo(() => sessionsForDate(sessions, selectedDate), [sessions, selectedDate]);
  const focusMinutesSelectedDate = useMemo(() => selectedDateSessions.reduce((n, s) => n + (s.duration_min || 0), 0), [selectedDateSessions]);

  if (!open) return null;

  const isToday = selectedDate === todayKey();
  const selectedReport = reports.find((r) => r.report_date === selectedDate) || null;
  const completedToday = todayTasks.filter((t) => t.is_completed).length;

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      // Rutin check-in durumu yalnızca localStorage'da (bkz. routineCheckin.js)
      // — sunucunun erişimi yok, bu yüzden bugün İŞARETLENMEMİŞ rutin
      // başlıklarını burada toplayıp AI'a bağlam olarak gönderiyoruz.
      const allRoutines = plans.flatMap((p) => p.routines || []);
      const lapsedRoutineTitles = allRoutines.filter((r) => !isRoutineChecked(r.id)).map((r) => r.content);

      const result = await callRhythmAction({ action: "generate", lapsedRoutineTitles });
      if (result?.ok && result.report) {
        setReports((prev) => [result.report, ...prev.filter((r) => r.report_date !== result.report.report_date)]);
      } else {
        logger.warn("RHYTHM_STUDIO", "Rapor üretilemedi", { message: result?.message });
      }
    } catch (err) {
      logger.error("RHYTHM_STUDIO", "Rapor üretme hatası", { error: err?.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleEndDay = async () => {
    if (endingDay) return;
    setEndingDay(true);
    setEndDayResult(null);
    try {
      const result = await callRhythmAction({ action: "endDay" });
      setEndDayResult(result);
      if (result?.ok && typeof result.rescheduledCount === "number") {
        setReports((prev) =>
          prev.map((r) => (r.report_date === todayKey() ? { ...r, rescheduled_count: result.rescheduledCount } : r))
        );
      }
    } catch (err) {
      logger.error("RHYTHM_STUDIO", "Gün sonu hatası", { error: err?.message });
      setEndDayResult({ ok: false, message: "Beklenmedik bir hata oluştu." });
    } finally {
      setEndingDay(false);
    }
  };

  // Aşağıdaki 6 kart JSX DEĞİŞKEN olarak bir kez hesaplanır, sonra HEM mobil
  // Segmented Control'ün iki sekmesine HEM masaüstü 12 kolonlu grid'e
  // AYNEN yerleştirilir — işaretlemeyi iki yerde tekrarlamadan tek bir
  // içerik kaynağından iki farklı yerleşim üretilir.
  const dayHeadingCard = (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-left">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)] mb-1">
            {isToday ? "Bugün" : formatDateLabel(selectedDate)}
          </p>
          <h3 className="text-[19px] font-bold text-[var(--text-primary)]">{isToday ? "Günün ritmine hoş geldin" : "Geçmiş gün özeti"}</h3>
        </div>
        <div className="flex items-center gap-2 rounded-full px-4 py-2" style={{ background: ACCENT_SOFT }}>
          <Timer className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-[15px] font-bold tabular-nums" style={{ fontFamily: MONO_FONT, color: ACCENT }}>
            {focusMinutesSelectedDate} dk
          </span>
          <span className="text-[10.5px] font-semibold text-[var(--text-faint)] whitespace-nowrap">odaklanma</span>
        </div>
      </div>
    </div>
  );

  const chartMatrixCard = (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[13px] font-bold uppercase tracking-[0.05em] text-left" style={{ color: "var(--text-secondary)" }}>
          Değer & Odak Analitiği
        </h3>
        <div className="flex gap-1 p-1 rounded-full" style={{ background: "rgba(var(--overlay-rgb),0.04)" }}>
          {PERIOD_TABS.map((t) => {
            const active = t.key === period;
            return (
              <button
                key={t.key}
                onClick={() => setPeriod(t.key)}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-all"
                style={{ background: active ? ACCENT_SOFT : "transparent", color: active ? ACCENT : "var(--text-faint)" }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="rounded-xl p-4 flex flex-col items-start gap-2" style={{ background: "rgba(var(--overlay-rgb),0.03)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-faint)]">Ritim Dengesi</p>
          <div className="w-full flex justify-center">
            <FlexibilityRing pct={flexibilityPct} accent={ACCENT} />
          </div>
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-3 text-left" style={{ background: "rgba(var(--overlay-rgb),0.03)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-faint)]">Derin Odak Hacmi</p>
          <DeepWorkBars data={deepWorkData} />
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-3 text-left" style={{ background: "rgba(var(--overlay-rgb),0.03)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-faint)]">Pik Verimlilik Saatleri</p>
          <ProductivityHeatmap buckets={heatmapBuckets} accent={ACCENT} />
        </div>
        <div className="rounded-xl p-4 flex flex-col gap-3 text-left" style={{ background: "rgba(var(--overlay-rgb),0.03)" }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--text-faint)]">Hafifletme Dağılımı</p>
          <ReliefDonut total={relief.total} reliefDays={relief.reliefDays} steadyDays={relief.steadyDays} accent={ACCENT} />
        </div>
      </div>
    </div>
  );

  const tasksSessionsCard = (
    <div className={CARD}>
      {isToday && (
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-left text-[var(--text-faint)] mb-3">
            Bugünün Görevleri {todayTasks.length > 0 && `· ${completedToday}/${todayTasks.length}`}
          </p>
          {loading ? (
            <p className="text-[12px] text-[var(--text-faint)]">Yükleniyor...</p>
          ) : todayTasks.length === 0 ? (
            <p className="text-[12px] text-[var(--text-faint)]">Bugün için aktif bir görevin yok.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {todayTasks.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--overlay-rgb),0.03)" }}>
                  {t.is_completed ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#2ED9A3" }} />
                  ) : (
                    <Circle className="w-4 h-4 shrink-0 text-[var(--text-faint)]" />
                  )}
                  <span
                    className="flex-1 min-w-0 text-[12.5px] font-medium truncate text-left"
                    style={{ color: "var(--text-secondary)", textDecoration: t.is_completed ? "line-through" : "none", opacity: t.is_completed ? 0.6 : 1 }}
                  >
                    {t.title}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${t.planAccent}18`, color: t.planAccent }}>
                    {t.planEmoji} {t.planTitle}
                  </span>
                </div>
              ))}
              {todayTasks.length > 8 && <p className="text-[10.5px] text-[var(--text-faint)] mt-1">+{todayTasks.length - 8} görev daha</p>}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-left text-[var(--text-faint)] mb-3">
          {isToday ? "Bugünün" : formatDateLabel(selectedDate) + " Tarihli"} Odak Seansları
        </p>
        {selectedDateSessions.length === 0 ? (
          <p className="text-[12px] text-[var(--text-faint)]">Bu gün için kaydedilmiş bir odak seansı yok.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {selectedDateSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ background: "rgba(var(--overlay-rgb),0.03)" }}>
                <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                <span className="text-[11.5px] font-semibold tabular-nums text-left" style={{ fontFamily: MONO_FONT, color: "var(--text-secondary)" }}>
                  {formatClock(s.started_at)}
                </span>
                <span className="flex-1 text-[11.5px] text-[var(--text-faint)] text-left">Odaklanma Turu</span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ fontFamily: MONO_FONT, color: ACCENT }}>
                  {s.duration_min} dk
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const reportCard = (
    <div className={CARD} style={{ borderColor: `${ACCENT}33` }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-[12.5px] font-bold uppercase tracking-[0.05em] text-left" style={{ color: ACCENT }}>
          Günlük Ritim Raporu
        </h3>
      </div>

      {loading ? (
        <p className="text-[12.5px] text-[var(--text-faint)] py-4 text-left">Yükleniyor...</p>
      ) : selectedReport ? (
        <div className="flex flex-col gap-3 text-left">
          <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">{selectedReport.summary_text}</p>
          {selectedReport.rescheduled_count > 0 && (
            <span className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full w-fit" style={{ background: ACCENT_SOFT, color: ACCENT }}>
              🌿 {selectedReport.rescheduled_count} görev nazikçe ertelendi
            </span>
          )}
        </div>
      ) : isToday ? (
        <div className="flex flex-col items-start text-left gap-3">
          <p className="text-[12px] text-[var(--text-faint)] leading-relaxed">
            Bugünün ritim raporunu hazırlayalım — odak sürene, tamamladığın işlere göre sana özel, suçlamasız bir özet çıkaralım.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full rounded-full px-5 py-3 text-[12.5px] font-bold whitespace-nowrap transition-all active:scale-95 disabled:opacity-50"
            style={{ background: ACCENT, color: "#1a0f2e", boxShadow: `0 0 30px -8px ${ACCENT}` }}
          >
            {generating ? "Hazırlanıyor..." : "✨ Bugünün Ritim Raporunu Hazırla"}
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-[var(--text-faint)] text-left">Bu gün için bir rapor oluşturulmamış.</p>
      )}

      {/* Gün Sonu aksiyonu — yalnızca bugün için anlamlı */}
      {isToday && (
        <div className="mt-5 pt-5 border-t border-black/5 dark:border-white/5 flex flex-col gap-2.5">
          <button
            onClick={handleEndDay}
            disabled={endingDay}
            className="w-full rounded-2xl py-3.5 text-[13px] font-bold whitespace-nowrap transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-primary)", border: `1px solid ${ACCENT}55` }}
          >
            {endingDay ? "Ölçekleniyor..." : "🌙 Günü Tamamla & Planı Yeniden Otomatik Ölçekle"}
          </button>
          <p className="text-[10.5px] leading-relaxed text-left text-[var(--text-faint)]">
            ⚠️ <strong>Not:</strong> Bugün yapabileceğiniz görevleri yapıp işaretledikten sonra bu butona basın. Tamamlayamadığınız
            görevler ve aksayan rutinler önümüzdeki günlere enerjinizi zorlamayacak şekilde akıllıca dağıtılır ve yarının
            planlaması otomatik olarak tekrardan yapılır.
          </p>
          {endDayResult && (
            <p className="text-[11.5px] font-medium text-left" style={{ color: endDayResult.ok ? "#7DE9C3" : "#F0827A" }}>
              {endDayResult.message}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const quotaCard = (
    <div className={CARD}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-left text-[var(--text-faint)] mb-3">AI Kotası & Hızlı İstatistikler</p>
      {coachQuota && (
        <div className="flex items-center justify-between rounded-xl px-3.5 py-3 mb-3" style={{ background: "rgba(var(--overlay-rgb),0.045)" }}>
          <span className="text-[12px] font-semibold text-[var(--text-secondary)]">✨ AI Koç Hakkı</span>
          <span className="text-[13px] font-bold tabular-nums" style={{ fontFamily: MONO_FONT, color: coachQuota.unlimited || coachQuota.remaining > 0 ? "#2ED9A3" : "#F0827A" }}>
            {coachQuota.unlimited ? "✨ Sınırsız" : `${coachQuota.remaining}/${coachQuota.dailyLimit}`}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <StatChip label="Bugün Odak" value={`${focusMinutesSelectedDate} dk`} accent={ACCENT} />
        <StatChip label="Görev" value={isToday ? `${completedToday}/${todayTasks.length}` : "—"} />
        <StatChip label="Esneklik" value={`%${flexibilityPct}`} accent={ACCENT} />
        <StatChip label="Hafifletme" value={`${relief.reliefDays}/${relief.total}`} />
      </div>
    </div>
  );

  const tomorrowFocusCard = (
    <div className={CARD}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-left text-[var(--text-faint)] mb-3">Yarının Odağı</p>
      {selectedReport?.tomorrow_focus?.length > 0 ? (
        <div className="flex flex-col gap-2">
          {selectedReport.tomorrow_focus.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-[12.5px] text-left text-[var(--text-secondary)]">
              <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-[var(--text-faint)] text-left">Günlük raporunu hazırladığında yarının odak noktaları burada görünecek.</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: "var(--bg-app)" }}>
      {/* Üst bar */}
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-5 pb-3 flex items-center justify-between gap-2 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <Moon className="w-5 h-5 shrink-0" style={{ color: ACCENT }} strokeWidth={2.25} />
          <h2 className="text-[17px] font-bold text-[var(--text-primary)] whitespace-nowrap">Ritim & Gün Sonu</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Kapat"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          style={{ background: "rgba(var(--overlay-rgb),0.05)" }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mobil Segmented Control — yalnızca <lg. Masaüstünde 12 kolonlu grid
          zaten HER İKİ grubu da aynı anda gösterdiğinden sekmeye gerek yok. */}
      <div className="lg:hidden shrink-0 px-4 sm:px-6 pt-3 pb-1">
        <div className="flex gap-1 p-1 rounded-full" style={{ background: "rgba(var(--overlay-rgb),0.05)" }}>
          {[
            { key: "focus", label: "🎯 Odak & Görevler" },
            { key: "insights", label: "📊 Ritim & AI Raporu" },
          ].map((t) => {
            const active = t.key === mobileTab;
            return (
              <button
                key={t.key}
                onClick={() => setMobileTab(t.key)}
                className="flex-1 rounded-full py-2.5 text-[12px] font-bold whitespace-nowrap transition-all"
                style={{ background: active ? ACCENT_SOFT : "transparent", color: active ? ACCENT : "var(--text-faint)" }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-mobile-safe">
          {/* Tarih şeridi — grid'in/sekmelerin üstünde, tam genişlik */}
          <div className="edge-fade-x flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
            {dateStrip.map((d) => {
              const active = d === selectedDate;
              const hasReport = reports.some((r) => r.report_date === d);
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className="shrink-0 flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all"
                  style={{
                    background: active ? ACCENT_SOFT : "rgba(var(--overlay-rgb),0.04)",
                    border: `1px solid ${active ? ACCENT + "66" : "transparent"}`,
                  }}
                >
                  <span className="text-[11px] font-bold whitespace-nowrap" style={{ fontFamily: MONO_FONT, color: active ? ACCENT : "var(--text-secondary)" }}>
                    {d === todayKey() ? "Bugün" : formatDateLabel(d)}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: hasReport ? ACCENT : "transparent" }} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          {/* Mobil (<lg): Segmented Control'e göre TEK grup, sonsuz dikey liste
              YERİNE yalnızca ilgili kartlar. */}
          <div className="lg:hidden flex flex-col gap-6">
            {mobileTab === "focus" ? (
              <>
                {dayHeadingCard}
                {tasksSessionsCard}
              </>
            ) : (
              <>
                {chartMatrixCard}
                {reportCard}
                {quotaCard}
                {tomorrowFocusCard}
              </>
            )}
          </div>

          {/* Masaüstü (≥lg): 12 kolonlu Dashboard Izgarası, 8+4 — mobil
              sekmelerle AYNI ANDA render EDİLMEZ (`hidden lg:grid`). */}
          <div className="hidden lg:grid grid-cols-12 gap-6">
            <div className="col-span-8 flex flex-col gap-6">
              {dayHeadingCard}
              {chartMatrixCard}
              {tasksSessionsCard}
            </div>
            <div className="col-span-4 flex flex-col gap-6">
              {reportCard}
              {quotaCard}
              {tomorrowFocusCard}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
