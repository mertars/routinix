import { useState, useRef, useEffect } from "react";
import { Plus, X, Play, Pause, RotateCcw, Minus, Music2, Clapperboard, Image as ImageIcon, Trash2 } from "lucide-react";
import WidgetPicker from "./WidgetPicker";
import PopoverPortal from "./PopoverPortal";
import {
  getWidgetDef,
  createWidget,
  formatClockTime,
  newWidgetId,
  DIFFICULTY_LEVELS,
  DIFFICULTY_STYLE,
  SPOTIFY_PLAYLIST_URL_RE,
  YOUTUBE_VIDEO_URL_RE,
} from "../utils/taskWidgets";

const CYAN = "#06B6D4";
const EMERALD = "#10B981";
const EXIT_MS = 160;

// Görev kartının Dinamik Widget Motoru — İKİ ayrı, bağımsız-render edilen
// parça olarak dışa verilir (TEK bir bileşen DEĞİL):
//   - WidgetAddButton: küçük, ikon-yalnız "+" tetikleyici — TaskCard.jsx'in
//     ANA satırında, görev başlığının yanında yaşar (bkz. spesifikasyon).
//   - WidgetList: eklenmiş widget'ların pill/kart satırı — ana satırın
//     ALTINDA, tam genişlikte (medya gömme/alt liste gibi geniş widget'lar
//     başlık sütununa SIĞMAZ).
// Bu ayrım BİLEREK yapıldı: TaskCard.jsx, mobilde FPS için özel bir memo
// karşılaştırıcısıyla YALITILMIŞ (bkz. o dosyanın altındaki yorum) — hover
// durumu gibi sık değişen bir state'i doğrudan TaskCard'a eklemek TÜM satırı
// gereksiz yeniden render ederdi; bunun yerine hover/picker state'i bu KÜÇÜK
// alt bileşenlerin İÇİNDE İZOLE tutulur.
//
// Kendi "widgets" verisi TAŞIMAZ — `widgets` (bkz. task.widgets) ve
// `onChange(nextArray)`/`onAdd(widget)` dışarıdan (TaskCard.jsx) gelir; o da
// bunu usePlanStudio.updateTaskWidgets'a bağlar (lokal-önce/DB-sonra desen,
// checkbox İLE AYNI).
//
// ANİMASYON NOTU: framer-motion projede KURULU DEĞİL (bu oturumda daha önce
// Spotify paneli için de aynı gerekçeyle Tailwind'e gidildi) — giriş/çıkış
// mikro-animasyonları salt CSS transition ile yapılıyor (bkz. WidgetShell'in
// "removing" state'i: silme, DOM'dan ANINDA değil, küçülme/solma geçişi
// bittikten SONRA kaldırır).
export function WidgetAddButton({ onAdd }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const buttonRef = useRef(null);

  // "/" tetikleyicisi — YALNIZCA bu buton üzerindeyken (bkz. spesifikasyon:
  // "+Widget Ekle tıklandığında VEYA / yazıldığında"). Global bir tuş
  // dinleyicisi TÜM kartlarda aynı anda tepki vermesin diye `hovered` ile
  // kapı tutulur; sayfada başka bir yerde (ör. bir metin girdisinde) "/"
  // yazan kullanıcıyı ETKİLEMEZ.
  useEffect(() => {
    if (!hovered) return;
    function onKeyDown(e) {
      if (e.key !== "/" || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      setPickerOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hovered]);

  return (
    <span className="relative inline-flex shrink-0" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setPickerOpen((v) => !v);
        }}
        aria-label="Widget ekle"
        title="Widget ekle (/)"
        className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
        style={{ background: "rgba(6,182,212,0.14)", color: CYAN }}
      >
        <Plus className="w-3 h-3" strokeWidth={2.5} />
      </button>
      <WidgetPicker
        anchorRef={buttonRef}
        open={pickerOpen}
        onPick={(type) => {
          const widget = createWidget(type);
          if (widget) onAdd(widget);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </span>
  );
}

export function WidgetList({ widgets, onChange }) {
  const list = widgets || [];
  if (list.length === 0) return null;

  const updateWidget = (id, nextValue) => {
    onChange(list.map((w) => (w.id === id ? { ...w, value: nextValue } : w)));
  };
  const removeWidget = (id) => {
    onChange(list.filter((w) => w.id !== id));
  };

  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {list.map((w) => (
        <WidgetShell key={w.id} onRemove={() => removeWidget(w.id)}>
          <WidgetRenderer widget={w} onUpdate={(v) => updateWidget(w.id, v)} />
        </WidgetShell>
      ))}
    </div>
  );
}

// Giriş/çıkış geçişi + kaldırma butonu sağlayan paylaşılan kabuk. `isCard`
// (media/checklist/note gibi geniş içerikler) TAM GENİŞLİK bir blok olarak,
// diğerleri (pill/mini-satır) satır içi bir öge olarak akar.
function WidgetShell({ children, onRemove }) {
  const [entered, setEntered] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(onRemove, EXIT_MS);
  };

  return (
    <div
      className="relative group transition-all ease-out"
      style={{
        transitionDuration: `${EXIT_MS}ms`,
        opacity: entered && !removing ? 1 : 0,
        transform: entered && !removing ? "scale(1)" : "scale(0.85)",
      }}
    >
      {children}
      <button
        onClick={handleRemove}
        aria-label="Widget'ı kaldır"
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "#FF6E92", color: "#0A0E13" }}
      >
        <X className="w-2.5 h-2.5" strokeWidth={3} />
      </button>
    </div>
  );
}

