import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Timer as TimerIcon, Music2, ListMusic, Play, Pause, X, ClipboardList } from "lucide-react";
import { tapFeedback } from "../lib/haptics";
import logger from "../utils/logger";
import { logFocusSession } from "../services/rhythmService";
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

// Spotify Embed iframe — Spotify Web Playback SDK (Premium hesap + OAuth
// gerektirir) olmadan DIŞARIDAN kontrol (play/pause/skip) mümkün değil; bu
// yüzden Spotify kendi görünür oynatıcısıyla yalnızca popover AÇIKKEN çalışır
// (bkz. SpotifyPopover). Hiçbir Spotify API anahtarı/OAuth KULLANILMAZ —
// yalnızca genel/herkese açık Embed iframe'i (open.spotify.com/embed/...).
//
// Hazır odak çalma listeleri — kullanıcı SpotifyPopover içindeki <select>
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
//
// Hazır listeler arası geçiş (<select>) + kullanıcının kendi çalma listesi
// linkini yapıştırıp yükleyebildiği bir alan sunar — HİÇBİR Spotify API
// anahtarı/OAuth kullanılmaz, yalnızca herkese açık Embed iframe'i.
function SpotifyPopover({ onClose }) {
  const [activePlaylistId, setActivePlaylistId] = useState(SPOTIFY_PRESET_PLAYLISTS[0].id);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [customUrlError, setCustomUrlError] = useState(null);

  // Hata ayıklama: iframe her yeni activePlaylistId ile render edilmeden
  // hemen önce, oluşan src'nin GERÇEKTEN doğru olduğunu konsolda doğrula
  // (bkz. yukarıdaki KÖK NEDEN NOTU — sorun genelde URL yapısı değil, ölü/
  // emekliye ayrılmış bir playlist ID'si olur).
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("Aktif Spotify URL:", buildSpotifyEmbedUrl(activePlaylistId));
  }, [activePlaylistId]);
  const isPreset = SPOTIFY_PRESET_PLAYLISTS.some((p) => p.id === activePlaylistId);

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
    <MusicPopoverShell onClose={onClose} title="🎧 Spotify — Odak Modu" tint="#1DB954">
      <div className="flex items-center gap-1.5 mb-2.5">
        <select
          value={isPreset ? activePlaylistId : "custom"}
          onChange={(e) => setActivePlaylistId(e.target.value)}
          aria-label="Hazır çalma listesi seç"
          className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold bg-slate-100 dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-emerald-500/60"
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
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold whitespace-nowrap transition-colors bg-slate-100 dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
        >
          {showCustomInput ? "Vazgeç" : "+ Kendi Linkini Ekle"}
        </button>
      </div>

      {showCustomInput && (
        <div className="mb-2.5">
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
              className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[11px] bg-slate-100 dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 text-gray-700 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-emerald-500/60"
            />
            <button
              onClick={handleLoadCustomUrl}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
            >
              Yükle
            </button>
          </div>
          {customUrlError && <p className="mt-1.5 text-[10.5px] text-rose-500">{customUrlError}</p>}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-emerald-500/20 dark:border-emerald-500/30">
        <iframe
          key={activePlaylistId}
          title="Spotify Player"
          src={buildSpotifyEmbedUrl(activePlaylistId)}
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
  const [running, setRunning] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
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

  const accent = ACCENT[mode];
  const trackLabel = ytTitle || PLAYLIST[trackIndex].label;

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
