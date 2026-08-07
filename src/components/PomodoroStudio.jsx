import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Timer as TimerIcon, ClipboardList, Music2, ListMusic, X } from "lucide-react";
import { tapFeedback } from "../lib/haptics";
import logger from "../utils/logger";
import { logFocusSession } from "../services/rhythmService";
import { useMusic } from "../context/MusicContext";
import TaskDrawer from "./TaskDrawer";
import FocusMusicControlCard from "./FocusMusicControlCard";

const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;
const WORK_STEP = 5;
const BREAK_STEP = 1;

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

      {/* Müzik kontrol kartı — Odak Modu'nda BİLE gizlenmez (diğer "ekstra"
          UI'ların aksine): müzik, tam da minimal/dikkat dağıtmayan Odak
          Modu'nda en çok işe yarayan kontrol — kullanıcı burada kalmaya
          devam etsin diye ayrı bir panele gitmesine gerek KALMASIN. */}
      <div className="pt-6 w-full flex justify-center">
        <FocusMusicControlCard />
      </div>
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
// Spotify/YouTube butonlarının açtığı GLOBAL müzik panelinden kontrol edilir
// (bkz. GlobalMusicPlayer.jsx/MusicContext.jsx — panel/oynatıcı artık BU
// bileşenin İÇİNDE DEĞİL, App kökünde YAŞIYOR; Focus Studio kapansa/açılsa
// da müzik KESİNTİYE UĞRAMAZ).
export default function PomodoroStudio({ open, userId, initialTask, onClose }) {
  const [mode, setMode] = useState("work"); // "work" | "break"
  const [workMin, setWorkMin] = useState(DEFAULT_WORK_MIN);
  const [breakMin, setBreakMin] = useState(DEFAULT_BREAK_MIN);
  const [running, setRunning] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const music = useMusic();

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
  // Aynı sekmenin butonuna panel AÇIKKEN tekrar basmak paneli kapatır (eski
  // toggle davranışıyla AYNI); farklı bir sekmeye basmak panel açıksa sadece
  // sekme değiştirir, kapalıysa o sekmeyle açar. Gerçek state artık global
  // MusicContext'te (bkz. music.openPanel/music.closePanel).
  const openMusicTab = (tab) => {
    if (music.panelOpen && music.activeTab === tab) music.closePanel();
    else music.openPanel(tab);
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
              Müzik butonları GlobalMusicPlayer.jsx'i (App kökünde, bu
              bileşenin DIŞINDA render edilir — sabit/fixed konumlandığı için
              bir buton'a "relative" ile bağlı olmasına gerek yok) doğru
              sekmeyle açar/kapatır; gerçek panel/oynatıcı state'i global
              MusicContext'te YAŞAR, Focus Studio kapansa da kaybolmaz. */}
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
              style={{ background: music.panelOpen && music.activeTab === "spotify" ? "#1DB9541f" : "rgba(var(--overlay-rgb),0.04)", color: "#1DB954" }}
            >
              <Music2 className="w-3.5 h-3.5" strokeWidth={2.25} />
              Spotify
            </button>
            <button
              onClick={() => openMusicTab("youtube")}
              className="flex items-center gap-1.5 rounded-full px-3 h-9 text-[12px] font-bold whitespace-nowrap transition-all"
              style={{ background: music.panelOpen && music.activeTab === "youtube" ? "#FF3B5C1f" : "rgba(var(--overlay-rgb),0.04)", color: "#FF3B5C" }}
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
    </div>
  );
}