function WidgetRenderer({ widget, onUpdate }) {
  const def = getWidgetDef(widget.type);
  if (!def) return null;
  const Renderer = RENDERERS[widget.type];
  if (!Renderer) return null;
  return <Renderer value={widget.value} onUpdate={onUpdate} def={def} />;
}

// ---------------------------------------------------------------------
// Paylaşılan pill + tıklayınca açılan mini düzenleme popover'ı — Saat
// Aralığı/Kalori/Set-Tekrar İÇİN ORTAK kabuk.
// ---------------------------------------------------------------------
function EditablePill({ icon: Icon, label, tint = EMERALD, children }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  return (
    <div className="inline-block">
      <button
        ref={anchorRef}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition-colors"
        style={{ background: `${tint}1F`, color: tint }}
      >
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </button>
      <PopoverPortal
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        className="rounded-xl p-2.5 flex flex-col gap-2 w-[220px]"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", boxShadow: "0 16px 32px -16px rgba(0,0,0,0.5)" }}
      >
        {children}
      </PopoverPortal>
    </div>
  );
}

const numInputClass = "w-full rounded-lg px-2 py-1 text-[11.5px] font-semibold focus:outline-none";
const numInputStyle = { background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-primary)", border: "1px solid var(--border-default)" };

// ---- Zaman: Saat Aralığı ----
function TimeRangeWidget({ value, onUpdate }) {
  const { start, end } = value || {};
  return (
    <EditablePill icon={null} label={`🕐 ${start || "--:--"}–${end || "--:--"}`} tint={CYAN}>
      <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
        Başlangıç
      </label>
      <input type="time" value={start || ""} onChange={(e) => onUpdate({ ...value, start: e.target.value })} className={numInputClass} style={numInputStyle} />
      <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
        Bitiş
      </label>
      <input type="time" value={end || ""} onChange={(e) => onUpdate({ ...value, end: e.target.value })} className={numInputClass} style={numInputStyle} />
    </EditablePill>
  );
}

