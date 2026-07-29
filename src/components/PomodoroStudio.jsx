import { useState, useEffect, useRef } from "react";
import { Timer as TimerIcon, Music2, Play, Pause, ListChecks, SlidersHorizontal } from "lucide-react";
import { fetchDashboardData } from "../services/planService";
import { tapFeedback } from "../lib/haptics";
import logger from "../utils/logger";
import TaskListPanel from "./TaskListPanel";

const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;
const WORK_STEP = 5;
const BREAK_STEP = 1;

const SPOTIFY_EMBED_URL = "https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRw9knGDs0?utm_source=generator&theme=0";
// Lofi Girl — "lofi hip hop radio - beats to relax/study to" (7/24 canlı yayın,
// gömülü oynatım için tasarlanmış, herkese açık video id). Değiştirmek istersen
// bu tek sabiti güncellemen yeterli.
const YOUTUBE_VIDEO_ID = "jfKfPfyJRdk";

// Sayaç rakamları için — index.html'de Google Fonts'tan yükleniyor, yoksa
// sistem monospace'ine güvenli şekilde düşer.
const TIMER_FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const TABS = [
  { key: "counter", label: "Sayaç", icon: TimerIcon },
  { key: "tasks", label: "Görevler", icon: ListChecks },
  { key: "music", label: "Müzik", icon: Music2 },
  { key: "settings", label: "Ayarlar", icon: SlidersHorizontal },
];

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Dev neon sayaç: buzlu cam arkalık + ilerleme halkası + JetBrains Mono
// rakamlar + Aktif Görev satırı. Mobil sekme içeriği VE masaüstü sol sütunda
// ortak kullanılır — `showSteppers`/`onOpenTasks` farkıyla iki bağlamı yönetir.
function CounterPane({
  mode,
  switchMode,
  running,
  secondsLeft,
  pct,
  ringCircumference,
  ringOffset,
  modeAccent,
  lightsOut,
  selectedTask,
  onOpenTasks,
  toggleRunning,
  resetTimer,
  showSteppers,
  workMin,
  breakMin,
  adjustDuration,
}) {
  return (
    <div className="flex flex-col items-center gap-7 w-full">
      {/* Mod sekmeleri (İş/Mola) — Odak Modu'nda gizlenir */}
      <div className={`flex gap-2 transition-opacity duration-500 ${lightsOut ? "opacity-0 pointer-events-none h-0 overflow-hidden" : "opacity-100"}`}>
        {[
          { key: "work", label: "🧠 Odaklanma" },
          { key: "break", label: "☕ Mola" },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => switchMode(m.key)}
            disabled={running}
            className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all disabled:opacity-50"
            style={{
              background: mode === m.key ? "rgba(178,107,255,0.16)" : "rgba(var(--overlay-rgb),0.045)",
              color: mode === m.key ? "var(--pomo-work-accent)" : "var(--text-muted)",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="relative w-[240px] h-[240px] md:w-[280px] md:h-[280px] flex items-center justify-center shrink-0">
        <div
          className="absolute rounded-full transition-all duration-700"
          style={{
            inset: 22,
            background: lightsOut ? "rgba(255,255,255,0.03)" : "rgba(var(--overlay-rgb),0.05)",
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
            boxShadow: `inset 0 0 40px -10px ${modeAccent}`,
          }}
        />
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(var(--overlay-rgb),0.08)" strokeWidth="8" />
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke={modeAccent}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringOffset}
            style={{ transition: "stroke-dashoffset 1s linear", filter: `drop-shadow(0 0 10px ${modeAccent})` }}
          />
        </svg>
        <div className="relative flex flex-col items-center gap-1">
          <span
            className="text-[52px] md:text-[64px] font-bold tabular-nums leading-none transition-all duration-500"
            style={{
              fontFamily: TIMER_FONT,
              color: lightsOut ? "#FFFFFF" : "var(--text-primary)",
              textShadow: lightsOut ? `0 0 12px #fff, 0 0 30px ${modeAccent}, 0 0 60px ${modeAccent}` : `0 0 26px ${modeAccent}`,
            }}
          >
            {formatTime(secondsLeft)}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: modeAccent }}>
            {mode === "work" ? "Odaklanma" : "Mola"}
          </span>
        </div>
      </div>

      {/* Aktif Görev satırı — Odak Modu'nda da görünür kalır */}
      <div
        className="flex items-center gap-2.5 max-w-[92vw] rounded-full px-4 py-2 transition-all duration-500"
        style={{
          background: "rgba(var(--overlay-rgb),0.06)",
          boxShadow: selectedTask ? `0 0 0 1px ${modeAccent}55${lightsOut ? `, 0 0 24px -2px ${modeAccent}` : ""}` : "none",
        }}
      >
        <span className="truncate text-[12.5px] md:text-[13.5px] font-semibold" style={{ color: selectedTask ? modeAccent : "var(--text-faint)" }}>
          {selectedTask ? `📌 ${selectedTask.title}` : "Bir görev seçilmedi"}
        </span>
        {onOpenTasks && (
          <button
            onClick={onOpenTasks}
            className="shrink-0 text-[11.5px] font-semibold rounded-full px-2.5 py-1 transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-muted)" }}
          >
            {selectedTask ? "Değiştir ▾" : "Görev Seç ▾"}
          </button>
        )}
      </div>

      {showSteppers && (
        <DurationSteppers workMin={workMin} breakMin={breakMin} running={running} adjustDuration={adjustDuration} compact />
      )}

      {/* Başlat/Duraklat + Sıfırla — Odak Modu'nda da görünür kalır */}
      <div className="flex items-center gap-3">
        <button
          onClick={resetTimer}
          aria-label="Sıfırla"
          className="w-11 h-11 rounded-full flex items-center justify-center text-[16px] transition-all"
          style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-muted)" }}
        >
          ↺
        </button>
        <button
          onClick={toggleRunning}
          className="rounded-full px-8 py-3 text-[14px] font-bold transition-all"
          style={{ background: modeAccent, color: "#04040a", boxShadow: `0 8px 30px -8px ${modeAccent}` }}
        >
          {running ? "⏸ Duraklat" : "▶ Başlat"}
        </button>
        <div className="w-11" aria-hidden="true" />
      </div>
    </div>
  );
}

