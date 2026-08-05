import { useState, useMemo } from "react";
import { X, Plus, Trash2, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { categoryOf, MONO_FONT } from "../constants";

const DAY_COUNT_CHOICES = [3, 5, 7, 14, 30];

const PRIORITY_STYLE = {
  Yüksek: { color: "#FF6E92", bg: "rgba(244,64,107,0.14)" },
  Orta: { color: "var(--amber-accent)", bg: "rgba(240,179,126,0.14)" },
  Düşük: { color: "#6FCF97", bg: "rgba(111,207,151,0.14)" },
};
const PRIORITIES = ["Yüksek", "Orta", "Düşük"];

// "Manuel Builder" kimliği — 4 AI-persona kategorisinden BİLEREK ayrışan,
// kendine özel hibrit neon paleti (bkz. dosya sonu yorumu). Yalnızca BU
// ekranda kullanılır; app-geneli BackgroundScene.jsx'in kategori-bazlı
// mor/turuncu glow'undan (GLOW_BY_CATEGORY) BİLİNÇLİ OLARAK bağımsız.
const NEON = { cyan: "#00F3FF", magenta: "#FF007F", violet: "#8B5CF6", emerald: "#10B981" };
const GRADIENT = `linear-gradient(90deg, ${NEON.magenta}, ${NEON.violet}, ${NEON.cyan})`;
const GLOW_ACTIVE_STYLE = {
  background: GRADIENT,
  color: "#fff",
  boxShadow: `0 0 16px rgba(255,0,127,0.32), 0 0 16px rgba(0,243,255,0.24)`,
};

let localIdCounter = 0;
function newLocalId() {
  localIdCounter += 1;
  return `local-${Date.now()}-${localIdCounter}`;
}

// "Kendi Planını Hazırla" — Gemini'ye HİÇ gitmeyen, tamamen elle plan
// oluşturma akışı. AI'ın "hedef -> anket -> otomatik plan" boru hattının
// tersi: kullanıcı gün gün, görev görev kendi programını kurar. Kaydedince
// aynı `plans`/`tasks` şemasına yazılır (bkz. saveManualPlan ->
// planService.saveManualPlanToSupabase) — PlanBoard/PDF/AI Koç dahil TÜM
// mevcut plan özellikleri, bu planın AI mi elle mi oluşturulduğunu hiç
// bilmeden aynen çalışır.
//
// RESPONSIVE MİMARİ: Masaüstünde (lg+) tam genişlik "Studio" düzeni —
// SOL sütun (Plan Başlığı + Gün Sayısı, dar/sabit 380px) + SAĞ sütun
// (Gün Gün Editör, geniş) yan yana. Görev listesinin kendisi zaten CANLI
// bir önizleme (eklenen her görev anında görünür) — AYRI bir "önizleme
// paneli" BİLEREK eklenmedi, aynı bilgiyi iki kez göstermek gereksiz
// kalabalık yaratırdı (bkz. bir önceki turda sidebar'ın geri alınma sebebi).
// Mobilde ekranın ALTINDAN yükselen bir BottomSheet'e dönüşür VE iki ADIMA
// bölünür (1: başlık+gün sayısı, 2: gün gün editör). Adım/sütun geçişi
// SALT CSS/görünürlük ile yönetilir — ayrı bir mobil/masaüstü bileşen
// kopyası GEREKMEZ.
export default function ManualPlanBuilder({ open, category, onClose, onSave }) {
  const cat = categoryOf(category);
  const isVacation = category === "vacation";

  const [title, setTitle] = useState("");
  const [totalDays, setTotalDays] = useState(7);
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [activeDay, setActiveDay] = useState(1);
  const [daysData, setDaysData] = useState({}); // { [dayNumber]: task[] }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileStep, setMobileStep] = useState(1); // yalnızca <lg ekranlarda anlamlı

  // Hızlı Görev Ekle satırının kendi yerel state'i.
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDuration, setQuickDuration] = useState("");
  const [quickPriority, setQuickPriority] = useState(null);
  const [quickCost, setQuickCost] = useState("");

  const dayNumbers = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays]);
  const activeTasks = daysData[activeDay] || [];
  const totalTaskCount = useMemo(() => Object.values(daysData).reduce((n, arr) => n + (arr?.length || 0), 0), [daysData]);

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

  const submitQuickAdd = () => {
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    setDayTasks(activeDay, (list) => [
      ...list,
      {
        localId: newLocalId(),
        title: trimmed,
        duration_min: quickDuration ? Number(quickDuration) : null,
        priority: quickPriority,
        estimated_cost: isVacation && quickCost.trim() ? quickCost.trim() : null,
      },
    ]);
    setQuickTitle("");
    setQuickDuration("");
    setQuickPriority(null);
    setQuickCost("");
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
      {/* Mobil-yalnız arkaplan karartma — BottomSheet tam ekranı kaplamadığı
          için (max-h-[90vh]) arkasındaki uygulamayı karartıp dokununca
          kapatan bir katman gerekir. lg+'da builder ZATEN tam ekran
          olduğundan bu katmana gerek yok (lg:hidden). */}
      <div className="fixed inset-0 z-[109] bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />

      <div
        className="fixed inset-x-0 bottom-0 z-[110] max-h-[90vh] rounded-t-3xl flex flex-col overflow-hidden animate-[slideUpSheet_0.3s_ease] lg:inset-0 lg:max-h-none lg:rounded-none lg:animate-[fullScreenIn_0.25s_ease]"
        style={{ background: "var(--bg-app)" }}
      >
        {/* --- Çoklu neon "aurora" glow — BackgroundScene.jsx'teki KURULU
            .bg-blob tekniğinin (blur(70px), blobFloatA/B, tema-duyarlı
            --blob-opacity: koyu 0.32 / açık 0.18) AYNISI, ama 4 kendine özel
            renkle (cyan/magenta/violet/emerald). pointer-events-none +
            içeriğin ARKASINDA (z-0) — tamamen dekoratif, dokunmayı engellemez.
            Tema uyumu OTOMATİK: --blob-opacity zaten her iki temada da
            tanımlı (index.css), burada yeniden hesaplamaya gerek yok. */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="bg-blob" style={{ width: 460, height: 460, top: "-10%", left: "-6%", background: `radial-gradient(circle, ${NEON.magenta} 0%, transparent 70%)`, animation: "blobFloatA 26s ease-in-out infinite" }} />
          <div className="bg-blob" style={{ width: 420, height: 420, top: "-4%", right: "-8%", background: `radial-gradient(circle, ${NEON.cyan} 0%, transparent 70%)`, animation: "blobFloatB 32s ease-in-out infinite" }} />
          <div className="bg-blob" style={{ width: 480, height: 480, bottom: "-14%", left: "18%", background: `radial-gradient(circle, ${NEON.violet} 0%, transparent 70%)`, animation: "blobFloatA 29s ease-in-out infinite", animationDelay: "-9s" }} />
          <div className="bg-blob" style={{ width: 380, height: 380, bottom: "-8%", right: "10%", background: `radial-gradient(circle, ${NEON.emerald} 0%, transparent 70%)`, animation: "blobFloatB 35s ease-in-out infinite", animationDelay: "-14s" }} />
        </div>

        {/* Sürükleme tutamacı — yalnızca mobil BottomSheet'te anlamlı. */}
        <div className="relative z-10 shrink-0 pt-2.5 pb-1 flex justify-center lg:hidden">
          <div className="w-10 h-1.5 rounded-full" style={{ background: "var(--border-strong)" }} />
        </div>

        {/* Üst neon şerit */}
        <div className="relative z-10 h-[3px] shrink-0 hidden lg:block" style={{ background: GRADIENT }} />

        {/* Başlık */}
        <div
          className="relative z-10 shrink-0 px-4 md:px-8 lg:px-10 pt-2 lg:pt-5 pb-4 flex items-center justify-between gap-3 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-lg"
              style={{ background: "linear-gradient(135deg, rgba(255,0,127,0.18), rgba(0,243,255,0.18))" }}
            >
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
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            style={{ background: "rgba(var(--overlay-rgb), 0.06)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Gövde — kaydırılabilir. lg+'da "Studio" iki sütunu: SOL (dar,
            sabit genişlik) Plan Başlığı + Gün Sayısı, SAĞ (geniş, esnek)
            Gün Gün Editör. <lg'de tek sütun, mobileStep ile adım adım. */}
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 md:px-8 lg:px-10 py-5 lg:py-8">
          <div className="max-w-[1600px] mx-auto flex flex-col lg:grid lg:grid-cols-[380px_1fr] lg:gap-8 lg:items-start">
            {/* SOL SÜTUN (lg+) / ADIM 1 (mobilde tek başına görünür) */}
            <section className={`${mobileStep === 1 ? "block" : "hidden"} lg:block lg:sticky lg:top-0`}>
              <div className="glass rounded-3xl p-5 lg:p-6">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] mb-2" style={{ fontFamily: MONO_FONT }}>
                  Plan Başlığı
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn: Kendi Disiplin Rutinim"
                  className="input-glow w-full rounded-2xl px-4 py-3.5 lg:py-3 text-[14.5px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)] outline-none mb-5 border"
                  style={{ background: "var(--bg-input)", borderColor: "var(--border-default)" }}
                />

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
                        style={
                          active
                            ? { ...GLOW_ACTIVE_STYLE, borderColor: "transparent" }
                            : { borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-secondary)" }
                        }
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
                      style={
                        !DAY_COUNT_CHOICES.includes(totalDays)
                          ? { ...GLOW_ACTIVE_STYLE, borderColor: "transparent" }
                          : { borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-secondary)" }
                      }
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
                      <button
                        onClick={applyCustomDays}
                        className="min-h-[48px] lg:min-h-0 rounded-full px-3.5 lg:py-2 text-[12.5px] font-semibold"
                        style={GLOW_ACTIVE_STYLE}
                      >
                        Uygula
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobilde/tablet'te bu adımın "İleri" kontrolü — lg+'da gizli
                  (orası zaten sağdaki editörle aynı ekranda). */}
              <button
                onClick={() => setMobileStep(2)}
                className="lg:hidden mt-5 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl text-[14px] font-bold"
                style={GLOW_ACTIVE_STYLE}
              >
                Görevlere Geç <ChevronRight className="w-4 h-4" />
              </button>
            </section>

            {/* SAĞ SÜTUN (lg+) / ADIM 2 (mobilde tek başına görünür) —
                Gün Gün Editör. Eklenen her görev bu listede ANINDA görünür,
                bu zaten kendi başına canlı bir önizlemedir. */}
            <section className={`${mobileStep === 2 ? "block" : "hidden"} lg:block min-w-0`}>
              {/* Mobilde/tablet'te geri dönüş — 1. adıma (gün sayısını değiştirmek için). */}
              <button
                onClick={() => setMobileStep(1)}
                className="lg:hidden mb-4 flex items-center gap-1 text-[12.5px] font-semibold min-h-[44px]"
                style={{ color: "var(--text-muted)" }}
              >
                <ChevronLeft className="w-4 h-4" /> Süreyi Değiştir
              </button>

              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]" style={{ fontFamily: MONO_FONT }}>
                  Gün Gün Düzenle
                </label>
                <span className="text-[11px] text-[var(--text-faint)]" style={{ fontFamily: MONO_FONT }}>
                  {totalTaskCount} görev eklendi
                </span>
              </div>

              {/* Gün sekmeleri — yatay kaydırılabilir tab şeridi, 48px dokunma alanı */}
              <div className="edge-fade-x -mx-4 md:mx-0 px-4 md:px-0 mb-4 flex gap-1.5 overflow-x-auto no-scrollbar">
                {dayNumbers.map((d) => {
                  const active = d === activeDay;
                  const count = daysData[d]?.length || 0;
                  return (
                    <button
                      key={d}
                      onClick={() => setActiveDay(d)}
                      className="shrink-0 min-h-[48px] lg:min-h-0 flex items-center gap-1.5 rounded-xl px-3.5 lg:py-2 text-[12.5px] font-semibold transition-all duration-200"
                      style={active ? GLOW_ACTIVE_STYLE : { background: "rgba(var(--overlay-rgb),0.05)", color: "var(--text-secondary)" }}
                    >
                      {d}. Gün
                      {count > 0 && (
                        <span
                          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9.5px] font-bold"
                          style={{ background: active ? "rgba(255,255,255,0.25)" : cat.accentSoft, color: active ? "#fff" : cat.accent }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Hızlı Görev Ekle — geniş, işlevsel tek satırlık form: başlık +
                  süre + öncelik + (gezi ise bütçe) + belirgin "+" ekle butonu.
                  Enter da gönderir. */}
              <div className="glass rounded-2xl p-3 mb-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)] mb-2.5">
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <input
                      type="number"
                      min={0}
                      value={quickDuration}
                      onChange={(e) => setQuickDuration(e.target.value)}
                      placeholder="dk"
                      className="w-16 min-h-[48px] sm:min-h-0 rounded-xl px-2.5 py-2 outline-none text-[13px] text-center text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                      style={{ background: "var(--bg-input)" }}
                    />
                    {isVacation && (
                      <input
                        type="text"
                        value={quickCost}
                        onChange={(e) => setQuickCost(e.target.value)}
                        placeholder="Bütçe"
                        className="w-24 min-h-[48px] sm:min-h-0 rounded-xl px-2.5 py-2 outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                        style={{ background: "var(--bg-input)" }}
                      />
                    )}
                    {PRIORITIES.map((p) => {
                      const selected = quickPriority === p;
                      const st = PRIORITY_STYLE[p];
                      return (
                        <button
                          key={p}
                          onClick={() => setQuickPriority(selected ? null : p)}
                          className="min-h-[48px] sm:min-h-0 text-[11px] font-semibold px-2.5 sm:py-1.5 rounded-full transition-colors"
                          style={{ background: selected ? st.bg : "var(--bg-input)", color: selected ? st.color : "var(--text-faint)" }}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={submitQuickAdd}
                      disabled={!quickTitle.trim()}
                      aria-label="Görevi ekle"
                      className="min-h-[48px] sm:min-h-0 w-full sm:w-11 sm:h-11 flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all disabled:opacity-40"
                      style={GLOW_ACTIVE_STYLE}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="sm:hidden text-[13px]">Ekle</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Aktif günün görev listesi — minimalist satır-form, AYNI ZAMANDA
                  canlı önizleme (eklenen her görev burada anında görünür). */}
              <div className="flex flex-col gap-2.5">
                {activeTasks.length === 0 && (
                  <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: "var(--border-default)" }}>
                    <p className="text-[12.5px] text-[var(--text-faint)]">
                      {activeDay}. gün için henüz görev yok — yukarıdaki hızlı ekle formunu kullan.
                    </p>
                  </div>
                )}
                {activeTasks.map((t) => (
                  <div key={t.localId} className="glass rounded-2xl p-3 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => updateTask(t.localId, { title: e.target.value })}
                        placeholder="Görev başlığı..."
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                      />
                      <button
                        onClick={() => removeTask(t.localId)}
                        aria-label="Görevi sil"
                        className="shrink-0 w-11 h-11 md:w-7 md:h-7 rounded-lg flex items-center justify-center text-[var(--text-faint)] hover:text-[#FF6E92] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg px-2 min-h-[40px] md:min-h-0 md:py-1" style={{ background: "var(--bg-input)" }}>
                        <span className="text-[10.5px] text-[var(--text-faint)]">⏱</span>
                        <input
                          type="number"
                          min={0}
                          value={t.duration_min ?? ""}
                          onChange={(e) => updateTask(t.localId, { duration_min: e.target.value ? Number(e.target.value) : null })}
                          placeholder="dk"
                          className="w-12 bg-transparent outline-none text-[12px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                        />
                      </div>

                      {isVacation && (
                        <div className="flex items-center gap-1 rounded-lg px-2 min-h-[40px] md:min-h-0 md:py-1" style={{ background: "var(--bg-input)" }}>
                          <span className="text-[10.5px] text-[var(--text-faint)]">🏷️</span>
                          <input
                            type="text"
                            value={t.estimated_cost ?? ""}
                            onChange={(e) => updateTask(t.localId, { estimated_cost: e.target.value || null })}
                            placeholder="Bütçe (ör. 200 TL)"
                            className="w-24 bg-transparent outline-none text-[12px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        {PRIORITIES.map((p) => {
                          const selected = t.priority === p;
                          const st = PRIORITY_STYLE[p];
                          return (
                            <button
                              key={p}
                              onClick={() => updateTask(t.localId, { priority: selected ? null : p })}
                              className="min-h-[40px] md:min-h-0 text-[10.5px] font-semibold px-2.5 md:px-2 md:py-1 rounded-full transition-colors"
                              style={{ background: selected ? st.bg : "var(--bg-input)", color: selected ? st.color : "var(--text-faint)" }}
                            >
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

        {/* Alt — sabit footer. <lg'de yalnızca 2. adımda "Kaydet" görünür
            (1. adımda yerini yukarıdaki "Görevlere Geç" alıyor); lg+'da
            her zaman görünür. */}
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
          <div className="min-w-0">
            {error && <p className="text-[12px] font-medium truncate" style={{ color: "#FF6E92" }}>{error}</p>}
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

// TASARIM NOTLARI:
// - Çoklu-neon blob'lar BackgroundScene.jsx/GlobalStyles.jsx'teki KURULU
//   `.bg-blob` sınıfını (position/border-radius/blur(70px)/opacity:var(--blob-opacity)
//   /will-change) OLDUĞU GİBİ kullanır — yalnızca `background` (radial-gradient)
//   ve `animation` inline override edilir. Bu sayede tema geçişi (koyu 0.32 /
//   açık 0.18 opaklık) SIFIR EK KOD ile otomatik doğru çalışır.
// - Aktif/seçili kontroller (gün sayısı, gün sekmeleri, Kaydet, hızlı-ekle "+")
//   artık `GLOW_ACTIVE_STYLE` ile AYNI magenta→violet→camgöbeği gradyanını ve
//   çift-renkli glow box-shadow'unu paylaşıyor — "illuminated" bir kontrol
//   ailesi hissi. Öncelik (Yüksek/Orta/Düşük) rozetleri BİLEREK bu paletin
//   DIŞINDA bırakıldı — onlar ayrı bir semantik sistem (kırmızı/amber/yeşil),
//   neon paletle karıştırılması bilgiyi belirsizleştirirdi.
// - Glass yüzeyler (.glass sınıfı, quick-add kutusu + görev satırları + sol
//   sütun kartı) zaten projenin KURULU backdrop-blur/tema sistemini kullanıyor
//   — açık temada "modern cam efekti" bunun üzerinden otomatik geliyor, ayrı
//   bir light-mode dalı YAZILMADI.