// ---- Zaman: Kronometre — YALNIZCA duraklatılmış toplam süre kalıcılaşır;
// "running" TAMAMEN yerel (bkz. taskWidgets.js dosya başı notu). ----
function TimerWidget({ value, onUpdate }) {
  const [running, setRunning] = useState(false);
  const [displaySec, setDisplaySec] = useState(value?.elapsedSec || 0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - displaySec * 1000;
    const id = setInterval(() => setDisplaySec((Date.now() - startRef.current) / 1000), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const toggle = () => {
    if (running) {
      onUpdate({ elapsedSec: Math.round(displaySec) });
    }
    setRunning((r) => !r);
  };
  const reset = () => {
    setRunning(false);
    setDisplaySec(0);
    onUpdate({ elapsedSec: 0 });
  };

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1" style={{ background: `${CYAN}1F` }}>
      <span className="text-[11.5px] font-bold tabular-nums" style={{ color: CYAN }}>
        {formatClockTime(displaySec)}
      </span>
      <button onClick={toggle} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: CYAN, color: "#04120C" }}>
        {running ? <Pause className="w-3 h-3" fill="currentColor" /> : <Play className="w-3 h-3 ml-0.5" fill="currentColor" />}
      </button>
      <button onClick={reset} aria-label="Sıfırla" className="w-6 h-6 rounded-full flex items-center justify-center" style={{ color: CYAN }}>
        <RotateCcw className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---- Metrik: Sayı Sayacı ----
function CounterWidget({ value, onUpdate }) {
  const { label, current = 0, target } = value || {};
  return (
    <div className="inline-flex items-center gap-2 rounded-full pl-3 pr-1.5 py-1" style={{ background: `${EMERALD}1F` }}>
      <span className="text-[11px] font-bold" style={{ color: EMERALD }}>
        {label}: {current}
        {target ? `/${target}` : ""}
      </span>
      <button onClick={() => onUpdate({ ...value, current: Math.max(0, current - 1) })} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(var(--overlay-rgb),0.08)", color: EMERALD }}>
        <Minus className="w-3 h-3" />
      </button>
      <button onClick={() => onUpdate({ ...value, current: current + 1 })} className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: EMERALD, color: "#04120C" }}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---- Metrik: Oyun Skoru (Galibiyet/Mağlubiyet) ----
function GameScoreWidget({ value, onUpdate }) {
  const v = value || {};
  const wins = v.wins || 0;
  const losses = v.losses || 0;
  return (
    <EditablePill label={`🎮 ${wins}G / ${losses}M`} tint="#B26BFF">
      {[
        ["wins", "Galibiyet"],
        ["losses", "Mağlubiyet"],
      ].map(([key, lbl]) => (
        <div key={key}>
          <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            {lbl}
          </label>
          <input
            type="number"
            min="0"
            value={v[key] ?? 0}
            onChange={(e) => onUpdate({ ...v, [key]: Number(e.target.value) || 0 })}
            className={numInputClass}
            style={numInputStyle}
          />
        </div>
      ))}
    </EditablePill>
  );
}

// ---- Metrik: Kalori / Makro ----
function CalorieWidget({ value, onUpdate }) {
  const v = value || {};
  return (
    <EditablePill label={`🔥 ${v.kcal || 0} kcal`} tint="#FF9F43">
      {[
        ["kcal", "Kalori"],
        ["protein", "Protein (g)"],
        ["carbs", "Karbonhidrat (g)"],
        ["fat", "Yağ (g)"],
      ].map(([key, lbl]) => (
        <div key={key}>
          <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            {lbl}
          </label>
          <input
            type="number"
            min="0"
            value={v[key] ?? 0}
            onChange={(e) => onUpdate({ ...v, [key]: Number(e.target.value) || 0 })}
            className={numInputClass}
            style={numInputStyle}
          />
        </div>
      ))}
    </EditablePill>
  );
}

// ---- Metrik: Set / Tekrar ----
function SetsRepsWidget({ value, onUpdate }) {
  const v = value || {};
  const label = `💪 ${v.sets || 0}×${v.reps || 0}${v.weightKg ? ` @${v.weightKg}kg` : ""}`;
  return (
    <EditablePill label={label} tint={EMERALD}>
      {[
        ["sets", "Set"],
        ["reps", "Tekrar"],
        ["weightKg", "Ağırlık (kg, opsiyonel)"],
      ].map(([key, lbl]) => (
        <div key={key}>
          <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            {lbl}
          </label>
          <input
            type="number"
            min="0"
            value={v[key] ?? ""}
            onChange={(e) => onUpdate({ ...v, [key]: e.target.value === "" ? null : Number(e.target.value) })}
            className={numInputClass}
            style={numInputStyle}
          />
        </div>
      ))}
    </EditablePill>
  );
}

// ---- Organizasyon: Zorluk Seviyesi ----
function DifficultyWidget({ value, onUpdate }) {
  const level = value?.level || "Orta";
  return (
    <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: "rgba(var(--overlay-rgb),0.05)" }}>
      {DIFFICULTY_LEVELS.map((l) => {
        const active = l === level;
        const style = DIFFICULTY_STYLE[l];
        return (
          <button
            key={l}
            onClick={() => onUpdate({ level: l })}
            className="rounded-full px-2 py-1 text-[10.5px] font-bold transition-all"
            style={{ background: active ? style.bg : "transparent", color: active ? style.color : "var(--text-faint)" }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

// ---- Medya: ortak "URL yapıştır" kabuğu (Spotify/YouTube/Görsel paylaşır) ----
function MediaUrlCard({ icon: Icon, tint, placeholder, url, onSetUrl, children }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);

  if (url) return children;

  return (
    <div className="relative w-[260px] max-w-full">
      <div className="rounded-xl p-2.5 flex items-center gap-2" style={{ background: "rgba(var(--overlay-rgb),0.04)", border: `1px dashed ${tint}55` }}>
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: tint }} />
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && onSetUrl(input, setError)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-[11.5px] focus:outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        <button onClick={() => onSetUrl(input, setError)} className="shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] font-bold" style={{ background: `${tint}22`, color: tint }}>
          Yükle
        </button>
      </div>
      {error && <p className="absolute top-full left-0 mt-1 text-[10px] text-rose-400">{error}</p>}
    </div>
  );
}

function SpotifyEmbedWidget({ value, onUpdate }) {
  const embedId = value?.url ? (SPOTIFY_PLAYLIST_URL_RE.exec(value.url) || [])[1] : null;
  return (
    <MediaUrlCard
      icon={Music2}
      tint="#1DB954"
      placeholder="https://open.spotify.com/playlist/..."
      url={embedId}
      onSetUrl={(input, setError) => {
        const match = SPOTIFY_PLAYLIST_URL_RE.exec(input.trim());
        if (!match) return setError("Geçerli bir Spotify çalma listesi linki değil.");
        onUpdate({ url: input.trim() });
      }}
    >
      <div className="w-[280px] max-w-full rounded-xl overflow-hidden border" style={{ borderColor: "#1DB95455" }}>
        <div className="flex items-center justify-between px-2 py-1" style={{ background: "#1DB95422" }}>
          <span className="text-[10px] font-bold" style={{ color: "#1DB954" }}>
            SPOTIFY
          </span>
          <button onClick={() => onUpdate({ url: "" })} className="text-[10px] font-semibold" style={{ color: "var(--text-faint)" }}>
            Kaldır
          </button>
        </div>
        <iframe title="Spotify" src={`https://open.spotify.com/embed/playlist/${embedId}?utm_source=generator&theme=0`} width="100%" height="152" frameBorder="0" allow="encrypted-media" loading="lazy" />
      </div>
    </MediaUrlCard>
  );
}

function YoutubeEmbedWidget({ value, onUpdate }) {
  const embedId = value?.url ? (YOUTUBE_VIDEO_URL_RE.exec(value.url) || [])[1] : null;
  return (
    <MediaUrlCard
      icon={Clapperboard}
      tint="#FF3B5C"
      placeholder="https://youtube.com/watch?v=..."
      url={embedId}
      onSetUrl={(input, setError) => {
        const match = YOUTUBE_VIDEO_URL_RE.exec(input.trim());
        if (!match) return setError("Geçerli bir YouTube video linki değil.");
        onUpdate({ url: input.trim() });
      }}
    >
      <div className="w-[280px] max-w-full rounded-xl overflow-hidden border" style={{ borderColor: "#FF3B5C55" }}>
        <div className="flex items-center justify-between px-2 py-1" style={{ background: "#FF3B5C22" }}>
          <span className="text-[10px] font-bold" style={{ color: "#FF3B5C" }}>
            YOUTUBE
          </span>
          <button onClick={() => onUpdate({ url: "" })} className="text-[10px] font-semibold" style={{ color: "var(--text-faint)" }}>
            Kaldır
          </button>
        </div>
        <iframe title="YouTube" src={`https://www.youtube.com/embed/${embedId}`} width="100%" height="158" frameBorder="0" allow="encrypted-media" loading="lazy" allowFullScreen />
      </div>
    </MediaUrlCard>
  );
}

function ImageWidget({ value, onUpdate }) {
  const [broken, setBroken] = useState(false);
  return (
    <MediaUrlCard
      icon={ImageIcon}
      tint={EMERALD}
      placeholder="Görsel URL'si yapıştır..."
      url={value?.url && !broken ? value.url : null}
      onSetUrl={(input, setError) => {
        if (!/^https?:\/\//.test(input.trim())) return setError("Geçerli bir görsel linki değil.");
        setBroken(false);
        onUpdate({ url: input.trim() });
      }}
    >
      <div className="relative w-[200px] max-w-full rounded-xl overflow-hidden">
        <img src={value?.url} alt="" className="w-full h-auto max-h-[180px] object-cover" onError={() => setBroken(true)} />
        <button onClick={() => onUpdate({ url: "" })} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </MediaUrlCard>
  );
}

// ---- Organizasyon: Alt Liste ----
function ChecklistWidget({ value, onUpdate }) {
  const items = value?.items || [];
  const [draft, setDraft] = useState("");
  const doneCount = items.filter((i) => i.done).length;

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    onUpdate({ items: [...items, { id: newWidgetId(), text, done: false }] });
    setDraft("");
  };

  return (
    <div className="w-[240px] max-w-full rounded-xl p-2.5 flex flex-col gap-1.5" style={{ background: "rgba(var(--overlay-rgb),0.04)", border: "1px solid var(--border-default)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
        Alt Liste {items.length > 0 && `(${doneCount}/${items.length})`}
      </p>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <button
            onClick={() => onUpdate({ items: items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) })}
            className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px] shrink-0"
            style={{ borderColor: item.done ? EMERALD : "var(--border-strong)", background: item.done ? `${EMERALD}29` : "transparent", color: EMERALD }}
          >
            {item.done ? "✓" : ""}
          </button>
          <span className="flex-1 min-w-0 truncate text-[11.5px]" style={{ color: item.done ? "var(--text-faint)" : "var(--text-secondary)", textDecoration: item.done ? "line-through" : "none" }}>
            {item.text}
          </span>
          <button onClick={() => onUpdate({ items: items.filter((i) => i.id !== item.id) })} className="shrink-0 w-4 h-4 flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5 mt-0.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Madde ekle..."
          className="flex-1 min-w-0 rounded-lg px-2 py-1 text-[11px] focus:outline-none"
          style={numInputStyle}
        />
        <button onClick={addItem} className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${EMERALD}22`, color: EMERALD }}>
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---- Organizasyon: Not ----
function NoteWidget({ value, onUpdate }) {
  const [text, setText] = useState(value?.text || "");
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onUpdate({ text })}
      placeholder="Not ekle..."
      rows={2}
      className="w-[240px] max-w-full rounded-xl p-2.5 text-[11.5px] leading-relaxed resize-none focus:outline-none"
      style={{ background: "rgba(var(--overlay-rgb),0.04)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
    />
  );
}

const RENDERERS = {
  time: TimeRangeWidget,
  timer: TimerWidget,
  counter: CounterWidget,
  calorie: CalorieWidget,
  sets_reps: SetsRepsWidget,
  game_score: GameScoreWidget,
  spotify: SpotifyEmbedWidget,
  youtube: YoutubeEmbedWidget,
  image: ImageWidget,
  checklist: ChecklistWidget,
  difficulty: DifficultyWidget,
  note: NoteWidget,
};