// Süre ayarı satırları — "Ayarlar" sekmesinin (mobil) ve masaüstü sayaç
// sütununun ortak içeriği. `compact`: masaüstünde ring'in hemen altında
// küçük tek satır; aksi halde (mobil Ayarlar sekmesi) iki ayrı geniş satır.
function DurationSteppers({ workMin, breakMin, running, adjustDuration, compact }) {
  const rows = [
    { field: "work", label: "🧠 Odaklanma Süresi", value: workMin, step: WORK_STEP },
    { field: "break", label: "☕ Mola Süresi", value: breakMin, step: BREAK_STEP },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-5">
        {rows.map((r) => (
          <div key={r.field} className="flex items-center gap-2.5">
            <span className="text-[10.5px] font-semibold text-[var(--text-faint)]">{r.label.slice(0, 2)}</span>
            <button
              onClick={() => adjustDuration(r.field, -r.step)}
              disabled={running}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold disabled:opacity-30 transition-colors"
              style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-primary)" }}
            >
              −
            </button>
            <span className="text-[12px] font-semibold text-[var(--text-muted)] w-12 text-center" style={{ fontFamily: TIMER_FONT }}>
              {r.value} dk
            </span>
            <button
              onClick={() => adjustDuration(r.field, r.step)}
              disabled={running}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold disabled:opacity-30 transition-colors"
              style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-primary)" }}
            >
              +
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.field} className="flex items-center justify-between rounded-2xl px-4 py-3.5" style={{ background: "rgba(var(--overlay-rgb),0.045)" }}>
          <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">{r.label}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustDuration(r.field, -r.step)}
              disabled={running}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] font-bold disabled:opacity-30 transition-colors"
              style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-primary)" }}
            >
              −
            </button>
            <span className="text-[13px] font-semibold text-[var(--text-muted)] w-14 text-center" style={{ fontFamily: TIMER_FONT }}>
              {r.value} dk
            </span>
            <button
              onClick={() => adjustDuration(r.field, r.step)}
              disabled={running}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] font-bold disabled:opacity-30 transition-colors"
              style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-primary)" }}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Müzik içeriği — Spotify Embed (kendi play/pause/ilerleme çubuğuyla) +
