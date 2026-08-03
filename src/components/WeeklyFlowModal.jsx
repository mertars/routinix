import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download, Flame, Trophy, Sparkles } from "lucide-react";
import { toPng } from "html-to-image";
import { fetchFocusSessions } from "../services/rhythmService";
import { fetchTasksByIds } from "../services/planService";
import Avatar from "./community/Avatar";
import logger from "../utils/logger";

const SLIDE_MS = 6000;
const WEEKDAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

// Odaklanma saatine göre "persona" — hangi saat diliminde en çok dakika
// biriktirdiğine göre seçilir (yalnızca seans SAYISI değil, TOPLAM SÜRE —
// 10 tane 5dk'lık seans, 2 tane 60dk'lık seansa göre daha "baskın" görünmesin).
const PERSONAS = [
  { key: "night", from: 0, to: 4, label: "Gece Mimarı", emoji: "🌙", tint: "#B26BFF" },
  { key: "dawn", from: 5, to: 7, label: "Şafak Savaşçısı", emoji: "🌅", tint: "#F59E0B" },
  { key: "morning", from: 8, to: 11, label: "Sabah Enerjisi", emoji: "☀️", tint: "#22D3EE" },
  { key: "midday", from: 12, to: 16, label: "Öğlen Ustası", emoji: "🔥", tint: "#F4406B" },
  { key: "evening", from: 17, to: 20, label: "Akşam Akışı", emoji: "🌆", tint: "#FB923C" },
  { key: "lateEvening", from: 21, to: 23, label: "Gece Kuşu", emoji: "🦉", tint: "#6E7BFF" },
];

function personaForHour(hour) {
  return PERSONAS.find((p) => hour >= p.from && hour <= p.to) || PERSONAS[2];
}

function minutesLabel(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} dk`;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

// GERÇEK VERİDEN hesaplanır (focus_sessions — Ritim & Gün Sonu modülünün de
// TEK gerçek kaynağı, bkz. migration.sql 7. bölüm yorumu). Hiçbir alan
// uydurulmaz: pesona = en çok dakika biriktirilen saat dilimi, "şampiyon" =
// en çok odaklanılan görev (focus_sessions.task_id üzerinden), en verimli
// gün = haftanın en yüksek toplam dakikalı günü.
function computeWeeklyStats(sessions, taskTitleById) {
  if (!sessions.length) return null;

  const personaMinutes = new Map();
  const dayMinutes = new Map();
  const taskMinutes = new Map();
  let totalMinutes = 0;

  for (const s of sessions) {
    const dur = s.duration_min || 0;
    totalMinutes += dur;
    const started = new Date(s.started_at);
    const hour = started.getHours();
    const day = started.getDay();
    const persona = personaForHour(hour);
    personaMinutes.set(persona.key, (personaMinutes.get(persona.key) || 0) + dur);
    dayMinutes.set(day, (dayMinutes.get(day) || 0) + dur);
    const taskKey = s.task_id || "__free__";
    taskMinutes.set(taskKey, (taskMinutes.get(taskKey) || 0) + dur);
  }

  const topPersonaKey = [...personaMinutes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const persona = PERSONAS.find((p) => p.key === topPersonaKey);

  const [topDay, topDayMinutes] = [...dayMinutes.entries()].sort((a, b) => b[1] - a[1])[0];
  const [topTaskKey, topTaskMinutes] = [...taskMinutes.entries()].sort((a, b) => b[1] - a[1])[0];
  const championLabel = topTaskKey !== "__free__" ? taskTitleById.get(topTaskKey) || "Bir görev" : "Serbest Odak Seansları";

  return {
    totalMinutes,
    sessionCount: sessions.length,
    persona,
    bestDay: { name: WEEKDAYS_TR[topDay], minutes: topDayMinutes },
    champion: { label: championLabel, minutes: topTaskMinutes },
    episodeCount: Math.max(1, Math.round(totalMinutes / 45)),
  };
}

function ProgressBar({ activeSlide, total }) {
  return (
    <div className="flex gap-1 px-4 pt-3 shrink-0">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1 h-[3px] rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-white rounded-full"
            style={
              i < activeSlide
                ? { width: "100%" }
                : i > activeSlide
                  ? { width: "0%" }
                  : { animation: `weeklyFlowFill ${SLIDE_MS}ms linear forwards` }
            }
          />
        </div>
      ))}
      <style>{`@keyframes weeklyFlowFill { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
}

