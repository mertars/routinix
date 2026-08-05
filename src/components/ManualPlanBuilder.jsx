import { useState, useMemo, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ChevronDown,
  Copy,
  Download,
  Upload,
  Clock,
  Tag,
  Timer,
  CalendarClock,
  Target,
  MapPin,
  Zap,
  Coffee,
} from "lucide-react";
import { categoryOf, MONO_FONT } from "../constants";

const DAY_COUNT_CHOICES = [3, 5, 7, 14, 30];

const PRIORITY_STYLE = {
  Yüksek: { color: "#FF6E92", bg: "rgba(244,64,107,0.14)" },
  Orta: { color: "var(--amber-accent)", bg: "rgba(240,179,126,0.14)" },
  Düşük: { color: "#6FCF97", bg: "rgba(111,207,151,0.14)" },
};
const PRIORITIES = ["Yüksek", "Orta", "Düşük"];

const ENERGY_STYLE = {
  "Yüksek Odak": { color: "#B26BFF", bg: "rgba(178,107,255,0.14)", icon: "🧠" },
  "Düşük Odak": { color: "#7DA2FF", bg: "rgba(125,162,255,0.14)", icon: "😌" },
};
const ENERGY_LEVELS = ["Yüksek Odak", "Düşük Odak"];

// "Manuel Builder" kimliği — 4 AI-persona kategorisinden BİLEREK ayrışan,
// kendine özel hibrit neon paleti.
const NEON = { cyan: "#00F3FF", magenta: "#FF007F", violet: "#8B5CF6", emerald: "#10B981" };
const GRADIENT = `linear-gradient(90deg, ${NEON.magenta}, ${NEON.violet}, ${NEON.cyan})`;
const GLOW_ACTIVE_STYLE = {
  background: GRADIENT,
  color: "#fff",
  boxShadow: `0 0 16px rgba(255,0,127,0.32), 0 0 16px rgba(0,243,255,0.24)`,
};

// Dinamik Görev Özellik Seçici — hangi alanların Hızlı Ekle formunda ve
// görev kartlarında GÖRÜNECEĞİ, kullanıcının bu çip'leri açıp kapamasına
// bağlı. GERÇEKTEN VAR OLAN sütunlara (duration_min/estimated_cost/
// map_search_query) doğrudan yazılan üç tanesi ("duration"/"budget"/
// "location") DIŞINDA kalan üçü (pomodoro/time/goal) tasks tablosunda AYRI
// bir sütuna sahip DEĞİL — bkz. aşağıdaki composeDetail() ve dosya sonu notu.
const ATTRIBUTE_TOGGLES = [
  { key: "duration", label: "Süre", icon: Clock },
  { key: "budget", label: "Bütçe (₺)", icon: Tag },
  { key: "pomodoro", label: "Pomodoro Sayacı", icon: Timer },
  { key: "time", label: "Tarih & Saat", icon: CalendarClock },
  { key: "goal", label: "Hedef / Metrik", icon: Target },
  { key: "location", label: "Konum (📍)", icon: MapPin },
  { key: "energy", label: "Enerji Etiketi", icon: Zap },
];

let localIdCounter = 0;
function newLocalId() {
  localIdCounter += 1;
  return `local-${Date.now()}-${localIdCounter}`;
}

function emptyExtras() {
  return { pomodoroCount: null, timeOfDay: "", goalMetric: "", energyLevel: null };
}

// tasks.detail zaten serbest-metin bir sütun (TaskCard.jsx detay
// çekmecesinde okunaklı şekilde gösteriliyor) — pomodoro/saat/hedef/enerji
// için AYRI bir sütun YOKTUR, bu yüzden bunlar burada GÖRÜNÜR, düzenlenebilir
// bir açıklama satırına dönüştürülür (sessizce/gizlice "veri kaybı" olmaz,
// kullanıcı ne kaydedildiğini tam olarak görür).
function composeDetail(freeText, extras) {
  const parts = [];
  if (freeText?.trim()) parts.push(freeText.trim());
  if (extras.timeOfDay) parts.push(`🕐 ${extras.timeOfDay}`);
  if (extras.goalMetric) parts.push(`🎯 Hedef: ${extras.goalMetric}`);
  if (extras.energyLevel) parts.push(`${ENERGY_STYLE[extras.energyLevel].icon} ${extras.energyLevel}`);
  return parts.join(" · ") || null;
}

