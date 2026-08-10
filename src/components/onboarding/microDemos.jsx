import { useState, useEffect } from "react";
import { CloudCheck, Wand2, FileDown, ClipboardPaste, Check, Music2, Search, Heart, HelpCircle, Moon, Menu } from "lucide-react";
import { CATEGORIES, CATEGORY_KEYS } from "../../constants";

// OnboardingTour'un 10 adımının mikro-UI vitrinleri — HİÇBİR PNG/JPG YOK,
// hepsi canlı, tıklanabilir, kendi yerel state'ini taşıyan gerçek React
// bileşenleri. Bunlar birebir ekran görüntüsü DEĞİL — uygulamanın kendi
// gerçek özelliklerinin (kategoriler/renkler/etiketler/rota biçimi GERÇEK
// constants.js'ten ve gerçek URL şemasından gelir) küçültülmüş, sadeleştirilmiş
// bir SİMÜLASYONUDUR. Her demo kendi tıklamasına kendi tepki verir; hiçbiri
// gerçek Supabase/ağ isteği YAPMAZ.

// ---- 1. Giriş & Senkronizasyon ----
export function SyncDemo({ accent }) {
  const [synced, setSynced] = useState(false);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <div className="w-full max-w-[220px] flex items-center justify-end gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(var(--overlay-rgb),0.05)", border: "1px solid rgba(var(--overlay-rgb),0.1)" }}>
        <span className="w-2 h-2 rounded-full" style={{ background: "rgba(var(--overlay-rgb),0.2)" }} />
        <span className="w-2 h-2 rounded-full" style={{ background: "rgba(var(--overlay-rgb),0.2)" }} />
        <button
          onClick={() => setSynced((v) => !v)}
          className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-all"
          style={{ background: accent, boxShadow: `0 0 14px -2px ${accent}` }}
        >
          {synced ? "Merhaba 👋" : "Giriş Yap"}
        </button>
      </div>
      <div className="flex flex-col items-center gap-2 transition-all duration-500" style={{ opacity: synced ? 1 : 0.35, transform: synced ? "scale(1)" : "scale(0.92)" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${accent}1F`, border: `1px solid ${accent}55` }}>
          <CloudCheck className="w-6 h-6" style={{ color: accent }} />
        </div>
        <span className="text-[10.5px] font-semibold text-center" style={{ color: accent }}>
          {synced ? "Tüm cihazlarında senkronize ✓" : "Giriş yaparak dene →"}
        </span>
      </div>
    </div>
  );
}

// ---- 2. Komuta Merkezi (4 alt-adım) ----
export function CommandCenterDemo({ sub }) {
  const [activeCat, setActiveCat] = useState("software");

  if (sub === "goal") {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-full rounded-xl px-3 py-2.5 text-[11px]" style={{ background: "var(--bg-input)", color: "var(--text-faint)" }}>
          6 ayda ileri seviye React öğrenmek...
        </div>
        <button className="rounded-full px-5 py-2 text-[12px] font-bold text-white" style={{ background: "linear-gradient(90deg,#FF007F,#8B5CF6,#00F3FF)" }}>
          Başla ✨
        </button>
      </div>
    );
  }
  if (sub === "questions") {
    return (
      <div className="w-full flex flex-wrap items-center justify-center gap-2 px-6">
        {["Deneyim seviyen?", "Haftada kaç gün?", "Hedef odak?"].map((q, i) => (
          <span
            key={q}
            className="rounded-full px-3 py-1.5 text-[10.5px] font-semibold animate-[fadeIn_0.35s_ease]"
            style={{ animationDelay: `${i * 0.12}s`, animationFillMode: "backwards", background: "rgba(139,92,246,0.14)", color: "#B26BFF" }}
          >
            {q}
          </span>
        ))}
      </div>
    );
  }
  if (sub === "manual") {
    return (
      <div className="w-full flex items-center justify-center">
        <button
          className="relative w-14 h-14 rounded-full flex items-center justify-center motion-safe:animate-pulse"
          style={{ background: "linear-gradient(135deg,#FF007F,#B026FF 55%,#00F3FF)", boxShadow: "0 0 22px -4px rgba(178,107,255,0.7)" }}
        >
          <Wand2 className="w-5 h-5 text-white" />
        </button>
      </div>
    );
  }
  // varsayılan: kategoriler
  return (
    <div className="w-full grid grid-cols-2 gap-2 px-4">
      {CATEGORY_KEYS.map((k) => {
        const c = CATEGORIES[k];
        const active = activeCat === k;
        return (
          <button
            key={k}
            onClick={() => setActiveCat(k)}
            className="flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all duration-300"
            style={active ? { background: c.accentSoft, boxShadow: `0 0 14px -4px ${c.accent}`, border: `1px solid ${c.accent}66` } : { background: "rgba(var(--overlay-rgb),0.04)", border: "1px solid transparent" }}
          >
            <span className="text-[16px]">{c.emoji}</span>
            <span className="text-[9px] font-bold text-center leading-tight" style={{ color: active ? c.accent : "var(--text-faint)" }}>
              {c.label.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---- 3. Modüler Görev Kartları (4 alt-adım = 4 kategori) ----
const TASK_MODULE_CONTENT = {
  software: { title: "API Rate Limiting Ekle", chips: ["🍅 3", "⏱ 75dk"] },
  fitness: { title: "İtiş Günü — Bench Press", chips: ["⏱ 60dk", "Yüksek"] },
  vacation: { title: "Kolezyum Turu", chips: ["🏷️ 450₺", "📍 Roma"] },
  general: { title: "İspanyolca — Ünite 4", chips: ["🎯 20 kelime", "⏱ 40dk"] },
};
export function TaskModulesDemo({ sub }) {
  const key = sub || "software";
  const cat = CATEGORIES[key];
  const content = TASK_MODULE_CONTENT[key];
  return (
    <div className="w-full px-5">
      <div
        key={key}
        className="tour-step-in rounded-2xl p-3.5 flex flex-col gap-2.5"
        style={{ background: "var(--bg-card)", border: `1px solid ${cat.accent}40`, boxShadow: `0 0 18px -8px ${cat.accent}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px]">{cat.emoji}</span>
          <span className="text-[12px] font-bold flex-1 truncate" style={{ color: "var(--text-primary)" }}>
            {content.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {content.chips.map((c) => (
            <span key={c} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-secondary)" }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- 4. Plan Panosu & İnce Ayar (3 alt-adım) ----
export function PlanBoardDemo({ sub, accent }) {
  const [activeDay, setActiveDay] = useState(1);
  const [title, setTitle] = useState("Sabah Koşusu");
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState(false);

  if (sub === "edit") {
    return (
      <div className="w-full px-5 flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          className="w-full rounded-xl px-3 py-2.5 text-[12px] font-semibold outline-none transition-all"
          style={{ background: "var(--bg-input)", color: "var(--text-primary)", border: `1px solid ${editing ? accent : "var(--border-default)"}`, boxShadow: editing ? `0 0 12px -4px ${accent}` : "none" }}
        />
        <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
          {editing ? "Düzenleniyor..." : "Değiştirmek için dokun"}
        </span>
      </div>
    );
  }
  if (sub === "check") {
    return (
      <div className="w-full px-5 flex flex-col gap-2.5">
        <button onClick={() => setChecked((v) => !v)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left" style={{ background: "var(--bg-card)" }}>
          <span
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "check-glow" : ""}`}
            style={{ borderColor: checked ? "#2ED9A3" : "var(--border-strong)", background: checked ? "#2ED9A3" : "transparent" }}
          >
            {checked && <Check className="w-3.5 h-3.5 text-white" />}
          </span>
          <span className="text-[12px] font-semibold flex-1" style={{ color: "var(--text-primary)", textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.6 : 1 }}>
            Su içmeyi unutma
          </span>
        </button>
        <div className="rounded-xl px-3 py-2 text-[10.5px] font-semibold" style={{ background: "rgba(46,217,163,0.1)", color: "#2ED9A3" }}>
          🔁 Her Gün · Rutin
        </div>
      </div>
    );
  }
  // varsayılan: gün/hafta sekmeleri
  return (
    <div className="w-full px-4 flex flex-wrap items-center justify-center gap-1.5">
      {[1, 2, 3, 8].map((d) => (
        <button
          key={d}
          onClick={() => setActiveDay(d)}
          className="rounded-lg px-3 py-2 text-[11px] font-bold transition-all duration-300"
          style={activeDay === d ? { background: accent, color: "#fff", boxShadow: `0 0 12px -3px ${accent}` } : { background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-faint)" }}
        >
          {d}. Gün
        </button>
      ))}
      <button
        onClick={() => setActiveDay(0)}
        className="rounded-lg px-3 py-2 text-[11px] font-bold transition-all duration-300"
        style={activeDay === 0 ? { background: accent, color: "#fff", boxShadow: `0 0 12px -3px ${accent}` } : { background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-faint)" }}
      >
        2. Hafta
      </button>
    </div>
  );
}

// ---- 5. PDF Çıktı Motoru ----
export function PdfDemo({ accent, onPreview }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4">
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[11.5px] font-bold text-white transition-all"
          style={{ background: accent, boxShadow: `0 0 16px -3px ${accent}` }}
        >
          <FileDown className="w-4 h-4" /> PDF İndir
        </button>
        <div
          className="w-16 h-20 rounded-md bg-white shadow-lg flex flex-col gap-1.5 p-2.5 transition-all duration-500 shrink-0"
          style={{ transform: open ? "translateX(0) rotate(0deg)" : "translateX(-16px) rotate(-8deg)", opacity: open ? 1 : 0.35 }}
        >
          <div className="h-1.5 w-8 rounded-full bg-slate-800" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[3px] rounded-full bg-slate-300" style={{ width: `${74 - i * 9}%` }} />
          ))}
        </div>
      </div>
      {onPreview && (
        <button onClick={onPreview} className="text-[11px] font-bold underline underline-offset-2 transition-opacity hover:opacity-75" style={{ color: accent }}>
          Örnek Belgeyi Canlı Önizle →
        </button>
      )}
    </div>
  );
}

// ---- 6. Studio Builder & Dosya Orkestrasyonu (3 alt-adım) ----
export function StudioOrchestrationDemo({ sub, accent }) {
  const [confirmedFormat, setConfirmedFormat] = useState(null);
  const [pasted, setPasted] = useState(false);
  const [attrs, setAttrs] = useState(() => new Set(["duration"]));

  if (sub === "clipboard") {
    return (
      <div className="w-full px-4 flex items-center justify-center gap-3">
        <div className="w-20 rounded-xl px-2 py-2.5 text-[10px] font-bold shrink-0" style={{ background: "var(--bg-card)", border: `1px solid ${accent}55` }}>
          <div style={{ color: "var(--text-primary)" }}>3. Gün</div>
          <div className="mt-1 text-[9.5px] font-medium" style={{ color: "var(--text-faint)" }}>
            Koşu 5km
          </div>
        </div>
        <button onClick={() => setPasted((v) => !v)} className="shrink-0 rounded-full p-2 transition-transform active:scale-90" style={{ background: `${accent}22`, color: accent }}>
          <ClipboardPaste className="w-3.5 h-3.5" />
        </button>
        <div className="w-20 rounded-xl px-2 py-2.5 text-[10px] font-bold shrink-0 min-h-[52px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)" }}>
          <div style={{ color: "var(--text-primary)" }}>4. Gün</div>
          {pasted && (
            <div key="pasted" className="tour-step-in mt-1 text-[9.5px] font-medium" style={{ color: accent }}>
              + Koşu 5km ✓
            </div>
          )}
        </div>
      </div>
    );
  }
  if (sub === "params") {
    const TOGGLES = [
      { k: "duration", l: "⏱ Süre" },
      { k: "budget", l: "🏷️ Bütçe" },
      { k: "location", l: "📍 Konum" },
    ];
    return (
      <div className="w-full px-4 flex flex-wrap items-center justify-center gap-1.5">
        {TOGGLES.map((t) => {
          const active = attrs.has(t.k);
          return (
            <button
              key={t.k}
              onClick={() =>
                setAttrs((prev) => {
                  const next = new Set(prev);
                  next.has(t.k) ? next.delete(t.k) : next.add(t.k);
                  return next;
                })
              }
              className="rounded-full px-2.5 py-1.5 text-[10.5px] font-semibold transition-all"
              style={active ? { background: `${accent}22`, color: accent, boxShadow: `0 0 8px -2px ${accent}` } : { background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-faint)" }}
            >
              {t.l}
            </button>
          );
        })}
      </div>
    );
  }
  // varsayılan: içe/dışa aktar rozetleri
  const FORMATS = [
    { k: "ics", l: ".ics" },
    { k: "json", l: "JSON" },
    { k: "pdf", l: "PDF" },
    { k: "upload", l: "Yükle" },
  ];
  return (
    <div className="w-full px-4 flex flex-wrap items-center justify-center gap-1.5">
      {FORMATS.map((f) => (
        <button
          key={f.k}
          onClick={() => setConfirmedFormat(f.k)}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10.5px] font-bold transition-all"
          style={confirmedFormat === f.k ? { background: `${accent}22`, color: accent, boxShadow: `0 0 10px -3px ${accent}` } : { background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-faint)" }}
        >
          {confirmedFormat === f.k && <Check className="w-3 h-3" />}
          {f.l}
        </button>
      ))}
    </div>
  );
}

// ---- 7. Panoramik Kontrol Paneli ----
const OVERVIEW_BARS = [
  { key: "routines", label: "Rutinler", value: 80, color: "#2ED9A3" },
  { key: "tasks", label: "Görevler", value: 55, color: "#00C2D6" },
  { key: "plans", label: "Planlar", value: 100, color: "#8FA0FF" },
];
export function OverviewDemo() {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="w-full px-6 flex flex-col gap-3">
      {OVERVIEW_BARS.map((b) => (
        <div key={b.key}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              {b.label}
            </span>
            <span className="text-[10px] font-bold" style={{ color: b.color }}>
              {animated ? b.value : 0}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--disabled-bg)" }}>
            <div className="h-full rounded-full transition-all duration-[1100ms] ease-out" style={{ width: `${animated ? b.value : 0}%`, background: b.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- 8. Pomodoro & Derin Odak Stüdyosu (3 alt-adım) ----
export function PomodoroDemo({ sub, accent }) {
  const [focus, setFocus] = useState(false);

  if (sub === "music") {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-3">
        <div className="flex items-end gap-1 h-8">
          {[7, 15, 9, 19, 8, 13, 6].map((h, i) => (
            <span key={i} className="w-1 rounded-full motion-safe:animate-pulse" style={{ height: h, background: accent, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "#1DB9541f", color: "#1DB954" }}>
            <Music2 className="w-3 h-3" /> Spotify
          </span>
        </div>
      </div>
    );
  }
  if (sub === "focus") {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-3">
        <div
          className="w-16 h-16 rounded-full border-4 flex items-center justify-center font-mono text-[13px] font-bold transition-all duration-500"
          style={{ borderColor: accent, color: "var(--text-primary)", transform: focus ? "scale(1.18)" : "scale(1)" }}
        >
          24:58
        </div>
        <div className="flex items-center gap-1.5 transition-all duration-500" style={{ opacity: focus ? 0 : 1, transform: focus ? "translateY(6px)" : "translateY(0)" }}>
          <span className="rounded-full px-2 py-1 text-[9.5px] font-semibold" style={{ background: "var(--bg-input)", color: "var(--text-faint)" }}>
            Mola
          </span>
          <span className="rounded-full px-2 py-1 text-[9.5px] font-semibold" style={{ background: "var(--bg-input)", color: "var(--text-faint)" }}>
            Ayarlar
          </span>
        </div>
        <button onClick={() => setFocus((v) => !v)} className="text-[10.5px] font-bold" style={{ color: accent }}>
          {focus ? "Odak Modundan Çık" : "Odak Moduna Geç →"}
        </button>
      </div>
    );
  }
  // varsayılan: zamanlayıcı
  return (
    <div className="w-full flex flex-col items-center justify-center gap-2.5">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(var(--overlay-rgb),0.1)" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * 0.35} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
          16:12
        </div>
      </div>
      <span className="text-[10.5px] font-semibold text-center px-4" style={{ color: "var(--text-faint)" }}>
        🎯 Derin Çalışma — Rapor Yaz
      </span>
    </div>
  );
}

// ---- 9. Nexus Sosyal Ekosistem (3 alt-adım) ----
export function NexusDemo({ sub, accent }) {
  const [liked, setLiked] = useState(false);

  if (sub === "filter") {
    return (
      <div className="w-full px-5 flex flex-col items-center gap-2.5">
        <div className="w-full flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--bg-input)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />
          <span className="text-[10.5px] truncate" style={{ color: "var(--text-faint)" }}>
            "30 günlük disiplin"
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {["Yazılım", "Fitness", "Seyahat"].map((t) => (
            <span key={t} className="rounded-full px-2.5 py-1 text-[9.5px] font-semibold" style={{ background: `${accent}18`, color: accent }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (sub === "wrapped") {
    return (
      <div className="w-full flex items-center justify-center">
        <div className="w-24 h-36 rounded-xl flex flex-col items-center justify-center gap-1.5 text-white" style={{ background: "linear-gradient(160deg,#FF007F,#8B5CF6,#00F3FF)" }}>
          <span className="text-[9px] font-bold uppercase tracking-wide opacity-80">Bu Hafta</span>
          <span className="text-[26px] font-black leading-none">86%</span>
          <span className="text-[9px] font-semibold opacity-90">tamamlama oranı</span>
        </div>
      </div>
    );
  }
  // varsayılan: keşfet/beğen
  return (
    <div className="w-full px-5 flex flex-col gap-2.5">
      <div className="rounded-xl p-2.5 flex items-center gap-2.5" style={{ background: "var(--bg-card)" }}>
        <div className="w-8 h-8 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg,${accent},#8B5CF6)` }} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
            30 Günlük Disiplin Sprinti
          </div>
          <div className="text-[9.5px]" style={{ color: "var(--text-faint)" }}>
            214 klon
          </div>
        </div>
        <button onClick={() => setLiked((v) => !v)} aria-label="Beğen" className="shrink-0">
          <Heart className="w-4 h-4 transition-all duration-300" style={{ color: liked ? "#F4406B" : "var(--text-faint)", fill: liked ? "#F4406B" : "none", transform: liked ? "scale(1.2)" : "scale(1)" }} />
        </button>
      </div>
      <button className="self-center rounded-full px-3 py-1.5 text-[10.5px] font-bold" style={{ background: `${accent}18`, color: accent }}>
        + Planlarıma Ekle
      </button>
    </div>
  );
}

// ---- 10. Canlı Plan Paylaşımı & Misafir Erişimi ----
// URL GERÇEK şemayı yansıtır (/t/[slug]) — bkz. utils/shareLink.js. Sabit bir
// alan adı (ör. "routinix.app") BİLEREK yazılmaz (aynı dosyadaki gerekçe:
// deploy edilen gerçek adres doğrulanamaz), bu yüzden örnek/temsili bir host
// kullanılır.
export function ShareDemo({ accent }) {
  const [copied, setCopied] = useState(false);
  const host = typeof window !== "undefined" && window.location.host ? window.location.host : "routinix.app";
  const url = `${host}/t/8k2x9p`;
  return (
    <div className="w-full px-5 flex flex-col items-center gap-3">
      <div className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--bg-input)", border: "1px solid var(--border-default)" }}>
        <span className="flex-1 text-[10.5px] truncate" style={{ color: "var(--text-secondary)", fontFamily: "ui-monospace, monospace" }}>
          {url}
        </span>
        <button
          onClick={() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white"
          style={{ background: accent }}
        >
          {copied ? "Kopyalandı ✓" : "Kopyala"}
        </button>
      </div>
      <span className="rounded-full px-3 py-1.5 text-[10px] font-bold" style={{ background: "rgba(46,217,163,0.14)", color: "#2ED9A3" }}>
        🔓 Hesapsız Misafir Erişimi
      </span>
    </div>
  );
}

// ---- 11. Rehbere Her An Erişim ----
// [❓] [🌙] [☰] rozet grubunun GERÇEK Header.jsx sırasıyla (Rehber → Tema →
// Menü) birebir aynı simülasyonu — hover/tıklamada neon vurgu.
export function HeaderMenuDemo({ accent }) {
  const [active, setActive] = useState("help");
  const items = [
    { key: "help", Icon: HelpCircle, label: "Rehber" },
    { key: "theme", Icon: Moon, label: "Tema" },
    { key: "menu", Icon: Menu, label: "Menü" },
  ];
  return (
    <div className="w-full flex items-center justify-center gap-3">
      {items.map(({ key, Icon, label }) => {
        const on = active === key;
        return (
          <button
            key={key}
            onClick={() => setActive(key)}
            className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
            style={on ? { background: `${accent}22`, border: `1px solid ${accent}`, boxShadow: `0 0 16px -3px ${accent}` } : { background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color: on ? accent : "var(--text-secondary)" }} />
            <span
              className="absolute -bottom-5 text-[9px] font-bold whitespace-nowrap transition-opacity duration-200"
              style={{ color: accent, opacity: on ? 1 : 0 }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