// "Weekly Flow" — Spotify Wrapped tarzı, 9:16 Instagram Story formatında
// haftalık odak karnesi. CommunityHub içinden AÇILIR (bkz. oradaki tetikleyici
// banner) — kendi z-index'i CommunityHub'ınkinden yüksektir (z-[150]) ama
// CommunityHub'ın zaten sağladığı BackgroundScene-suspend kapsamının İÇİNDE
// kalır (ayrıca app.jsx'e dokunmaya gerek YOK). Auto-advance TEK BİR
// setTimeout ile yapılır (setInterval DEĞİL) — her slayt değişiminde yeniden
// kurulur ve kapanışta/manuel gezinmede temizlenir; sürekli tikleyen bir
// zamanlayıcı YOK, bu oturumda ısınmaya sebep olan "arkada sonsuza dek koşan
// animasyon" hatasının aynısına düşülmez.
export default function WeeklyFlowModal({ open, user, profile, onClose }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exported, setExported] = useState(false);
  const exportRef = useRef(null);
  const totalSlides = 4;

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    setActiveSlide(0);
    setExported(false);
    const toISO = new Date().toISOString();
    const fromISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    fetchFocusSessions(user.id, { fromISO, toISO })
      .then(async (sessions) => {
        if (cancelled) return;
        const taskIds = sessions.map((s) => s.task_id).filter(Boolean);
        const tasks = await fetchTasksByIds(user.id, taskIds);
        if (cancelled) return;
        const taskTitleById = new Map(tasks.map((t) => [t.id, t.title]));
        setStats(computeWeeklyStats(sessions, taskTitleById));
      })
      .catch((err) => logger.error("WEEKLY_FLOW", "Haftalık veri getirilemedi", { error: err?.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const goNext = useCallback(() => setActiveSlide((s) => Math.min(totalSlides - 1, s + 1)), []);
  const goPrev = useCallback(() => setActiveSlide((s) => Math.max(0, s - 1)), []);

  // Tek seferlik auto-advance — her slayt değişiminde/açılışta yeniden kurulur,
  // son slaytta durur (sonsuz döngü YOK), export sırasında duraklatılır.
  useEffect(() => {
    if (!open || !stats || exporting || activeSlide >= totalSlides - 1) return;
    const id = setTimeout(goNext, SLIDE_MS);
    return () => clearTimeout(id);
  }, [open, stats, activeSlide, exporting, goNext]);

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Routinix Kullanıcısı";
  const handle = profile?.username ? `@${profile.username}` : "";

  const handleDownload = async () => {
    if (!exportRef.current || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const dataUrl = await toPng(exportRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: "#0a0f1d" });
      const link = document.createElement("a");
      link.download = `routinix-haftalik-akis-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      setExported(true);
    } catch (err) {
      logger.error("WEEKLY_FLOW", "PNG dışa aktarılamadı", { error: err?.message });
      setExportError("Görsel oluşturulamadı, tekrar dener misin?");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 py-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[360px] max-w-[92vw] h-[640px] max-h-[85vh] rounded-[28px] border border-cyan-500/30 overflow-hidden flex flex-col"
        style={{
          background: [
            "radial-gradient(circle at 15% 10%, rgba(178,107,255,0.32) 0%, transparent 45%)",
            "radial-gradient(circle at 90% 90%, rgba(34,211,238,0.26) 0%, transparent 45%)",
            "#0a0f1d",
          ].join(", "),
        }}
      >
        <ProgressBar activeSlide={activeSlide} total={totalSlides} />

        <div className="shrink-0 px-4 pt-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/80">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> Weekly Flow
          </span>
          <button onClick={onClose} aria-label="Kapat" className="w-7 h-7 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sol/sağ dokunma alanları — Instagram Story navigasyonu (sol %35 geri, sağ %65 ileri) */}
        {!loading && stats && (
          <>
            <button aria-label="Önceki" onClick={goPrev} className="absolute left-0 top-16 bottom-0 w-[35%] z-10" style={{ background: "transparent" }} />
            <button aria-label="Sonraki" onClick={goNext} className="absolute right-0 top-16 bottom-0 w-[65%] z-10" style={{ background: "transparent" }} />
          </>
        )}

        <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center">
          {loading ? (
            <p className="text-[13px] text-slate-400">Haftalık akışın hazırlanıyor...</p>
          ) : !stats ? (
            <div className="flex flex-col items-center gap-3">
              <span className="text-[40px]">🌱</span>
              <p className="text-[14px] font-bold text-white">Bu hafta henüz odak kaydın yok</p>
              <p className="text-[12px] text-slate-400 max-w-[240px]">Pomodoro ile bir odak seansı başlat, gelecek haftaki akışın seni burada bekliyor olsun.</p>
            </div>
          ) : (
            <>
              {activeSlide === 0 && (
                <div className="flex flex-col items-center gap-4">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-cyan-300">Bu haftaki unvanın</span>
                  <span className="text-[64px] leading-none">{stats.persona.emoji}</span>
                  <h2 className="text-[26px] font-black text-white leading-tight" style={{ textShadow: `0 0 30px ${stats.persona.tint}66` }}>
                    {stats.persona.label}
                  </h2>
                  <p className="text-[12.5px] text-slate-300 max-w-[260px] leading-relaxed">
                    {stats.sessionCount} odak seansının çoğu bu zaman diliminde gerçekleşti — ritmin burada.
                  </p>
                </div>
              )}

              {activeSlide === 1 && (
                <div className="flex flex-col items-center gap-4">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-cyan-300">Toplam Odak</span>
                  <h2 className="text-[44px] font-black text-white leading-none">{minutesLabel(stats.totalMinutes)}</h2>
                  <p className="text-[13px] text-slate-300 max-w-[260px] leading-relaxed">
                    Bu tam <span className="font-bold text-white">{stats.episodeCount} dizi bölümüne</span> eşit! 📺 Ekranın karşısında değil, hedeflerinin peşindeydin.
                  </p>
                </div>
              )}

              {activeSlide === 2 && (
                <div className="flex flex-col items-center gap-5">
                  <div className="flex flex-col items-center gap-2">
                    <Flame className="w-8 h-8 text-orange-400" />
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-cyan-300">En Sıcak Günün</span>
                    <h3 className="text-[22px] font-black text-white">{stats.bestDay.name}</h3>
                    <p className="text-[11.5px] text-slate-400">{minutesLabel(stats.bestDay.minutes)} odaklandın</p>
                  </div>
                  <div className="w-16 h-px bg-white/15" />
                  <div className="flex flex-col items-center gap-2">
                    <Trophy className="w-8 h-8 text-yellow-400" />
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-cyan-300">Şampiyon Rutin</span>
                    <h3 className="text-[16px] font-black text-white max-w-[240px] leading-snug">{stats.champion.label}</h3>
                    <p className="text-[11.5px] text-slate-400">{minutesLabel(stats.champion.minutes)} adandın</p>
                  </div>
                </div>
              )}

              {activeSlide === 3 && (
                <div ref={exportRef} className="w-full h-full flex flex-col items-center justify-center gap-5 py-8">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-cyan-300">Haftalık Akışın</span>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[36px]">{stats.persona.emoji}</span>
                    <h2 className="text-[19px] font-black text-white">{stats.persona.label}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full px-6">
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-center">
                      <p className="text-[15px] font-black text-white">{minutesLabel(stats.totalMinutes)}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.05em] text-slate-400">Toplam Odak</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-center">
                      <p className="text-[15px] font-black text-white">{stats.bestDay.name}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.05em] text-slate-400">En Sıcak Gün</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2.5">
                    <Avatar src={profile?.avatar_url} name={displayName} size="w-9 h-9" textSize="text-[13px]" />
                    <span className="text-left">
                      <span className="block text-[12.5px] font-bold text-white">{displayName}</span>
                      {handle && <span className="block text-[10.5px] text-slate-400">{handle}</span>}
                    </span>
                  </div>
                  <span className="text-[11px] font-black tracking-[0.1em] text-cyan-300/80">ROUTINIX</span>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && stats && activeSlide === totalSlides - 1 && (
          <div className="relative z-20 shrink-0 px-6 pb-6 pt-2 flex flex-col items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[13px] font-bold text-black disabled:opacity-60 transition-transform active:scale-95"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
            >
              <Download className="w-4 h-4" /> {exporting ? "Hazırlanıyor..." : exported ? "Tekrar İndir" : "Story'de Paylaş (PNG İndir)"}
            </button>
            {exportError && <p className="text-[11px] font-medium text-red-400">{exportError}</p>}
          </div>
        )}

        {!loading && stats && activeSlide < totalSlides - 1 && (
          <div className="relative z-20 shrink-0 pb-6 flex items-center justify-center gap-2 text-slate-500">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Devam etmek için dokun</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}