// gerçek YouTube IFrame Player API oynatıcısı (harici sekmeye YÖNLENDİRME
// YOK). Mobilde "Müzik" sekmesinin, masaüstünde sol sütunun içeriği.
function MusicContent({ ytContainerRef, toggleYoutube, ytReady, ytPlaying }) {
  return (
    <div className="flex flex-col gap-5 w-full">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "#1DB954" }}>
          🎧 Spotify — Lo-Fi / Deep Focus
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(var(--overlay-rgb),0.035)" }}>
          <iframe
            title="Spotify Lo-Fi / Deep Focus"
            src={SPOTIFY_EMBED_URL}
            width="100%"
            height="352"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "#FF3B5C" }}>
          ▶ YouTube Music — Lofi Radio
        </p>
        <div className="rounded-2xl overflow-hidden mb-2" style={{ background: "rgba(var(--overlay-rgb),0.035)" }}>
          <div ref={ytContainerRef} className="w-full aspect-video" />
        </div>
        <button
          onClick={toggleYoutube}
          disabled={!ytReady}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(255,59,92,0.12)", color: "#FF3B5C" }}
        >
          {ytPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {ytPlaying ? "Duraklat" : "Oynat"}
        </button>
      </div>
    </div>
  );
}

// 🕐 Pomodoro & Focus Studio — Aşamalı Açıklık (Progressive Disclosure)
// mimarisi: mobilde yüzen alt sekme çubuğu (Sayaç/Görevler/Müzik/Ayarlar) ile
// tek seferde YALNIZCA bir sekmenin içeriği görünür; sayaç çalışırken (veya
// Işıklar Söndü açıldığında) Odak Modu'na geçilip sekme çubuğu dahil tüm
// ikincil kontroller gizlenir. Masaüstünde (≥768px) sekme YOK — sabit 2 sütun:
// sol = Sayaç + Müzik, sağ = Görevler (bkz. TaskListPanel.jsx) sürekli görünür.
export default function PomodoroStudio({ open, userId, initialTaskId, onClose }) {
  const [mode, setMode] = useState("work"); // "work" | "break"
  const [workMin, setWorkMin] = useState(DEFAULT_WORK_MIN);
  const [breakMin, setBreakMin] = useState(DEFAULT_BREAK_MIN);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_WORK_MIN * 60);
  const [running, setRunning] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [lightsOut, setLightsOut] = useState(false);
  const [activeTab, setActiveTab] = useState("counter"); // yalnızca mobil sekme mimarisi için
  const [ytReady, setYtReady] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);

  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);

  const totalForMode = (mode === "work" ? workMin : breakMin) * 60;
  const chromeHidden = lightsOut || running; // Odak Modu: sekme çubuğu + ikincil kontroller gizlenir

  // Görev kartındaki "Başlat" ile açılmışsa (initialTaskId), o görevi otomatik
  // olarak Aktif Görev yapar — kullanıcı Görevler sekmesine gitmeden odaklanmaya başlar.
  useEffect(() => {
    if (open && initialTaskId) setSelectedTaskId(initialTaskId);
  }, [open, initialTaskId]);

  // Drawer açıldığında kullanıcının planlarını çek (görev seçici için).
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    fetchDashboardData(userId)
      .then((data) => !cancelled && setPlans(data))
      .catch((err) => logger.error("POMODORO", "Planlar getirilemedi", { error: err?.message }));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Mod ya da süre değişince (çalışmıyorken) sayaç sıfırlansın.
  useEffect(() => {
    if (!running) setSecondsLeft(totalForMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, workMin, breakMin]);

  // Geri sayım — her saniye tetiklenen, temiz (stale-closure'suz) setTimeout zinciri.
  useEffect(() => {
    if (!open || !running) return;
    if (secondsLeft <= 0) {
      tapFeedback([40, 60, 40]);
      const nextMode = mode === "work" ? "break" : "work";
      setMode(nextMode);
      setSecondsLeft((nextMode === "work" ? workMin : breakMin) * 60);
      setRunning(false);
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [open, running, secondsLeft, mode, workMin, breakMin]);

  // --- YouTube IFrame Player API: gerçek gömülü oynatıcı. Studio açılır
  // açılmaz kurulur (artık ayrı bir "panel açıldı" tetikleyicisi yok — Müzik
  // hem sekme hem de masaüstü sütunu olarak DOM'da mevcut olabiliyor). ---
  useEffect(() => {
    if (!open || ytPlayerRef.current) return;

    const createPlayer = () => {
      if (ytPlayerRef.current || !ytContainerRef.current || !window.YT?.Player) return;
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId: YOUTUBE_VIDEO_ID,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => setYtReady(true),
          onStateChange: (e) => setYtPlaying(e.data === window.YT.PlayerState.PLAYING),
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
      return;
    }
    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      createPlayer();
    };
  }, [open]);

  // Studio tamamen kapanınca YouTube oynatıcıyı da temizle.
  useEffect(() => {
    if (open) return;
    ytPlayerRef.current?.destroy?.();
    ytPlayerRef.current = null;
    setYtReady(false);
    setYtPlaying(false);
  }, [open]);

  if (!open) return null;

  // Seçili görev (varsa) — Aktif Görev satırında gösterilmek üzere tüm
  // planlar/görevler (tamamlanmış dahil, Görevler sekmesi ikisini de listeler) içinde aranır.
  const selectedTaskPlan = plans.find((p) => (p.tasks || []).some((t) => t.id === selectedTaskId));
  const selectedTask = selectedTaskPlan?.tasks.find((t) => t.id === selectedTaskId);

  const pct = totalForMode > 0 ? Math.max(0, Math.min(100, Math.round((1 - secondsLeft / totalForMode) * 100))) : 0;
  const ringCircumference = 2 * Math.PI * 88;
  const ringOffset = ringCircumference * (1 - pct / 100);
  const modeAccent = mode === "work" ? "var(--pomo-work-accent)" : "var(--pomo-break-accent)";

  const adjustDuration = (field, delta) => {
    if (running) return;
    if (field === "work") setWorkMin((m) => Math.min(90, Math.max(5, m + delta)));
    else setBreakMin((m) => Math.min(30, Math.max(1, m + delta)));
  };

  // Odaklanma başlatılınca otomatik olarak Sayaç sekmesine dönülür ve (Odak
  // Modu üzerinden) sekme çubuğu/ikincil kontroller gizlenir — "gereksiz tüm
  // kontroller" isteğinin karşılığı budur.
  const toggleRunning = () =>
    setRunning((r) => {
      const next = !r;
      if (next) setActiveTab("counter");
      return next;
    });

  const resetTimer = () => {
    setRunning(false);
    setSecondsLeft(totalForMode);
  };

  const switchMode = (nextMode) => {
    if (running || nextMode === mode) return;
    setMode(nextMode);
  };

  const toggleYoutube = () => {
    if (!ytPlayerRef.current) return;
    if (ytPlaying) ytPlayerRef.current.pauseVideo();
    else ytPlayerRef.current.playVideo();
  };

  const selectTaskMobile = (taskId) => {
    setSelectedTaskId(taskId);
    setActiveTab("counter");
  };

  const counterProps = {
    mode,
    switchMode,
    running,
    secondsLeft,
    pct,
    ringCircumference,
    ringOffset,
    modeAccent,
    lightsOut,
    selectedTask,
    toggleRunning,
    resetTimer,
    workMin,
    breakMin,
    adjustDuration,
  };

  const musicProps = { ytContainerRef, toggleYoutube, ytReady, ytPlaying };

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col transition-colors duration-700"
      style={{
        background: lightsOut ? "rgba(2,2,4,0.985)" : "rgba(var(--glass-rgb), var(--alpha-modal))",
        backdropFilter: "blur(28px) saturate(150%)",
        WebkitBackdropFilter: "blur(28px) saturate(150%)",
      }}
    >
      {/* Üst bar — Odak Modu'nda sadeleşir (yalnızca kapatma + odak butonu kalır) */}
      <div className="shrink-0 px-4 md:px-8 pt-5 pb-3 flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2.5 transition-opacity duration-500 ${lightsOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <TimerIcon className="w-5 h-5" style={{ color: "var(--pomo-work-accent)" }} strokeWidth={2.25} />
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Pomodoro &amp; Focus Studio</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLightsOut((v) => !v)}
            aria-label="Odak Modu / Işıkları Söndür"
            title="Odak Modu"
            className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
            style={{
              background: lightsOut ? "rgba(178,107,255,0.22)" : "rgba(var(--overlay-rgb),0.06)",
              color: lightsOut ? "#C99CFF" : "var(--text-muted)",
            }}
          >
            💡 {lightsOut ? "Işıkları Aç" : "Odak Modu"}
          </button>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all ${lightsOut ? "opacity-40 hover:opacity-100" : ""}`}
            style={{ background: "rgba(var(--overlay-rgb),0.06)" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* MOBİL: Aşamalı Açıklık — tek seferde yalnızca AKTİF sekmenin içeriği */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-6 py-4 gap-6">
        {activeTab === "counter" && <CounterPane {...counterProps} onOpenTasks={() => setActiveTab("tasks")} showSteppers={false} />}
        {activeTab === "tasks" && (
          <div className="w-full h-full min-h-0 flex-1">
            <TaskListPanel plans={plans} selectedTaskId={selectedTaskId} onSelectTask={selectTaskMobile} />
          </div>
        )}
        {activeTab === "music" && <MusicContent {...musicProps} />}
        {activeTab === "settings" && (
          <div className="w-full flex flex-col gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">Süre Ayarları</p>
            <DurationSteppers workMin={workMin} breakMin={breakMin} running={running} adjustDuration={adjustDuration} />
          </div>
        )}
      </div>

      {/* MASAÜSTÜ (≥768px): sekme yok — sabit 2 sütun, hepsi aynı anda görünür */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_380px] md:gap-10 flex-1 min-h-0 px-8 pb-8">
        <div className="min-h-0 overflow-y-auto no-scrollbar flex flex-col items-center gap-10 py-4">
          <CounterPane {...counterProps} onOpenTasks={null} showSteppers />
          <MusicContent {...musicProps} />
        </div>
        <div className="min-h-0 flex flex-col py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)] mb-3 shrink-0">Görevler</p>
          <TaskListPanel plans={plans} selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} />
        </div>
      </div>

      {/* Mobil yüzen alt sekme çubuğu — Odak Modu'nda kayıp soluklaşarak kaybolur */}
      <div
        className={`md:hidden shrink-0 px-4 transition-all duration-500 ${chromeHidden ? "opacity-0 translate-y-3 pointer-events-none" : "opacity-100 translate-y-0"}`}
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className="pomo-tabbar flex items-center justify-around rounded-2xl px-2 py-2"
          style={{
            background: "rgba(var(--glass-rgb), var(--alpha-modal))",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            boxShadow: "0 12px 34px -14px rgba(0,0,0,0.55)",
          }}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="flex-1 flex flex-col items-center gap-1 rounded-xl py-2 transition-colors"
                style={{ background: active ? "rgba(178,107,255,0.16)" : "transparent", color: active ? "var(--pomo-work-accent)" : "var(--text-muted)" }}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={2.25} />
                <span className="text-[9.5px] font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
