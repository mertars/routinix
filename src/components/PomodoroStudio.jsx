import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Timer as TimerIcon, Music2, ListMusic, X, ClipboardList } from "lucide-react";
import { tapFeedback } from "../lib/haptics";
import logger from "../utils/logger";
import { logFocusSession } from "../services/rhythmService";
import TaskDrawer from "./TaskDrawer";

const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;
const WORK_STEP = 5;
const BREAK_STEP = 1;

// İki kısa, herkese açık, gömülü oynatım için tasarlanmış Lofi Girl canlı
// yayını — YouTube'un standart Embed iframe'iyle (youtube.com/embed/VIDEO_ID)
// gösterilir, tıpkı Spotify sekmesi gibi kendi native kontrolleriyle.
// ÖNCEDEN gizli bir YT IFrame Player API örneği (script enjeksiyonu +
// play/pause/track-değiştirme JS kontrolü) kullanılıyordu — Spotify sekmesiyle
// AYNI felsefeye (harici API/OAuth YOK, kontrol doğrudan gömülü oynatıcının
// KENDİ arayüzünde) geçildiği için bu karmaşıklık tamamen kaldırıldı.
const YOUTUBE_PRESET_VIDEOS = [
  { id: "5qap5aO4i9A", label: "lofi hip hop radio 📚 beats to relax/study to" },
  { id: "jfKfPfyJRdk", label: "synthwave radio 🌌 beats to chill/game to" },
];
// youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, youtube.com/shorts/ID
// — YouTube video ID'leri her zaman 11 karakter (URL-güvenli base64 alfabesi).
const YOUTUBE_VIDEO_URL_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;
function buildYoutubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`;
}

// Spotify Embed iframe — Spotify Web Playback SDK (Premium hesap + OAuth
// gerektirir) olmadan DIŞARIDAN kontrol (play/pause/skip) mümkün değil; bu
// yüzden Spotify kendi görünür oynatıcısıyla yalnızca panel AÇIKKEN çalışır
// (bkz. MusicSidePanel). Hiçbir Spotify API anahtarı/OAuth KULLANILMAZ —
// yalnızca genel/herkese açık Embed iframe'i (open.spotify.com/embed/...).
//
// Hazır odak çalma listeleri — kullanıcı MusicSidePanel içindeki <select>
// ile aralarında geçiş yapabilir, ya da kendi Spotify çalma listesi linkini
// yapıştırıp (regex ile playlist ID'si ayıklanır) YÜKLEYEBİLİR.
//
// KÖK NEDEN NOTU (bir önceki "Page not found" hatası): iframe src YAPISI
// ZATEN doğruydu (/embed/playlist/ID?utm_source=generator&theme=0) — sorun
// ID'lerdi. Spotify'ın "37i9dQZF1DX..." önekli editöryel/algoritmik çalma
// listesi ID'leri KALICI DEĞİL; Spotify bunları zaman zaman sessizce
// emekliye ayırıp yeniden atıyor. Aşağıdaki 4 ID, embed sayfası doğrudan
// GET edilip yanıtın GERÇEKTEN "Page not found" DEĞİL bir çalma listesi
// döndürdüğü canlı olarak DOĞRULANDI (curl ile open.spotify.com/embed/
// playlist/<id> içindeki "title" alanı kontrol edilerek) — yine de bu
// ID'ler ileride Spotify tarafında tekrar emekliye ayrılabilir; iframe
// gerçekten yeniden "Page not found" gösterirse ilk kontrol noktası BURASI
// olmalı, src string birleştirmesi DEĞİL.
const SPOTIFY_PRESET_PLAYLISTS = [
  { id: "37i9dQZF1DWYoYGBbGKurt", label: "Lo-Fi Beats" },
  { id: "37i9dQZF1DX9sIqqvKsjG8", label: "Deep Focus" },
  { id: "37i9dQZF1DX0SM0LYsmbMT", label: "Jazz Focus" },
  { id: "37i9dQZF1DWU0ScTcjJBdj", label: "Ambient Chill" },
];
const SPOTIFY_PLAYLIST_URL_RE = /playlist\/([a-zA-Z0-9]+)/;
function buildSpotifyEmbedUrl(playlistId) {
  return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
}

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
// Modu'nda (`boost`) glow/kontrast belirgin şekilde artar. Saf/görsel bileşen
// — memo ile sarmalanır ki CountdownDisplay'in HER SANİYE re-render'ı yalnızca
// gerçekten değişen prop'lar (secondsLeft/pct/ringOffset) için tekrar çizsin.
const TimerRing = memo(function TimerRing({ secondsLeft, mode, accent, pct, ringCircumference, ringOffset, boost }) {
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
});

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

// ⏱️ İzole sayaç bileşeni — ticking state'ini TEK BAŞINA taşır (bkz. yukarısı:
// bu sayede "tick" her saniye SADECE bu küçük yaprak bileşeni re-render eder,
// PomodoroStudio'nun geri kalanı saniyede bir yeniden çizilmez). `resetNonce`
// ebeveynin "Sıfırla" tıklamasını bu bileşene iletmenin tek yolu (secondsLeft
// burada yaşadığı için ebeveyn onu doğrudan set edemez). Mod tamamlanınca
// `onModeComplete` ile ebeveyne haber verilir.
//
// Zaman kaynağı Date.now() TABANLI (setInterval'in "her tick'te 1 azalt"
// yaklaşımı DEĞİL): `targetEndRef` çalışmaya başlarken/devam ederken hedef
// BİTİŞ zaman damgasını tutar, her tick (ve her `visibilitychange`) o
// damgadan Date.now() farkını YENİDEN hesaplar. Böylece panel kapansa, sekme
// arka plana alınsa ya da telefon ekranı kilitlense (tarayıcı setInterval'i
// kısıtlayıp/atlasa) bile — geri dönüldüğünde sayaç "donmuş" göstermez,
// gerçekten geçen süre kadar düşmüş olarak devam eder.
const CountdownDisplay = memo(function CountdownDisplay({ mode, workMin, breakMin, running, accent, boost, resetNonce, onModeComplete }) {
  const totalForMode = (mode === "work" ? workMin : breakMin) * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalForMode);
  const targetEndRef = useRef(null);

  useEffect(() => {
    if (!running) {
      setSecondsLeft(totalForMode);
      targetEndRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, workMin, breakMin, resetNonce]);

  useEffect(() => {
    if (!running) return;
    // Başlatılırken/devam ettirilirken (duraklatılmış `secondsLeft`'ten) hedef
    // bitiş zaman damgasını BİR KEZ hesapla — sonraki her tick bu SABİT hedefe
    // göre kalan süreyi yeniden türetir, üst üste biriken bir sayaç DEĞİL.
    if (targetEndRef.current == null) {
      targetEndRef.current = Date.now() + secondsLeft * 1000;
    }
    let intervalId = null;
    const recompute = () => {
      // `targetEndRef` null'a düştüyse bu tick zaten tamamlanmayı tetikledi
      // (ör. interval'in bir sonraki ateşlemesiyle aynı ana denk gelen bir
      // `visibilitychange` olayı) — ikinci kez `onModeComplete` çağırma.
      if (targetEndRef.current == null) return;
      const remaining = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        if (intervalId) clearInterval(intervalId);
        targetEndRef.current = null;
        onModeComplete();
      }
    };
    recompute(); // sekmeye/panele geri dönüşte bir sonraki tick'i beklemeden anında doğru değeri göster
    intervalId = setInterval(recompute, 1000);
    document.addEventListener("visibilitychange", recompute);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", recompute);
      targetEndRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, onModeComplete]);

  const pct = totalForMode > 0 ? Math.max(0, Math.min(100, Math.round((1 - secondsLeft / totalForMode) * 100))) : 0;
  const ringCircumference = 2 * Math.PI * 88;
  const ringOffset = ringCircumference * (1 - pct / 100);

  return <TimerRing secondsLeft={secondsLeft} mode={mode} accent={accent} pct={pct} ringCircumference={ringCircumference} ringOffset={ringOffset} boost={boost} />;
});

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
  resetNonce,
  onModeComplete,
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

      <CountdownDisplay
        mode={mode}
        workMin={workMin}
        breakMin={breakMin}
        running={running}
        accent={accent}
        boost={isFocusMode}
        resetNonce={resetNonce}
        onModeComplete={onModeComplete}
      />

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

// Sağdan kayan büyük müzik paneli — eski küçük Spotify/YouTube popover'larının
// yerine geçti. framer-motion KURULU DEĞİL (package.json'da yok, sırf bu tek
// animasyon için yeni bir bağımlılık eklemek gereksiz) — giriş/çıkış Tailwind
// transition-transform ile yapılıyor. `open` false olduktan PANEL_TRANSITION_MS
// SONRA panel DOM'dan tamamen kaldırılıyor (rendered state) — bu yüzden
// iframe'ler panel GERÇEKTEN kapanınca unmount olur ve müzik durur (Spotify/
// YouTube'un kendi native kontrolleri dışında bir "durdurma" mekanizması yok).
const PANEL_TRANSITION_MS = 300;

function useSlideTransition(open, durationMs = PANEL_TRANSITION_MS) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timeout = setTimeout(() => setRendered(false), durationMs);
    return () => clearTimeout(timeout);
  }, [open, durationMs]);

  return { rendered, visible };
}

const MUSIC_TABS = [
  { key: "spotify", label: "Spotify", tint: "#1DB954", icon: Music2 },
  { key: "youtube", label: "YouTube", tint: "#FF3B5C", icon: ListMusic },
];

// Focus Studio'nun TAMAMI sabit "neon-dark" (bkz. PomodoroStudio yorumu) —
// bu panel de app'in light/dark tema tercihinden BAĞIMSIZ, tek bir koyu
// palet kullanıyor (dark: varyantına gerek yok).
function MusicSidePanel({ open, activeTab, onTabChange, onClose }) {
  const { rendered, visible } = useSlideTransition(open);
  if (!rendered) return null;

  const tint = MUSIC_TABS.find((t) => t.key === activeTab)?.tint || "#06B6D4";

  return (
    <>
      <div
        className={`fixed inset-0 z-[96] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`fixed right-4 top-20 bottom-8 z-[97] w-[420px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out ${
          visible ? "translate-x-0 opacity-100" : "translate-x-24 opacity-0"
        }`}
      >
        {/* Dış kutu — dönen conic-gradient ışıklı kenarlık. İç içerik kutusu
            (p-[2px] boşluk BIRAKARAK) üstüne oturuyor, geriye yalnızca 2px'lik
            dönen bir "ışık halkası" görünür kalıyor. */}
        <div className="relative h-full w-full rounded-[30px] p-[2px] overflow-hidden" style={{ boxShadow: `0 24px 70px -20px ${tint}55` }}>
          <div
            className="absolute motion-safe:animate-[spin_4s_linear_infinite]"
            style={{
              top: "-100%",
              left: "-100%",
              width: "300%",
              height: "300%",
              background: "conic-gradient(from 0deg, #06b6d4, #3b82f6, #00f2fe, #06b6d4)",
            }}
          />
          <div className="relative h-full w-full rounded-[28px] bg-slate-950/90 backdrop-blur-2xl p-6 flex flex-col overflow-hidden">
            {/* Üst başlık: sekmeler + kapat */}
            <div className="shrink-0 flex items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-1 rounded-full p-1 bg-white/5 border border-white/10">
                {MUSIC_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => onTabChange(t.key)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all"
                      style={{ background: active ? `${t.tint}26` : "transparent", color: active ? t.tint : "rgba(255,255,255,0.4)" }}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* İçerik — sekmeye göre; her sekme kendi state'ini (aktif liste/
                video, özel link input'u) TAŞIR, sekme değişince sıfırlanır. */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
              {activeTab === "spotify" ? <SpotifyPanelBody /> : <YoutubePanelBody />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const PANEL_CONTROL_CLASS =
  "rounded-xl px-2.5 py-2 text-[12px] font-semibold bg-white/[0.04] border border-white/10 text-white/80 placeholder:text-white/25 focus:outline-none focus:border-cyan-400/50";

// Spotify sekmesi — resmi Embed iframe'i (kendi play/pause/ilerleme
// çubuğuyla) yalnızca panel AÇIKKEN mount edilir/çalar. Web Playback SDK
// (Premium hesap + OAuth) olmadan dışarıdan kontrol edilemez — bu yüzden
// sahte/çalışmayan bir Oynat/Durdur butonu GÖSTERİLMİYOR, kontrol doğrudan
// Spotify'ın kendi embed arayüzünde yapılıyor.
function SpotifyPanelBody() {
  const [activePlaylistId, setActivePlaylistId] = useState(SPOTIFY_PRESET_PLAYLISTS[0].id);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [customUrlError, setCustomUrlError] = useState(null);
  const isPreset = SPOTIFY_PRESET_PLAYLISTS.some((p) => p.id === activePlaylistId);

  // Hata ayıklama: iframe her yeni activePlaylistId ile render edilmeden
  // hemen önce, oluşan src'nin GERÇEKTEN doğru olduğunu konsolda doğrula
  // (bkz. SPOTIFY_PRESET_PLAYLISTS'in üstündeki KÖK NEDEN NOTU — sorun
  // genelde URL yapısı değil, ölü/emekliye ayrılmış bir playlist ID'si olur).
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("Aktif Spotify URL:", buildSpotifyEmbedUrl(activePlaylistId));
  }, [activePlaylistId]);

  const handleLoadCustomUrl = () => {
    const match = SPOTIFY_PLAYLIST_URL_RE.exec(customUrlInput.trim());
    if (!match) {
      setCustomUrlError("Geçerli bir Spotify çalma listesi linki değil.");
      return;
    }
    setActivePlaylistId(match[1]);
    setCustomUrlError(null);
    setCustomUrlInput("");
    setShowCustomInput(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 mb-3">
        <select
          value={isPreset ? activePlaylistId : "custom"}
          onChange={(e) => setActivePlaylistId(e.target.value)}
          aria-label="Hazır çalma listesi seç"
          className={`flex-1 min-w-0 ${PANEL_CONTROL_CLASS}`}
        >
          {!isPreset && (
            <option value="custom" disabled>
              Özel Liste
            </option>
          )}
          {SPOTIFY_PRESET_PLAYLISTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setShowCustomInput((v) => !v);
            setCustomUrlError(null);
          }}
          className={`shrink-0 whitespace-nowrap transition-colors hover:bg-white/[0.08] ${PANEL_CONTROL_CLASS}`}
        >
          {showCustomInput ? "Vazgeç" : "+ Kendi Linkini Ekle"}
        </button>
      </div>

      {showCustomInput && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customUrlInput}
              onChange={(e) => {
                setCustomUrlInput(e.target.value);
                setCustomUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLoadCustomUrl();
              }}
              placeholder="https://open.spotify.com/playlist/..."
              className={`flex-1 min-w-0 ${PANEL_CONTROL_CLASS}`}
            />
            <button
              onClick={handleLoadCustomUrl}
              className="shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-bold transition-colors bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
            >
              Yükle
            </button>
          </div>
          {customUrlError && <p className="mt-1.5 text-[11px] text-rose-400">{customUrlError}</p>}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden border border-emerald-500/20">
        <iframe
          key={activePlaylistId}
          title="Spotify Player"
          src={buildSpotifyEmbedUrl(activePlaylistId)}
          width="100%"
          height="450"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
        Spotify'ın kendi oynatıcısı — kontrolü doğrudan burada yap. Bu paneli kapatman müziği durdurur.
      </p>
    </div>
  );
}