// "Claude'un önerisi": gün toplamı 4 saati (240 dk) geçtiğinde bir mola
// GÖREVİ zaten eklenmiş mi kontrol eder — aynı öneriyi tekrar tekrar
// göstermemek için ("Mola" başlıklı bir görev varsa öneriyi gizle).
function needsRestSuggestion(tasks) {
  const totalMin = tasks.reduce((n, t) => n + (Number(t.duration_min) || 0), 0);
  const hasRest = tasks.some((t) => /mola|dinlenme|break/i.test(t.title || ""));
  return totalMin > 240 && !hasRest;
}

// "Kendi Planını Hazırla" — Gemini'ye HİÇ gitmeyen, tamamen elle plan
// oluşturma akışı. Kaydedince aynı `plans`/`tasks` şemasına yazılır (bkz.
// saveManualPlan -> planService.saveManualPlanToSupabase) — PlanBoard/PDF/
// AI Koç dahil TÜM mevcut plan özellikleri, bu planın AI mi elle mi
// oluşturulduğunu hiç bilmeden aynen çalışır.
export default function ManualPlanBuilder({ open, category, onClose, onSave }) {
  const cat = categoryOf(category);

  const [title, setTitle] = useState("");
  const [totalDays, setTotalDays] = useState(7);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [activeDay, setActiveDay] = useState(1);
  const [daysData, setDaysData] = useState({}); // { [dayNumber]: task[] }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileStep, setMobileStep] = useState(1); // yalnızca <lg ekranlarda anlamlı
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const fileInputRef = useRef(null);

  // Dinamik Görev Özellik Seçici — hangi alanlar görünür. Gezi kategorisinde
  // bütçe/konum, VARSAYILAN olarak açık (eski davranışla tutarlı UX), diğer
  // kategorilerde kullanıcı isterse kendisi açar.
  const [enabledAttrs, setEnabledAttrs] = useState(
    () => new Set(category === "vacation" ? ["duration", "budget", "location"] : ["duration"])
  );
  const hasAttr = (key) => enabledAttrs.has(key);
  const toggleAttr = (key) => {
    setEnabledAttrs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Hızlı Görev Ekle satırının kendi yerel state'i.
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDuration, setQuickDuration] = useState("");
  const [quickPriority, setQuickPriority] = useState(null);
  const [quickCost, setQuickCost] = useState("");
  const [quickExtras, setQuickExtras] = useState(emptyExtras());

  const dayNumbers = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays]);
  const activeTasks = daysData[activeDay] || [];
  const totalTaskCount = useMemo(() => Object.values(daysData).reduce((n, arr) => n + (arr?.length || 0), 0), [daysData]);
  const showRestSuggestion = hasAttr("duration") && needsRestSuggestion(activeTasks);

  if (!open) return null;

  const setDayTasks = (dayNumber, updater) => {
    setDaysData((prev) => ({ ...prev, [dayNumber]: updater(prev[dayNumber] || []) }));
  };

  const updateTask = (localId, patch) => {
    setDayTasks(activeDay, (list) => list.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));
  };

  const removeTask = (localId) => {
    setDayTasks(activeDay, (list) => list.filter((t) => t.localId !== localId));
  };

  const addRestBreak = () => {
    setDayTasks(activeDay, (list) => [...list, { localId: newLocalId(), title: "☕ Mola", duration_min: 15, priority: null, estimated_cost: null, detail: null }]);
  };

  const submitQuickAdd = () => {
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    const pomodoroDuration = hasAttr("pomodoro") && quickExtras.pomodoroCount ? Number(quickExtras.pomodoroCount) * 25 : null;
    setDayTasks(activeDay, (list) => [
      ...list,
      {
        localId: newLocalId(),
        title: trimmed,
        duration_min: pomodoroDuration ?? (hasAttr("duration") && quickDuration ? Number(quickDuration) : null),
        priority: quickPriority,
        estimated_cost: hasAttr("budget") && quickCost.trim() ? quickCost.trim() : null,
        detail: composeDetail(null, quickExtras),
      },
    ]);
    setQuickTitle("");
    setQuickDuration("");
    setQuickPriority(null);
    setQuickCost("");
    setQuickExtras(emptyExtras());
  };

  const handleDayCountPick = (n) => {
    setTotalDays(n);
    setCustomOpen(false);
    if (activeDay > n) setActiveDay(1);
  };

  const applyCustomDays = () => {
    const n = Math.max(1, Math.min(365, parseInt(customVal, 10) || 0));
    if (!n) return;
    handleDayCountPick(n);
  };

  // --- Sürükle-Bırak sıralama (native HTML5 DnD, ek bağımlılık YOK) ---
  const handleDrop = (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    setDayTasks(activeDay, (list) => {
      const next = list.slice();
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  };

  // --- Günler Arası Kopyala & Şablonla ---
  const cloneTasksFor = (tasks) => tasks.map((t) => ({ ...t, localId: newLocalId() }));
  const copyActiveDayTo = (targetDays) => {
    const source = daysData[activeDay] || [];
    if (source.length === 0) return;
    setDaysData((prev) => {
      const next = { ...prev };
      for (const d of targetDays) {
        if (d === activeDay) continue;
        next[d] = cloneTasksFor(source);
      }
      return next;
    });
    setCopyMenuOpen(false);
  };
  const copyToNextDay = () => copyActiveDayTo([activeDay + 1].filter((d) => d <= totalDays));
  const copyToAllDays = () => copyActiveDayTo(dayNumbers);
  const copyToWeekdays = () => copyActiveDayTo(dayNumbers.filter((d) => (d - 1) % 7 < 5)); // her 7 günlük blokta 1-5. günler

  // --- Şablon Dışa/İçe Aktar (JSON) ---
  const exportJson = () => {
    const payload = { routinixManualPlan: true, version: 1, title, totalDays, category, days: daysData };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "kendi-planim").toString().trim().replace(/\s+/g, "-").toLowerCase() || "kendi-planim"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => fileInputRef.current?.click();
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // aynı dosyayı arka arkaya seçebilmek için input'u sıfırla
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== "object" || !parsed.days) throw new Error("Geçersiz dosya");
        setTitle(String(parsed.title || ""));
        setTotalDays(Math.max(1, Math.min(365, Number(parsed.totalDays) || 7)));
        // İçe aktarılan görevlere YENİ localId'ler ver — dosya birden fazla
        // kez içe aktarılırsa (ya da bir başkasının dosyasıysa) id çakışması
        // OLMAZ, her zaman taze bir yerel kimlik alır.
        const fresh = {};
        for (const [day, tasks] of Object.entries(parsed.days)) {
          fresh[day] = (Array.isArray(tasks) ? tasks : []).map((t) => ({ ...t, localId: newLocalId() }));
        }
        setDaysData(fresh);
        setError("");
      } catch {
        setError("Dosya okunamadı — geçerli bir Routinix plan dosyası (.json) seçtiğinden emin ol.");
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (saving) return;
    setError("");
    // Görev adı zorunlu değil olarak bırakılan satırları temizle — boş bir
    // "Görev Başlığı" alanıyla kayıt denemesi kullanıcıyı şaşırtmasın diye
    // sessizce ATLANIR (hata gösterip akışı KESMEK yerine).
    const cleanedDays = Object.fromEntries(
      Object.entries(daysData)
        .map(([day, tasks]) => [day, tasks.filter((t) => t.title.trim())])
        .filter(([, tasks]) => tasks.length > 0)
    );
    setSaving(true);
    try {
      await onSave({ title: title.trim() || "Kendi Planım", totalDays, days: cleanedDays, category });
    } catch (err) {
      setError(err?.message || "Plan kaydedilirken bir sorun oluştu. Tekrar dener misin?");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[109] bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />

      <div
        className="fixed inset-x-0 bottom-0 z-[110] max-h-[90vh] rounded-t-3xl flex flex-col overflow-hidden animate-[slideUpSheet_0.3s_ease] lg:inset-0 lg:max-h-none lg:rounded-none lg:animate-[fullScreenIn_0.25s_ease]"
        style={{ background: "var(--bg-app)" }}
      >
        {/* Çoklu neon aurora — bkz. önceki tur notu, KURULU .bg-blob tekniği. */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="bg-blob" style={{ width: 460, height: 460, top: "-10%", left: "-6%", background: `radial-gradient(circle, ${NEON.magenta} 0%, transparent 70%)`, animation: "blobFloatA 26s ease-in-out infinite" }} />
          <div className="bg-blob" style={{ width: 420, height: 420, top: "-4%", right: "-8%", background: `radial-gradient(circle, ${NEON.cyan} 0%, transparent 70%)`, animation: "blobFloatB 32s ease-in-out infinite" }} />
          <div className="bg-blob" style={{ width: 480, height: 480, bottom: "-14%", left: "18%", background: `radial-gradient(circle, ${NEON.violet} 0%, transparent 70%)`, animation: "blobFloatA 29s ease-in-out infinite", animationDelay: "-9s" }} />
          <div className="bg-blob" style={{ width: 380, height: 380, bottom: "-8%", right: "10%", background: `radial-gradient(circle, ${NEON.emerald} 0%, transparent 70%)`, animation: "blobFloatB 35s ease-in-out infinite", animationDelay: "-14s" }} />
        </div>

        <div className="relative z-10 shrink-0 pt-2.5 pb-1 flex justify-center lg:hidden">
          <div className="w-10 h-1.5 rounded-full" style={{ background: "var(--border-strong)" }} />
        </div>
        <div className="relative z-10 h-[3px] shrink-0 hidden lg:block" style={{ background: GRADIENT }} />

        {/* Başlık */}
        <div className="relative z-10 shrink-0 px-4 md:px-8 lg:px-10 pt-2 lg:pt-5 pb-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-lg" style={{ background: "linear-gradient(135deg, rgba(255,0,127,0.18), rgba(0,243,255,0.18))" }}>
              {cat.emoji}
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] md:text-[19px] font-bold text-[var(--text-primary)] leading-tight truncate">Kendi Planını Hazırla</h1>
              <p className="text-[11px] md:text-[12.5px] text-[var(--text-faint)]">
                {cat.label} · <span className="lg:hidden">{mobileStep === 1 ? "1/2 · Süre" : "2/2 · Görevler"}</span>
                <span className="hidden lg:inline">elle oluşturulan plan, yapay zeka kullanılmaz</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Şablon Dışa/İçe Aktar — küçük, ikon-yalnız, başlığın yanında */}
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
            <button onClick={triggerImport} aria-label="Plan dosyası içe aktar" title="İçe Aktar (.json)" className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" style={{ background: "rgba(var(--overlay-rgb), 0.06)" }}>
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={exportJson} aria-label="Planı dışa aktar" title="Dışa Aktar (.json)" className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" style={{ background: "rgba(var(--overlay-rgb), 0.06)" }}>
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} aria-label="Kapat" className="w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" style={{ background: "rgba(var(--overlay-rgb), 0.06)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gövde */}
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 md:px-8 lg:px-10 py-5 lg:py-8">
          <div className="max-w-[1600px] mx-auto flex flex-col lg:grid lg:grid-cols-[380px_1fr] lg:gap-8 lg:items-start">
            {/* SOL SÜTUN (lg+) / ADIM 1 — Plan Ayarları + Özellik Seçici */}
            <section className={`${mobileStep === 1 ? "block" : "hidden"} lg:block lg:sticky lg:top-0`}>
              <div className="glass rounded-3xl p-5 lg:p-6 flex flex-col gap-5">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] mb-2" style={{ fontFamily: MONO_FONT }}>
                    Plan Başlığı
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Kendi Disiplin Rutinim"
                    className="input-glow w-full rounded-2xl px-4 py-3.5 lg:py-3 text-[14.5px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)] outline-none border"
                    style={{ background: "var(--bg-input)", borderColor: "var(--border-default)" }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] mb-2" style={{ fontFamily: MONO_FONT }}>
                    Gün Sayısı
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {DAY_COUNT_CHOICES.map((n) => {
                      const active = !customOpen && totalDays === n;
                      return (
                        <button
                          key={n}
                          onClick={() => handleDayCountPick(n)}
                          className="min-h-[48px] lg:min-h-0 rounded-full px-4 lg:py-2 text-[13px] font-semibold transition-all duration-200 border"
                          style={active ? { ...GLOW_ACTIVE_STYLE, borderColor: "transparent" } : { borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-secondary)" }}
                        >
                          {n} Gün
                        </button>
                      );
                    })}
                    {!customOpen ? (
                      <button
                        onClick={() => {
                          setCustomOpen(true);
                          setCustomVal(String(totalDays));
                        }}
                        className="min-h-[48px] lg:min-h-0 rounded-full px-4 lg:py-2 text-[13px] font-semibold border transition-all duration-200"
                        style={!DAY_COUNT_CHOICES.includes(totalDays) ? { ...GLOW_ACTIVE_STYLE, borderColor: "transparent" } : { borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-secondary)" }}
                      >
                        {!DAY_COUNT_CHOICES.includes(totalDays) ? `${totalDays} Gün (Özel)` : "Özel"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          autoFocus
                          value={customVal}
                          onChange={(e) => setCustomVal(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && applyCustomDays()}
                          className="min-h-[48px] lg:min-h-0 w-20 rounded-full border px-3 lg:py-2 text-[13px] text-center outline-none bg-transparent text-[var(--text-primary)]"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-input)" }}
                        />
                        <button onClick={applyCustomDays} className="min-h-[48px] lg:min-h-0 rounded-full px-3.5 lg:py-2 text-[12.5px] font-semibold" style={GLOW_ACTIVE_STYLE}>
                          Uygula
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dinamik Görev Özellik Seçici — burada AÇILAN her alan, sağdaki
                    Hızlı Ekle formunda ve görev kartlarında BELİRİR; kapatılan
                    alan ekrandan tamamen kalkar. Bu, "tam ekranı dengeli
                    doldur, sıkışık olmasın" isteğinin doğrudan çözümü: 6-7
                    olası alanın HEPSİNİ her zaman göstermek yerine kullanıcı
                    yalnızca bu plan için gerçekten gereken alanları seçer. */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] mb-2" style={{ fontFamily: MONO_FONT }}>
                    Görev Özellikleri
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ATTRIBUTE_TOGGLES.map(({ key, label, icon: Icon }) => {
                      const active = hasAttr(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleAttr(key)}
                          className="flex items-center gap-1.5 rounded-full pl-2.5 pr-3 min-h-[40px] lg:min-h-0 lg:py-1.5 text-[11.5px] font-semibold transition-all duration-200"
                          style={active ? GLOW_ACTIVE_STYLE : { background: "var(--bg-input)", color: "var(--text-faint)" }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10.5px] text-[var(--text-faint)] leading-relaxed">
                    Açtığın özellikler Hızlı Ekle formunda ve görev kartlarında görünür.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setMobileStep(2)}
                className="lg:hidden mt-5 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl text-[14px] font-bold"
                style={GLOW_ACTIVE_STYLE}
              >
                Görevlere Geç <ChevronRight className="w-4 h-4" />
              </button>
            </section>

            {/* SAĞ SÜTUN (lg+) / ADIM 2 — Gün Sekmeleri + Kopyala + Sürükle-Bırak Editör */}
            <section className={`${mobileStep === 2 ? "block" : "hidden"} lg:block min-w-0`}>
              <button onClick={() => setMobileStep(1)} className="lg:hidden mb-4 flex items-center gap-1 text-[12.5px] font-semibold min-h-[44px]" style={{ color: "var(--text-muted)" }}>
                <ChevronLeft className="w-4 h-4" /> Ayarlara Dön
              </button>

              <div className="flex items-center justify-between mb-2 gap-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] shrink-0" style={{ fontFamily: MONO_FONT }}>
                  Gün Gün Düzenle
                </label>
                <span className="text-[11px] text-[var(--text-faint)] shrink-0" style={{ fontFamily: MONO_FONT }}>
                  {totalTaskCount} görev
                </span>
              </div>

              {/* Gün sekmeleri + Günü Kopyala menüsü — aynı satır */}
              <div className="flex items-center gap-2 mb-4">
                <div className="edge-fade-x -mx-4 md:mx-0 px-4 md:px-0 flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {dayNumbers.map((d) => {
                    const active = d === activeDay;
                    const count = daysData[d]?.length || 0;
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          setActiveDay(d);
                          setCopyMenuOpen(false);
                        }}
                        className="shrink-0 min-h-[48px] lg:min-h-0 flex items-center gap-1.5 rounded-xl px-3.5 lg:py-2 text-[12.5px] font-semibold transition-all duration-200"
                        style={active ? GLOW_ACTIVE_STYLE : { background: "rgba(var(--overlay-rgb),0.05)", color: "var(--text-secondary)" }}
                      >
                        {d}. Gün
                        {count > 0 && (
                          <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9.5px] font-bold" style={{ background: active ? "rgba(255,255,255,0.25)" : cat.accentSoft, color: active ? "#fff" : cat.accent }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Günü Kopyala / Çoğalt — açılır menü */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setCopyMenuOpen((v) => !v)}
                    disabled={activeTasks.length === 0}
                    className="min-h-[48px] lg:min-h-0 lg:h-9 flex items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold transition-colors disabled:opacity-35"
                    style={{ background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-secondary)" }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Günü Kopyala</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {copyMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setCopyMenuOpen(false)} />
                      <div
                        className="absolute right-0 top-full mt-2 z-20 w-64 rounded-2xl p-1.5 glass"
                        style={{ boxShadow: "0 20px 50px -16px rgba(0,0,0,0.4)" }}
                      >
                        <button onClick={copyToNextDay} disabled={activeDay >= totalDays} className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-[var(--text-secondary)] hover:bg-[rgba(var(--overlay-rgb),0.06)] transition-colors disabled:opacity-35">
                          {activeDay}. Günü {activeDay + 1}. Güne Kopyala
                        </button>
                        <button onClick={copyToWeekdays} className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-[var(--text-secondary)] hover:bg-[rgba(var(--overlay-rgb),0.06)] transition-colors">
                          Hafta İçi Günlerine Kopyala
                        </button>
                        <button onClick={copyToAllDays} className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-[var(--text-secondary)] hover:bg-[rgba(var(--overlay-rgb),0.06)] transition-colors">
                          Tüm Günlere Uygula ({totalDays} gün)
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Akıllı Mola Önerisi — yalnızca Süre alanı açıkken ve gün
                  toplamı 4 saati geçtiğinde, aynı öneri zaten uygulanmadıysa. */}
              {showRestSuggestion && (
                <button
                  onClick={addRestBreak}
                  className="w-full mb-4 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left transition-transform hover:scale-[1.01]"
                  style={{ background: `${NEON.emerald}14`, border: `1px solid ${NEON.emerald}55`, boxShadow: `0 0 14px -4px ${NEON.emerald}66` }}
                >
                  <Coffee className="w-4 h-4 shrink-0" style={{ color: NEON.emerald }} />
                  <span className="flex-1 text-[12.5px] font-semibold" style={{ color: NEON.emerald }}>
                    Bu gün 4 saati geçti — araya 15 dk mola eklemek ister misin?
                  </span>
                  <Plus className="w-4 h-4 shrink-0" style={{ color: NEON.emerald }} />
                </button>
              )}

              {/* Hızlı Görev Ekle */}
              <div className="glass rounded-2xl p-3 mb-4 flex flex-col gap-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">
                  ✨ Hızlı Görev Ekle — {activeDay}. güne
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitQuickAdd()}
                    placeholder="Görev adı yaz... (ör. 45 Dk Derin Çalışma)"
                    className="flex-1 min-w-0 min-h-[48px] sm:min-h-0 rounded-xl px-3.5 py-2 outline-none text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                    style={{ background: "var(--bg-input)" }}
                  />
                  <button
                    onClick={submitQuickAdd}
                    disabled={!quickTitle.trim()}
                    aria-label="Görevi ekle"
                    className="min-h-[48px] sm:min-h-0 sm:w-11 sm:h-11 flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all disabled:opacity-40"
                    style={GLOW_ACTIVE_STYLE}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="sm:hidden text-[13px]">Ekle</span>
                  </button>
                </div>

                {/* Yalnızca AÇIK olan özellik alanları görünür. */}
                {(hasAttr("duration") || hasAttr("budget") || hasAttr("pomodoro") || hasAttr("time") || hasAttr("goal") || hasAttr("energy")) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {hasAttr("duration") && (
                      <MiniField icon="⏱" placeholder="dk" value={quickDuration} onChange={setQuickDuration} type="number" width="w-16" />
                    )}
                    {hasAttr("pomodoro") && (
                      <MiniField icon="🍅" placeholder="× 25dk" value={quickExtras.pomodoroCount ?? ""} onChange={(v) => setQuickExtras((p) => ({ ...p, pomodoroCount: v }))} type="number" width="w-20" />
                    )}
                    {hasAttr("budget") && <MiniField icon="🏷️" placeholder="Bütçe" value={quickCost} onChange={setQuickCost} width="w-24" />}
                    {hasAttr("time") && (
                      <MiniField icon="🕐" placeholder="14:30" value={quickExtras.timeOfDay} onChange={(v) => setQuickExtras((p) => ({ ...p, timeOfDay: v }))} width="w-20" />
                    )}
                    {hasAttr("goal") && (
                      <MiniField icon="🎯" placeholder="ör. 10 Sayfa" value={quickExtras.goalMetric} onChange={(v) => setQuickExtras((p) => ({ ...p, goalMetric: v }))} width="w-28" />
                    )}
                    {PRIORITIES.map((p) => {
                      const selected = quickPriority === p;
                      const st = PRIORITY_STYLE[p];
                      return (
                        <button key={p} onClick={() => setQuickPriority(selected ? null : p)} className="min-h-[40px] sm:min-h-0 text-[11px] font-semibold px-2.5 sm:py-1.5 rounded-full transition-colors" style={{ background: selected ? st.bg : "var(--bg-input)", color: selected ? st.color : "var(--text-faint)" }}>
                          {p}
                        </button>
                      );
                    })}
                    {hasAttr("energy") &&
                      ENERGY_LEVELS.map((lvl) => {
                        const selected = quickExtras.energyLevel === lvl;
                        const st = ENERGY_STYLE[lvl];
                        return (
                          <button key={lvl} onClick={() => setQuickExtras((p) => ({ ...p, energyLevel: selected ? null : lvl }))} className="min-h-[40px] sm:min-h-0 text-[11px] font-semibold px-2.5 sm:py-1.5 rounded-full transition-colors" style={{ background: selected ? st.bg : "var(--bg-input)", color: selected ? st.color : "var(--text-faint)" }}>
                            {st.icon} {lvl}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Aktif günün görev listesi — sürükle-bırak sıralanabilir */}
              <div className="flex flex-col gap-2.5">
                {activeTasks.length === 0 && (
                  <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: "var(--border-default)" }}>
                    <p className="text-[12.5px] text-[var(--text-faint)]">{activeDay}. gün için henüz görev yok — yukarıdaki hızlı ekle formunu kullan.</p>
                  </div>
                )}
                {activeTasks.map((t, index) => (
                  <div
                    key={t.localId}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => setDragIndex(null)}
                    className="glass rounded-2xl p-3 flex flex-col gap-2.5 transition-opacity"
                    style={{ opacity: dragIndex === index ? 0.4 : 1 }}
                  >
                    <div className="flex items-center gap-2">
                      {/* Sürükleme tutamacı */}
                      <span className="shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-faint)] hidden sm:flex" aria-hidden="true" title="Sürükleyerek sırala">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => updateTask(t.localId, { title: e.target.value })}
                        placeholder="Görev başlığı..."
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                      />
                      <button onClick={() => removeTask(t.localId)} aria-label="Görevi sil" className="shrink-0 w-11 h-11 md:w-7 md:h-7 rounded-lg flex items-center justify-center text-[var(--text-faint)] hover:text-[#FF6E92] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {t.detail && <p className="text-[11.5px] text-[var(--text-faint)] pl-0 sm:pl-6">{t.detail}</p>}

                    <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-6">
                      {hasAttr("duration") && (
                        <MiniField icon="⏱" placeholder="dk" value={t.duration_min ?? ""} onChange={(v) => updateTask(t.localId, { duration_min: v ? Number(v) : null })} type="number" width="w-12" dense />
                      )}
                      {hasAttr("budget") && (
                        <MiniField icon="🏷️" placeholder="Bütçe" value={t.estimated_cost ?? ""} onChange={(v) => updateTask(t.localId, { estimated_cost: v || null })} width="w-24" dense />
                      )}
                      <div className="flex items-center gap-1">
                        {PRIORITIES.map((p) => {
                          const selected = t.priority === p;
                          const st = PRIORITY_STYLE[p];
                          return (
                            <button key={p} onClick={() => updateTask(t.localId, { priority: selected ? null : p })} className="min-h-[40px] md:min-h-0 text-[10.5px] font-semibold px-2.5 md:px-2 md:py-1 rounded-full transition-colors" style={{ background: selected ? st.bg : "var(--bg-input)", color: selected ? st.color : "var(--text-faint)" }}>
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Alt — sabit footer */}
        <div
          className={`relative z-10 shrink-0 px-4 md:px-8 lg:px-10 py-4 items-center justify-between gap-3 border-t ${mobileStep === 2 ? "flex" : "hidden lg:flex"}`}
          style={{
            borderColor: "var(--border-header)",
            background: "rgba(var(--glass-rgb), var(--alpha-chrome))",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="min-w-0 flex items-center gap-3">
            {error && <p className="text-[12px] font-medium truncate" style={{ color: "#FF6E92" }}>{error}</p>}
            {/* Mobilde İçe/Dışa Aktar (başlıkta gizliydi, sm:hidden) buraya taşınır. */}
            <div className="flex sm:hidden items-center gap-1.5">
              <button onClick={triggerImport} aria-label="İçe aktar" className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(var(--overlay-rgb), 0.06)", color: "var(--text-muted)" }}>
                <Upload className="w-4 h-4" />
              </button>
              <button onClick={exportJson} aria-label="Dışa aktar" className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(var(--overlay-rgb), 0.06)", color: "var(--text-muted)" }}>
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-2 rounded-2xl px-6 min-h-[48px] lg:py-3 text-[14px] font-bold transition-all disabled:opacity-60"
            style={{ ...GLOW_ACTIVE_STYLE, boxShadow: "0 8px 28px -10px rgba(255,0,127,0.6), 0 0 16px rgba(0,243,255,0.24)" }}
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Planı Kaydet ve Başlat
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// Küçük, tekrar kullanılabilir ikon+input çifti — Hızlı Ekle formu ve görev
// kartlarındaki opsiyonel alanlarda ortak kullanılır.
function MiniField({ icon, placeholder, value, onChange, type = "text", width = "w-20", dense = false }) {
  return (
    <div className={`flex items-center gap-1 rounded-lg px-2 ${dense ? "min-h-[40px] md:min-h-0 md:py-1" : "min-h-[48px] sm:min-h-0 py-2"}`} style={{ background: "var(--bg-input)" }}>
      <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{icon}</span>
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${width} bg-transparent outline-none text-[12px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]`}
      />
    </div>
  );
}

// TASARIM/VERİ NOTLARI:
// - Sürükle-Bırak GERÇEKTEN kalıcı: her görevin sırası kaydederken
//   tasks.sort_order'a yazılır (bkz. planService.saveManualPlanToSupabase +
//   supabase/task_sort_order.sql). Bu sütun/migration OLMADAN sürükle-bırak
//   yalnızca kaydetmeden ÖNCEKİ ekranda anlamlı olur, plan yeniden
//   açıldığında sıra KORUNMAZDI — bu yüzden yalnızca bir sürükleme ikonu
//   eklemek yeterli değildi, gerçek persistans gerekiyordu.
// - Pomodoro/Saat/Hedef/Enerji için AYRI bir DB sütunu YOK — tasks tablosu
//   yalnızca title/detail/duration_min/priority/estimated_cost/
//   map_search_query taşıyor. Pomodoro Sayacı bunun İSTİSNASI: doğrudan
//   duration_min'e (N×25dk) yazılır, bu sayede TaskCard.jsx'in ZATEN var
//   olan estimatePomodoros() mantığı bu görevi otomatik 🍅×N rozetiyle
//   gösterir — yeni kod GEREKMEDİ. Saat/Hedef/Enerji ise composeDetail()
//   ile GÖRÜNÜR, düzenlenebilir bir açıklama metnine dönüştürülür (sessizce
//   kaybolmaz, TaskCard'ın detay çekmecesinde okunur) — gerçek bir
//   zamanlayıcı/bildirim sistemi DEĞİLDİR, bunu iddia etmiyoruz.
// - "Günü Kopyala" ve içe/dışa aktarma tamamen istemci tarafında —
//   kaydedilene kadar hiçbir sunucu isteği YAPILMAZ.
