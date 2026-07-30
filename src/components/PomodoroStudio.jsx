import { useState, useEffect, useRef } from "react";
import { Timer as TimerIcon, Music2, ListMusic, Play, Pause, X, ClipboardList } from "lucide-react";
import { tapFeedback } from "../lib/haptics";
import logger from "../utils/logger";
import TaskDrawer from "./TaskDrawer";

const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;
const WORK_STEP = 5;
const BREAK_STEP = 1;

// İki kısa, herkese açık, gömülü oynatım için tasarlanmış Lofi Girl canlı
// yayını — gerçek bir "Önceki/Sonraki" deneyimi için (tek video yerine küçük
// bir liste). Parça adı hazır olduğunda YouTube'un kendi verisinden
// (player.getVideoData().title) çekilir; bu etiketler yalnızca ilk an/düşüş içindir.
const PLAYLIST = [
  { id: "5qap5aO4i9A", label: "lofi hip hop radio 📚 beats to relax/study to" },
  { id: "jfKfPfyJRdk", label: "synthwave radio 🌌 beats to chill/game to" },
];

// Spotify Embed iframe (resmi "Lo-Fi Beats" editöryel çalma listesi) — Spotify
// Web Playback SDK (Premium hesap + OAuth gerektirir) olmadan DIŞARIDAN kontrol
// (play/pause/skip) mümkün değil; bu yüzden Spotify kendi görünür oynatıcısıyla
// yalnızca popover AÇIKKEN çalışır (bkz. SpotifyPopover).
const SPOTIFY_PLAYLIST_ID = "37i9dQZF1DWWQRw9knGDs0";
const SPOTIFY_EMBED_URL = `https://open.spotify.com/embed/playlist/${SPOTIFY_PLAYLIST_ID}?utm_source=generator&theme=0`;

const TIMER_FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

// Tema-duyarlı vurgu renkleri — index.css'teki --pomo-work-accent/
// --pomo-break-accent üzerinden okunur: koyu temada neon cyan/zümrüt, açık
// temada okunur mor/turkuaz. `--pomo-accent`, mod'a bağlı olmayan genel
// "marka" çipleri (Odak Modu, Görevler ve Planlar butonu) için ayrı bir
// tondur (koyu: aynı neon cyan; açık: cyan-600 — beyaz zeminde okunur).
const ACCENT = { work: "var(--pomo-work-accent)", break: "var(--pomo-break-accent)" };
const BRAND_ACCENT = "var(--pomo-accent)";

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Neon halkalı, buzlu-cam arkalıklı, JetBrains Mono rakamlı dev sayaç. Odak
// Modu'nda (`boost`) glow/kontrast belirgin şekilde artar.
function TimerRing({ secondsLeft, mode, accent, pct, ringCircumference, ringOffset, boost }) {
  return (
    <div className="relative w-[250px] h-[250px] md:w-[300px] md:h-[300px] flex items-center justify-center shrink-0">
      <div
        className="absolute rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 backdrop-blur-xl transition-all duration-700"
        style={{ inset: 20, boxShadow: `inset 0 0 46px -12px ${accent}` }}
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(var(--overlay-rgb),0.06)" strokeWidth="7" />
        <circle
          cx="100"
          cy="100"
          r="88"
          fill="none"
          stroke={accent}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringOffset}
          style={{ transition: "stroke-dashoffset 1s linear", filter: `drop-shadow(0 0 ${boost ? 14 : 9}px ${accent})` }}
        />
      </svg>
      <div className="relative flex flex-col items-center gap-1.5">
        <span
          className="text-[56px] md:text-[68px] font-bold tabular-nums leading-none tracking-wider transition-all duration-500"
          style={{
            fontFamily: TIMER_FONT,
            color: "var(--text-primary)",
            textShadow: `0 0 ${boost ? 34 : 20}px ${boost ? accent : `color-mix(in srgb, ${accent} 60%, transparent)`}`,
          }}
        >
          {formatTime(secondsLeft)}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] whitespace-nowrap" style={{ color: accent }}>
          {mode === "work" ? "Odaklanma" : "Mola"}
        </span>
      </div>
    </div>
  );
}