// YouTube sekmesi — Spotify İLE AYNI felsefe: standart Embed iframe
// (youtube.com/embed/VIDEO_ID), kontrol doğrudan YouTube'un kendi native
// arayüzünde. Hazır video listesi + kullanıcının kendi video linkini
// yapıştırıp yükleyebildiği bir alan sunar.
function YoutubePanelBody() {
  const [activeVideoId, setActiveVideoId] = useState(YOUTUBE_PRESET_VIDEOS[0].id);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [customUrlError, setCustomUrlError] = useState(null);
  const isPreset = YOUTUBE_PRESET_VIDEOS.some((v) => v.id === activeVideoId);

  const handleLoadCustomUrl = () => {
    const match = YOUTUBE_VIDEO_URL_RE.exec(customUrlInput.trim());
    if (!match) {
      setCustomUrlError("Geçerli bir YouTube video linki değil.");
      return;
    }
    setActiveVideoId(match[1]);
    setCustomUrlError(null);
    setCustomUrlInput("");
    setShowCustomInput(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 mb-3">
        <select
          value={isPreset ? activeVideoId : "custom"}
          onChange={(e) => setActiveVideoId(e.target.value)}
          aria-label="Hazır video seç"
          className={`flex-1 min-w-0 ${PANEL_CONTROL_CLASS}`}
        >
          {!isPreset && (
            <option value="custom" disabled>
              Özel Video
            </option>
          )}
          {YOUTUBE_PRESET_VIDEOS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setShowCustomInput((v) => !v);
            setCustomUrlError(null);
          }}
          className={`shrink-0 whitespace-nowrap transition-colors hover:bg-white/[0.08] ${PANEL_CONTROL_CLASS}`}
        >
          {showCustomInput ? "Vazgeç" : "+ Kendi Linkini Ekle"}
        </button>
      </div>

      {showCustomInput && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customUrlInput}
              onChange={(e) => {
                setCustomUrlInput(e.target.value);
                setCustomUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLoadCustomUrl();
              }}
              placeholder="https://youtube.com/watch?v=..."
              className={`flex-1 min-w-0 ${PANEL_CONTROL_CLASS}`}
            />
            <button
              onClick={handleLoadCustomUrl}
              className="shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-bold transition-colors bg-[#FF3B5C]/15 border border-[#FF3B5C]/30 text-[#FF3B5C] hover:bg-[#FF3B5C]/25"
            >
              Yükle
            </button>
          </div>
          {customUrlError && <p className="mt-1.5 text-[11px] text-rose-400">{customUrlError}</p>}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden border border-[#FF3B5C]/20">
        <iframe
          key={activeVideoId}
          title="YouTube Player"
          src={buildYoutubeEmbedUrl(activeVideoId)}
          width="100%"
          height="300"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
        YouTube'un kendi oynatıcısı — kontrolü doğrudan burada yap. Bu paneli kapatman müziği durdurur.
      </p>
    </div>
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
// Spotify/YouTube butonlarının açtığı sağdan kayan MusicSidePanel'den kontrol edilir.
export default function PomodoroStudio({ open, userId, initialTask, onClose }) {
  const [mode, setMode] = useState("work"); // "work" | "break"
  const [workMin, setWorkMin] = useState(DEFAULT_WORK_MIN);
  const [breakMin, setBreakMin] = useState(DEFAULT_BREAK_MIN);
  const [running, setRunning] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [musicPanelOpen, setMusicPanelOpen] = useState(false);
  const [musicTab, setMusicTab] = useState("spotify"); // "spotify" | "youtube"

  // Süre bittiğinde CountdownDisplay tarafından çağrılır — mod/running
  // değişimi burada, PomodoroStudio'nun (nadiren re-render olan) state'inde
  // kalır; yeni mod'un süresi CountdownDisplay'in kendi mode-izleme efektiyle
  // otomatik ayarlanır. (Diğer hook'larla birlikte, olası bir erken return'ün
  // ÜSTÜNDE tanımlı — aksi halde Studio kapalıyken bu hook hiç çağrılmaz ve
  // açılışta React'in hook sırası kuralını ihlal eder.)
  const handleModeComplete = useCallback(() => {
    tapFeedback([40, 60, 40]);
    // Yalnızca TAM tamamlanan (sıfıra inen, yarıda bırakılmayan) bir "work"
    // aralığı bir odak seansı olarak kaydedilir — "Rhythm & Insights"
    // modülündeki Derin Odak Hacmi/Pik Verimlilik grafiklerinin tek gerçek
    // veri kaynağı budur. Kayıt boşta kalan ana thread'i BLOKLAMAZ (fire-
    // and-forget, hata olursa kullanıcının akışı kesilmez, yalnızca loglanır).
    // `startedAt` gerçek saatten `workMin` çıkarılarak yaklaşık hesaplanır —
    // aradaki olası duraklatmalar (Date.now() tabanlı sayaç sayesinde) TOPLAM
    // sayılan süreyi etkilemez, yalnızca duvar saatindeki "başlangıç anı"
    // tahminidir.
    if (mode === "work" && userId) {
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - workMin * 60000);
      logFocusSession({
        userId,
        taskId: selectedTask?.id ?? null,
        planId: selectedTask?.plan_id ?? null,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMin: workMin,
      }).catch((err) => logger.warn("POMODORO", "Odak seansı kaydedilemedi", { error: err?.message }));
    }
    setMode((m) => (m === "work" ? "break" : "work"));
    setRunning(false);
  }, [mode, workMin, userId, selectedTask]);

  // Görev kartındaki "Başlat" ile açılmışsa (initialTask — tam görev objesi,
  // ayrı bir fetch gerekmez), o görevi otomatik olarak Aktif Görev yapar.
  useEffect(() => {
    if (open && initialTask) setSelectedTask(initialTask);
  }, [open, initialTask]);

  const accent = ACCENT[mode];

  const adjustDuration = (field, delta) => {
    if (running) return;
    if (field === "work") setWorkMin((m) => Math.min(90, Math.max(5, m + delta)));
    else setBreakMin((m) => Math.min(30, Math.max(1, m + delta)));
  };

  const toggleRunning = () => setRunning((r) => !r);

  // secondsLeft artık CountdownDisplay'in kendi state'i olduğu için ebeveyn
  // onu doğrudan set edemez — resetNonce'u artırmak "sıfırla" sinyalini
  // aşağıdaki isolated bileşene iletir (bkz. CountdownDisplay'in reset efekti).
  const resetTimer = () => {
    setRunning(false);
    setResetNonce((n) => n + 1);
  };

  const switchMode = (nextMode) => {
    if (running || nextMode === mode) return;
    setMode(nextMode);
  };

  // Aynı sekmenin butonuna panel AÇIKKEN tekrar basmak paneli kapatır (eski
  // popover'ların toggle davranışıyla AYNI); farklı bir sekmeye basmak panel
  // açıksa sadece sekme değiştirir, kapalıysa o sekmeyle açar.
  const openMusicTab = (tab) => {
    if (musicPanelOpen && musicTab === tab) {
      setMusicPanelOpen(false);
    } else {
      setMusicTab(tab);
      setMusicPanelOpen(true);
    }
  };

  const heroProps = {
    mode,
    switchMode,
    running,
    resetNonce,
    onModeComplete: handleModeComplete,
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

  // NOT: `open` false iken artık `return null` YAPILMIYOR — CountdownDisplay
  // (sayaç state'inin sahibi) bu ağacın bir parçası olduğundan, erken return
  // onu her kapatışta unmount edip sıfırlardı. Bunun yerine `display:none`
  // ile tamamen görünmez/etkileşimsiz yapılır — DOM bir kez kurulur, tarayıcı
  // gizliyken layout/paint maliyeti yaklaşık sıfırdır. CountdownDisplay artık
  // Date.now() tabanlı hedef bitiş zaman damgasıyla çalıştığından, Studio
  // kapalıyken/sekme arka plandayken/telefon kilitliyken de `running` true
  // kaldığı sürece GERÇEK ZAMANDA saymaya devam eder — geri dönüldüğünde
  // kaldığı yerde "donmuş" değil, gerçekten geçen süre kadar düşmüş görünür.
  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col transition-colors duration-700"
      style={{ display: open ? "flex" : "none", background: isFocusMode ? "var(--pomo-bg-focus)" : "var(--pomo-bg)" }}
    >
      {/* Üst bar */}
      <div className="shrink-0 px-4 md:px-8 pt-5 pb-3 flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2.5 transition-opacity duration-300 ${isFocusMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <TimerIcon className="w-5 h-5 shrink-0" style={{ color: accent }} strokeWidth={2.25} />
          <h2 className="text-[17px] font-bold text-gray-900 dark:text-white whitespace-nowrap">Focus Studio</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Görevler ve Planlar + Spotify / YouTube — Odak Modu'nda gizlenir.
              Müzik butonları artık küçük bir popover DEĞİL, tek bir sağdan
              kayan MusicSidePanel'i (aşağıda, bu div'in DIŞINDA render edilir
              — sabit/fixed konumlandığı için bir buton'a "relative" ile
              bağlı olmasına gerek yok) sekme seçili şekilde açar. */}
          <div className={`hidden md:flex items-center gap-2 transition-opacity duration-300 ${isFocusMode ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <button
              onClick={() => setTaskDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-3 h-9 text-[12px] font-bold whitespace-nowrap transition-all"
              style={{ background: `color-mix(in srgb, ${BRAND_ACCENT} 10%, transparent)`, color: BRAND_ACCENT }}
            >
              <ClipboardList className="w-3.5 h-3.5" strokeWidth={2.25} />
              Görevler ve Planlar
            </button>
            <button
              onClick={() => openMusicTab("spotify")}
              className="flex items-center gap-1.5 rounded-full px-3 h-9 text-[12px] font-bold whitespace-nowrap transition-all"
              style={{ background: musicPanelOpen && musicTab === "spotify" ? "#1DB9541f" : "rgba(var(--overlay-rgb),0.04)", color: "#1DB954" }}
            >
              <Music2 className="w-3.5 h-3.5" strokeWidth={2.25} />
              Spotify
            </button>
            <button
              onClick={() => openMusicTab("youtube")}
              className="flex items-center gap-1.5 rounded-full px-3 h-9 text-[12px] font-bold whitespace-nowrap transition-all"
              style={{ background: musicPanelOpen && musicTab === "youtube" ? "#FF3B5C1f" : "rgba(var(--overlay-rgb),0.04)", color: "#FF3B5C" }}
            >
              <ListMusic className="w-3.5 h-3.5" strokeWidth={2.25} />
              YouTube
            </button>
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

      <MusicSidePanel open={musicPanelOpen} activeTab={musicTab} onTabChange={setMusicTab} onClose={() => setMusicPanelOpen(false)} />
    </div>
  );
}
