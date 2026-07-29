import { useState, useEffect, useRef } from "react";
import { Timer as TimerIcon, Music2, Play, Pause } from "lucide-react";
import { fetchDashboardData } from "../services/planService";
import { tapFeedback } from "../lib/haptics";
import logger from "../utils/logger";
import FocusSidePanel from "./FocusSidePanel";
import TaskPickerModal from "./TaskPickerModal";

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

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// 🕐 Pomodoro & Focus Studio — tam ekran, tema-duyarlı (light/dark) odaklanma
// zamanlayıcısı. Ana ekran sade tutulur: yalnızca 1 "Aktif Görev" kartı +
// "Görev Seç/Değiştir" butonu görünür — tam görev listesi ayrı bir açılır
// pencerede yaşar (bkz. TaskPickerModal.jsx: arama + Devam Eden/Tamamlanmış
// sekmeleri + plan bazlı akordeon, masaüstünde merkezi modal / mobilde bottom
// sheet). Müzik (Spotify + gerçek YouTube IFrame API oynatıcısı) ayrıca sağ
// yan panelde (bkz. FocusSidePanel.jsx). Header (masaüstü) ve mobil hızlı
// erişim/alt bar üzerinden açılır (bkz. app.jsx).
export default function PomodoroStudio({ open, userId, onClose }) {
  const [mode, setMode] = useState("work"); // "work" | "break"
  const [workMin, setWorkMin] = useState(DEFAULT_WORK_MIN);
  const [breakMin, setBreakMin] = useState(DEFAULT_BREAK_MIN);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_WORK_MIN * 60);
  const [running, setRunning] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [lightsOut, setLightsOut] = useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [musicPanelOpen, setMusicPanelOpen] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);

  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);

  const totalForMode = (mode === "work" ? workMin : breakMin) * 60;

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

  // --- YouTube IFrame Player API: gerçek gömülü oynatıcı (harici sekmeye
  // yönlendirme YOK). Yalnızca Müzik paneli ilk kez açıldığında kurulur;
  // panel kapanıp açılsa da player instance korunur (müzik kesilmez). ---
  useEffect(() => {
    if (!musicPanelOpen || ytPlayerRef.current) return;

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
  }, [musicPanelOpen]);

  // Studio tamamen kapanınca YouTube oynatıcıyı da temizle.
  useEffect(() => {
    if (open) return;
    ytPlayerRef.current?.destroy?.();
    ytPlayerRef.current = null;
    setYtReady(false);
    setYtPlaying(false);
  }, [open]);

  if (!open) return null;

  // Seçili görev (varsa) — Aktif Görev kartında gösterilmek üzere tüm
  // planlar/görevler (tamamlanmış dahil, TaskPickerModal ikisini de listeler) içinde aranır.
  const selectedTaskPlan = plans.find((p) => (p.tasks || []).some((t) => t.id === selectedTaskId));
  const selectedTask = selectedTaskPlan?.tasks.find((t) => t.id === selectedTaskId);

  const pct = totalForMode > 0 ? Math.max(0, Math.min(100, Math.round((1 - secondsLeft / totalForMode) * 100))) : 0;
  const ringCircumference = 2 * Math.PI * 88;
  const ringOffset = ringCircumference * (1 - pct / 100);
  const modeAccent = mode === "work" ? "var(--pomo-work-accent)" : "var(--pomo-break-accent)";

  const adjustDuration = (delta) => {
    if (running) return;
    if (mode === "work") setWorkMin((m) => Math.min(90, Math.max(5, m + delta)));
    else setBreakMin((m) => Math.min(30, Math.max(1, m + delta)));
  };

  const toggleRunning = () => setRunning((r) => !r);

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
        <div
          className={`flex items-center gap-2.5 transition-opacity duration-500 ${lightsOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          <TimerIcon className="w-5 h-5" style={{ color: "var(--pomo-work-accent)" }} strokeWidth={2.25} />
          <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Pomodoro &amp; Focus Studio</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Müzik paneli tetikleyicisi — Odak Modu'nda gizlenir (görev seçimi
              artık burada değil, Aktif Görev kartındaki "Görev Seç" butonunda) */}
          <div className={`flex items-center gap-2 transition-opacity duration-500 ${lightsOut ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100"}`}>
            <button
              onClick={() => setMusicPanelOpen(true)}
              aria-label="Müzik"
              title="Müzik"
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(29,185,84,0.10)", color: "#1DB954", border: "1px solid rgba(29,185,84,0.3)" }}
            >
              <Music2 className="w-[17px] h-[17px]" strokeWidth={2} />
            </button>
          </div>

          <button
            onClick={() => setLightsOut((v) => !v)}
            aria-label="Odak Modu / Işıkları Söndür"
            title="Odak Modu"
            className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
            style={{
              background: lightsOut ? "rgba(178,107,255,0.22)" : "rgba(var(--overlay-rgb),0.06)",
              color: lightsOut ? "#C99CFF" : "var(--text-muted)",
              border: `1px solid ${lightsOut ? "rgba(178,107,255,0.45)" : "var(--modal-border)"}`,
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

      {/* Ana içerik: dev sayaç + Aktif Görev kartı + kontroller (ana ekranda
          KESİNLİKLE uzun bir görev listesi yok — tam liste TaskPickerModal'da) */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-6 px-6 py-4">
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
                background: mode === m.key ? "rgba(178,107,255,0.16)" : "transparent",
                color: mode === m.key ? "var(--pomo-work-accent)" : "var(--text-muted)",
                border: `1px solid ${mode === m.key ? "rgba(178,107,255,0.4)" : "var(--modal-border)"}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Dev neon sayaç: buzlu cam arkalık + ilerleme halkası + JetBrains Mono rakamlar.
            Odak Modu'nda glow/kontrast belirgin şekilde artar. */}
        <div className="relative w-[240px] h-[240px] md:w-[280px] md:h-[280px] flex items-center justify-center shrink-0">
          {/* Buzlu cam dairesel arkalık */}
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
                textShadow: lightsOut
                  ? `0 0 12px #fff, 0 0 30px ${modeAccent}, 0 0 60px ${modeAccent}`
                  : `0 0 26px ${modeAccent}`,
              }}
            >
              {formatTime(secondsLeft)}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: modeAccent }}>
              {mode === "work" ? "Odaklanma" : "Mola"}
            </span>
          </div>
        </div>

        {/* Aktif Görev kartı — ana ekranda görünen TEK görev satırı. Odak
            Modu'nda da görünür kalır (görev başlığı belirgin kalmalı). */}
        <div
          className="flex items-center gap-2.5 max-w-[92vw] rounded-full px-4 py-2 transition-all duration-500"
          style={{
            background: "rgba(var(--overlay-rgb),0.06)",
            border: `1px solid ${selectedTask ? modeAccent : "var(--modal-border)"}`,
            boxShadow: lightsOut && selectedTask ? `0 0 24px -2px ${modeAccent}` : "none",
          }}
        >
          <span
            className="truncate text-[12.5px] md:text-[13.5px] font-semibold"
            style={{ color: selectedTask ? modeAccent : "var(--text-faint)" }}
          >
            {selectedTask ? `📌 ${selectedTask.title}` : "Bir görev seçilmedi"}
          </span>
          <button
            onClick={() => setTaskPickerOpen(true)}
            className="shrink-0 text-[11.5px] font-semibold rounded-full px-2.5 py-1 transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-muted)" }}
          >
            {selectedTask ? "Değiştir ▾" : "Görev Seç ▾"}
          </button>
        </div>

        {/* Süre ayarı (+/-) — Odak Modu'nda gizlenir */}
        <div className={`flex items-center gap-3 transition-opacity duration-500 ${lightsOut ? "opacity-0 pointer-events-none h-0 overflow-hidden" : "opacity-100"}`}>
          <button
            onClick={() => adjustDuration(mode === "work" ? -WORK_STEP : -BREAK_STEP)}
            disabled={running}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] font-bold disabled:opacity-30 transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-primary)" }}
          >
            −
          </button>
          <span className="text-[12.5px] font-semibold text-[var(--text-muted)] w-20 text-center" style={{ fontFamily: TIMER_FONT }}>
            {mode === "work" ? workMin : breakMin} dk
          </span>
          <button
            onClick={() => adjustDuration(mode === "work" ? WORK_STEP : BREAK_STEP)}
            disabled={running}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[16px] font-bold disabled:opacity-30 transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-primary)" }}
          >
            +
          </button>
        </div>

        {/* Başlat/Duraklat + Sıfırla — Odak Modu'nda da görünür kalır (sayaç kontrolü şart) */}
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

      {/* --- Görev Seçici (Modal masaüstünde / Bottom Sheet mobilde) --- */}
      <TaskPickerModal
        open={taskPickerOpen}
        onClose={() => setTaskPickerOpen(false)}
        plans={plans}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
      />

      {/* --- Müzik paneli (sağ yan panel / mobilde alt sheet) ---
          Spotify: resmi Embed iframe zaten kendi içinde play/pause/ilerleme
          çubuğu sunuyor (uygulamadan çıkmadan tam kontrol). YouTube: gerçek
          IFrame Player API ile kurulu, kendi Oynat/Duraklat butonumuzla
          kontrol ediliyor — harici sekmeye YÖNLENDİRME YOK. */}
      <FocusSidePanel
        open={musicPanelOpen}
        onClose={() => setMusicPanelOpen(false)}
        side="right"
        title="Müzik"
        icon={<Music2 className="w-[18px] h-[18px]" style={{ color: "#1DB954" }} strokeWidth={2.25} />}
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "#1DB954" }}>
              🎧 Spotify — Lo-Fi / Deep Focus
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--modal-border)" }}>
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
            <div className="rounded-2xl overflow-hidden mb-2" style={{ border: "1px solid var(--modal-border)" }}>
              <div ref={ytContainerRef} className="w-full aspect-video" />
            </div>
            <button
              onClick={toggleYoutube}
              disabled={!ytReady}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] font-semibold transition-all disabled:opacity-40"
              style={{ background: "rgba(255,59,92,0.12)", color: "#FF3B5C", border: "1px solid rgba(255,59,92,0.35)" }}
            >
              {ytPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {ytPlaying ? "Duraklat" : "Oynat"}
            </button>
          </div>
        </div>
      </FocusSidePanel>
    </div>
  );
}