// Başlat/Duraklat (devasa, neon dolgu) + Sıfırla — Odak Modu'nda da HER ZAMAN
// görünür kalan TEK kontrol grubu.
function ControlButtons({ running, toggleRunning, resetTimer, accent }) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={resetTimer}
        aria-label="Sıfırla"
        className="w-12 h-12 rounded-full flex items-center justify-center text-[17px] text-gray-500 hover:text-gray-900 dark:text-white/50 dark:hover:text-white/90 bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 transition-all active:scale-95"
      >
        ↺
      </button>
      <button
        onClick={toggleRunning}
        className="rounded-full px-11 py-4 text-[15px] font-bold whitespace-nowrap text-[#040608] transition-all active:scale-95"
        style={{ background: accent, boxShadow: `0 0 40px -6px ${accent}, 0 10px 34px -10px ${accent}` }}
      >
        {running ? "⏸ Duraklat" : "▶ Başlat"}
      </button>
      <div className="w-12" aria-hidden="true" />
    </div>
  );
}

// Odaklanma/Mola segmented control — neon geçişli.
function ModeTabs({ mode, switchMode, running }) {
  return (
    <div className="flex gap-1.5 p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10">
      {[
        { key: "work", label: "Odaklanma" },
        { key: "break", label: "Mola" },
      ].map((m) => {
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => switchMode(m.key)}
            disabled={running}
            className={`rounded-full px-5 py-1.5 text-[12.5px] font-bold whitespace-nowrap transition-all disabled:opacity-40 ${
              active ? "" : "text-gray-400 dark:text-white/40"
            }`}
            style={{
              background: active ? `color-mix(in srgb, ${ACCENT[m.key]} 12%, transparent)` : "transparent",
              color: active ? ACCENT[m.key] : undefined,
              boxShadow: active ? `0 0 16px -4px ${ACCENT[m.key]}` : "none",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// Halkanın altındaki "Seçili Görev" rozeti — glassmorphism, tek satır truncate.
// Dokununca (paylaşılan) TaskDrawer'ı açar.
function SelectedTaskBadge({ selectedTask, accent, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2.5 max-w-[92vw] rounded-full px-4 py-2 bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 backdrop-blur-xl transition-all duration-300"
    >
      <span
        className="truncate text-[12.5px] font-semibold whitespace-nowrap"
        style={{ color: selectedTask ? accent : "var(--text-faint)" }}
      >
        {selectedTask ? `📌 Seçili Görev: ${selectedTask.title}` : "Bir görev seçilmedi"}
      </span>
      <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.06] text-gray-500 dark:text-white/50 whitespace-nowrap">
        {selectedTask ? "Değiştir" : "Seç"}
      </span>
    </button>
  );
}

// Süre ayarı satırları — Odaklanma/Mola için ayrı ayrı, dikeyde hizalı iki
// satır. Her satırda -/değer/+ ergonomik pill butonlar.
function DurationSteppers({ workMin, breakMin, running, adjustDuration }) {
  const rows = [
    { field: "work", label: "Odaklanma", value: workMin, step: WORK_STEP, accent: ACCENT.work },
    { field: "break", label: "Mola", value: breakMin, step: BREAK_STEP, accent: ACCENT.break },
  ];
  return (
    <div className="flex flex-col gap-2 w-full max-w-[300px]">
      {rows.map((r) => (
        <div key={r.field} className="flex items-center justify-between rounded-2xl px-3.5 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10">
          <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: r.accent }}>
            {r.label}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => adjustDuration(r.field, -r.step)}
              disabled={running}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold text-gray-600 dark:text-white/70 bg-black/[0.04] dark:bg-white/[0.05] disabled:opacity-25 transition-all active:scale-90"
            >
              −
            </button>
            <span className="text-[12.5px] font-bold text-gray-900 dark:text-white w-11 text-center whitespace-nowrap" style={{ fontFamily: TIMER_FONT }}>
              {r.value} dk
            </span>
            <button
              onClick={() => adjustDuration(r.field, r.step)}
              disabled={running}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-bold text-gray-600 dark:text-white/70 bg-black/[0.04] dark:bg-white/[0.05] disabled:opacity-25 transition-all active:scale-90"
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// "Hero Focus Zone" — mod sekmeleri + halka + görev rozeti + süre ayarı +
// kontrol butonları. Mobil ve masaüstünde AYNI, tek ortak odak ekranı —
// görev/plan seçimi artık gömülü bir panel değil, paylaşılan TaskDrawer
// (bkz. PomodoroStudio ana bileşeni). Odak Modu'nda mod sekmeleri/rozet/süre
// ayarı `grid-template-rows` tekniğiyle YUMUŞAKÇA yüksekliği sıfıra iner +
// solar (yalnızca opaklık değil, gerçekten yer de kaplamaz) — halka + kontrol
// butonları HER ZAMAN kalır.
function HeroZone({
  mode,
  switchMode,
  running,
  secondsLeft,
  pct,
  ringCircumference,
  ringOffset,
  accent,
  selectedTask,
  onOpenTaskDrawer,
  toggleRunning,
  resetTimer,
  workMin,
  breakMin,
  adjustDuration,
  isFocusMode,
}) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full grid transition-[grid-template-rows] duration-500 ease-out" style={{ gridTemplateRows: isFocusMode ? "0fr" : "1fr" }}>
        <div className="overflow-hidden min-h-0">
          <div className={`flex flex-col items-center pb-7 transition-opacity duration-300 ${isFocusMode ? "opacity-0" : "opacity-100"}`}>
            <ModeTabs mode={mode} switchMode={switchMode} running={running} />
          </div>
        </div>
      </div>

      <TimerRing secondsLeft={secondsLeft} mode={mode} accent={accent} pct={pct} ringCircumference={ringCircumference} ringOffset={ringOffset} boost={isFocusMode} />

      <div className="w-full grid transition-[grid-template-rows] duration-500 ease-out" style={{ gridTemplateRows: isFocusMode ? "0fr" : "1fr" }}>
        <div className="overflow-hidden min-h-0">
          <div className={`flex flex-col items-center gap-5 pt-7 pb-7 transition-opacity duration-300 ${isFocusMode ? "opacity-0" : "opacity-100"}`}>
            <SelectedTaskBadge selectedTask={selectedTask} accent={accent} onOpen={onOpenTaskDrawer} />
            <DurationSteppers workMin={workMin} breakMin={breakMin} running={running} adjustDuration={adjustDuration} />
          </div>
        </div>
      </div>

      <ControlButtons running={running} toggleRunning={toggleRunning} resetTimer={resetTimer} accent={accent} />
    </div>
  );
}

// Üst bardaki müzik popover'larının ortak iskeleti: tam ekran görünmez bir
// backdrop (dışarı tıklayınca kapanır) + sağ üstte, diğer panellerle ASLA
// çakışmayan yüksek z-index'li ([97]/[96]) küçük, kompakt bir kutu.
function MusicPopoverShell({ onClose, title, tint, children }) {
  return (
    <>
      <div className="fixed inset-0 z-[96]" onClick={onClose} />
      <div
        className="absolute top-full right-0 mt-2 z-[97] w-[300px] rounded-2xl p-4 border border-black/10 dark:border-white/10 backdrop-blur-xl"
        style={{ background: "var(--pomo-bg)", boxShadow: `0 24px 60px -18px rgba(0,0,0,0.35), 0 0 0 1px ${tint}22` }}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[12.5px] font-bold whitespace-nowrap" style={{ color: tint }}>
            {title}
          </h4>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 dark:text-white/40 dark:hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// Spotify popover — resmi Embed iframe'i (kendi play/pause/ilerleme
// çubuğuyla) yalnızca bu popover AÇIKKEN mount edilir/çalar; kapatınca durur.
// Web Playback SDK (Premium hesap + OAuth) olmadan dışarıdan kontrol edilemez —
// bu yüzden sahte/çalışmayan bir Oynat/Durdur butonu GÖSTERİLMİYOR, kontrol
// doğrudan Spotify'ın kendi embed arayüzünde yapılıyor.
function SpotifyPopover({ onClose }) {
  return (
    <MusicPopoverShell onClose={onClose} title="🎧 Spotify — Lo-Fi Beats" tint="#1DB954">
      <div className="rounded-xl overflow-hidden">
        <iframe
          title="Spotify Lo-Fi Beats"
          src={SPOTIFY_EMBED_URL}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>
      <p className="mt-2.5 text-[10.5px] leading-relaxed text-gray-500 dark:text-white/35">
        Spotify'ın kendi oynatıcısı — kontrolü doğrudan burada yap. Bu pencereyi kapatman müziği durdurur.
      </p>
    </MusicPopoverShell>
  );
}

// YouTube Music popover — bir parça seçilince arkadaki gizli YouTube IFrame
// Player'ı besler ve panel kendiliğinden kapanır. Oynat/Duraklat kontrolü de
// burada yaşıyor (ayrı bir kontrol yüzeyi olmadan işlevsellik kaybolmasın diye).
function YoutubePopover({ onClose, trackIndex, trackLabel, ytReady, ytPlaying, onTogglePlay, onSelectTrack }) {
  return (
    <MusicPopoverShell onClose={onClose} title="▶ YouTube Music" tint="#FF3B5C">
      <div className="flex items-center gap-2.5 mb-3 rounded-xl px-3 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10">
        <span className="flex-1 min-w-0 truncate text-[11.5px] font-semibold text-gray-600 dark:text-white/70 whitespace-nowrap">{trackLabel}</span>
        <button
          onClick={onTogglePlay}
          disabled={!ytReady}
          aria-label={ytPlaying ? "Duraklat" : "Oynat"}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
          style={{ background: "#FF3B5C22", color: "#FF3B5C" }}
        >
          {ytPlaying ? <Pause className="w-3.5 h-3.5" fill="currentColor" /> : <Play className="w-3.5 h-3.5" fill="currentColor" />}
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {PLAYLIST.map((t, i) => {
          const active = i === trackIndex;
          return (
            <button
              key={t.id}
              onClick={() => {
                onSelectTrack(i);
                onClose();
              }}
              className={`text-left rounded-lg px-3 py-2.5 text-[12px] font-medium leading-relaxed transition-colors ${
                active ? "bg-[#FF3B5C]/[0.14] text-[#FF3B5C]" : "bg-black/[0.03] dark:bg-white/[0.03] text-gray-600 dark:text-white/70 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              }`}
            >
              {active ? "▶ " : ""}
              {t.label}
            </button>
          );
        })}
      </div>
    </MusicPopoverShell>
  );
}

// 🕐 Pomodoro & Focus Studio — sabit "neon-dark" bir odak odası (uygulamanın
// light/dark tema tercihinden BİLEREK bağımsız). Görev/Plan seçimi artık
// gömülü bir panel DEĞİL — Ana Sayfa'yla PAYLAŞILAN, ekrandan/layout'tan
// tamamen bağımsız bir Slide-Over çekmece (bkz. TaskDrawer.jsx). Mobil ve
// masaüstü aynı tek "Hero Focus Zone" ekranını kullanır. Odak Modu
// (isFocusMode): üst bar ekstraları GERÇEKTEN (opaklık + pointer-events)
// kaybolur, yalnızca halka + Başlat/Durdur/Sıfırla ve tek bir "Işıkları Aç"
// düğmesi kalır. Alt bir medya çubuğu YOK — müzik yalnızca üst bardaki
// Spotify/YouTube popover'larından kontrol edilir.
export default function PomodoroStudio({ open, userId, initialTask, onClose }) {
  const [mode, setMode] = useState("work"); // "work" | "break"
  const [workMin, setWorkMin] = useState(DEFAULT_WORK_MIN);
  const [breakMin, setBreakMin] = useState(DEFAULT_BREAK_MIN);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_WORK_MIN * 60);
  const [running, setRunning] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [musicPopover, setMusicPopover] = useState(null); // null | "spotify" | "youtube"
  const [ytReady, setYtReady] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [ytTitle, setYtTitle] = useState("");

  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);

  const totalForMode = (mode === "work" ? workMin : breakMin) * 60;

  // Görev kartındaki "Başlat" ile açılmışsa (initialTask — tam görev objesi,
  // ayrı bir fetch gerekmez), o görevi otomatik olarak Aktif Görev yapar.
  useEffect(() => {
    if (open && initialTask) setSelectedTask(initialTask);
  }, [open, initialTask]);

  useEffect(() => {
    if (!running) setSecondsLeft(totalForMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, workMin, breakMin]);

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

  // --- YouTube IFrame Player API: arkada, görünmez şekilde çalan gerçek
  // oynatıcı (harici sekmeye YÖNLENDİRME YOK). ---
  useEffect(() => {
    if (!open || ytPlayerRef.current) return;
    const createPlayer = () => {
      if (ytPlayerRef.current || !ytContainerRef.current || !window.YT?.Player) return;
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId: PLAYLIST[0].id,
        playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => setYtReady(true),
          onStateChange: (e) => {
            setYtPlaying(e.data === window.YT.PlayerState.PLAYING);
            const title = ytPlayerRef.current?.getVideoData?.()?.title;
            if (title) setYtTitle(title);
          },
          onError: (e) => logger.warn("POMODORO_YT", "YouTube oynatıcı hatası", { code: e?.data }),
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

  useEffect(() => {
    if (open) return;
    ytPlayerRef.current?.destroy?.();
    ytPlayerRef.current = null;
    setYtReady(false);
    setYtPlaying(false);
    setYtTitle("");
    setTrackIndex(0);
  }, [open]);

  if (!open) return null;

  const pct = totalForMode > 0 ? Math.max(0, Math.min(100, Math.round((1 - secondsLeft / totalForMode) * 100))) : 0;
  const ringCircumference = 2 * Math.PI * 88;
  const ringOffset = ringCircumference * (1 - pct / 100);
  const accent = ACCENT[mode];
  const trackLabel = ytTitle || PLAYLIST[trackIndex].label;

  const adjustDuration = (field, delta) => {
    if (running) return;
    if (field === "work") setWorkMin((m) => Math.min(90, Math.max(5, m + delta)));
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

  const goToTrack = (nextIndex) => {
    const clamped = ((nextIndex % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    setTrackIndex(clamped);
    setYtTitle("");
    ytPlayerRef.current?.loadVideoById?.(PLAYLIST[clamped].id);
  };

  const heroProps = {
    mode,
    switchMode,
    running,
    secondsLeft,
    pct,
    ringCircumference,
    ringOffset,
    accent,
    selectedTask,
    toggleRunning,
    resetTimer,
    workMin,
    breakMin,
    adjustDuration,
    isFocusMode,
    onOpenTaskDrawer: () => setTaskDrawerOpen(true),
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col transition-colors duration-700" style={{ background: isFocusMode ? "var(--pomo-bg-focus)" : "var(--pomo-bg)" }}>
      {/* YouTube oynatıcı — görünmez (1x1), arkada gerçekten çalar. */}
      <div ref={ytContainerRef} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", overflow: "hidden" }} />

      {/* Üst bar */}
      <div className="shrink-0 px-4 md:px-8 pt-5 pb-3 flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2.5 transition-opacity duration-300 ${isFocusMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <TimerIcon className="w-5 h-5 shrink-0" style={{ color: accent }} strokeWidth={2.25} />
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white whitespace-nowrap">Focus Studio</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Görevler ve Planlar + Spotify / YouTube Music — z-index izole popover'lar
              açar; Odak Modu'nda gizlenir */}
          <div className={`hidden md:flex items-center gap-2 transition-opacity duration-300 ${isFocusMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <button
              onClick={() => setTaskDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-3 h-9 text-[12px] font-bold whitespace-nowrap transition-all"
              style={{ background: `color-mix(in srgb, ${BRAND_ACCENT} 10%, transparent)`, color: BRAND_ACCENT }}
            >
              <ClipboardList className="w-3.5 h-3.5" strokeWidth={2.25} />
              Görevler ve Planlar
            </button>
            <div className="relative">
              <button
                onClick={() => setMusicPopover((v) => (v === "spotify" ? null : "spotify"))}
                className="flex items-center gap-1.5 rounded-full px-3 h-9 text-[12px] font-bold whitespace-nowrap transition-all"
                style={{ background: musicPopover === "spotify" ? "#1DB9541f" : "rgba(var(--overlay-rgb),0.04)", color: "#1DB954" }}
              >
                <Music2 className="w-3.5 h-3.5" strokeWidth={2.25} />
                Spotify
              </button>
              {musicPopover === "spotify" && <SpotifyPopover onClose={() => setMusicPopover(null)} />}
            </div>
            <div className="relative">
              <button
                onClick={() => setMusicPopover((v) => (v === "youtube" ? null : "youtube"))}
                className="flex items-center gap-1.5 rounded-full px-3 h-9 text-[12px] font-bold whitespace-nowrap transition-all"
                style={{ background: musicPopover === "youtube" ? "#FF3B5C1f" : "rgba(var(--overlay-rgb),0.04)", color: "#FF3B5C" }}
              >
                <ListMusic className="w-3.5 h-3.5" strokeWidth={2.25} />
                YouTube Music
              </button>
              {musicPopover === "youtube" && (
                <YoutubePopover
                  onClose={() => setMusicPopover(null)}
                  trackIndex={trackIndex}
                  trackLabel={trackLabel}
                  ytReady={ytReady}
                  ytPlaying={ytPlaying}
                  onTogglePlay={toggleYoutube}
                  onSelectTrack={goToTrack}
                />
              )}
            </div>
          </div>

          {/* Mobilde de Görevler ve Planlar erişimi — üst barda kompakt ikon buton */}
          <button
            onClick={() => setTaskDrawerOpen(true)}
            aria-label="Görevler ve Planlar"
            className={`md:hidden w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
              isFocusMode ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
            }`}
            style={{ background: `color-mix(in srgb, ${BRAND_ACCENT} 10%, transparent)`, color: BRAND_ACCENT }}
          >
            <ClipboardList className="w-4 h-4" strokeWidth={2.25} />
          </button>

          <button
            onClick={() => setIsFocusMode((v) => !v)}
            aria-label="Odak Modu / Işıkları Söndür"
            className={`flex items-center gap-1.5 rounded-full px-4 h-9 text-[12px] font-bold whitespace-nowrap transition-all ${
              isFocusMode ? "text-gray-500 dark:text-white/55" : ""
            }`}
            style={
              isFocusMode
                ? { background: "transparent" }
                : { background: `color-mix(in srgb, ${BRAND_ACCENT} 10%, transparent)`, color: BRAND_ACCENT, boxShadow: `0 0 16px -6px ${BRAND_ACCENT}` }
            }
          >
            💡 {isFocusMode ? "Işıkları Aç" : "Odak Modu"}
          </button>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className={`w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-white/45 dark:hover:text-white bg-black/[0.04] dark:bg-white/[0.04] transition-all duration-300 ${
              isFocusMode ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tek, ortak odak ekranı — mobil ve masaüstünde AYNI. Görev/plan seçimi
          artık gömülü bir panel değil, paylaşılan TaskDrawer (aşağıda). */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-6 py-4">
        <HeroZone {...heroProps} />
      </div>

      <TaskDrawer
        open={taskDrawerOpen}
        userId={userId}
        onClose={() => setTaskDrawerOpen(false)}
        selectedTaskId={selectedTask?.id}
        onSelectTask={setSelectedTask}
      />
    </div>
  );
}
