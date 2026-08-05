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
// RESPONSIVE MİMARİ: Masaüstünde (md+) tam ekran, TEK sayfalık akış (Gün
// Sayısı + Editör aynı anda görünür/kaydırılabilir). Mobilde ekranın
// ALTINDAN yükselen bir BottomSheet'e dönüşür (max-h-[90vh], rounded-t-3xl)
// VE iki ADIMA bölünür (1: başlık+gün sayısı, 2: gün gün editör) — dar
// ekranda ikisini AYNI ANDA göstermek sıkışıklığa yol açardı. Adım geçişi
// SALT CSS/görünürlük ile yönetilir (`mobileStep` yalnızca <md ekranlarda
// etkilidir, md+ her ikisi de `md:!block` ile ZORLA görünür kalır) — ayrı
// bir mobil/masaüstü bileşen kopyası GEREKMEZ.
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
  const [mobileStep, setMobileStep] = useState(1); // yalnızca <md ekranlarda anlamlı

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
          kapatan bir katman gerekir. Masaüstünde builder ZATEN tam ekran
          olduğundan bu katmana gerek yok (md:hidden). */}
      <div className="fixed inset-0 z-[109] bg-black/60 backdrop-blur-sm md:hidden" onClick={onClose} />

      <div
        className="fixed inset-x-0 bottom-0 z-[110] max-h-[90vh] rounded-t-3xl flex flex-col animate-[slideUpSheet_0.3s_ease] md:inset-0 md:max-h-none md:rounded-none md:animate-[fullScreenIn_0.25s_ease]"
        style={{ background: "var(--bg-app)" }}
      >
        {/* Sürükleme tutamacı — yalnızca mobil BottomSheet'te anlamlı. */}
        <div className="shrink-0 pt-2.5 pb-1 flex justify-center md:hidden">
          <div className="w-10 h-1.5 rounded-full" style={{ background: "var(--border-strong)" }} />
        </div>

        {/* Üst neon şerit — kategori aksanından merkez butonun magenta→camgöbeği
            gradyanına geçiş, "bu manuel bir akış" kimliğini üstte de taşır. */}
        <div className="h-[3px] shrink-0 hidden md:block" style={{ background: "linear-gradient(90deg, #FF007F, #B026FF, #00F3FF)" }} />

        {/* Başlık */}
        <div className="shrink-0 px-4 md:px-8 pt-2 md:pt-5 pb-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: "var(--border-default)" }}>
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
                {cat.label} · {mobileStep === 1 ? "1/2 · Süre" : "2/2 · Görevler"}
                <span className="hidden md:inline"> · elle oluşturulan plan, yapay zeka kullanılmaz</span>
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

        {/* Gövde — kaydırılabilir */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-5 md:py-7">
          <div className="max-w-3xl mx-auto flex flex-col gap-7">
            {/* ADIM 1 (mobilde tek başına görünür) — Başlık + Gün Sayısı */}
            <section className={mobileStep === 1 ? "block" : "hidden md:block"}>
              <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] mb-2" style={{ fontFamily: MONO_FONT }}>
                Plan Başlığı
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Kendi Disiplin Rutinim"
                className="input-glow glass w-full rounded-2xl px-4 py-3.5 md:py-3 text-[14.5px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)] outline-none mb-5"
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
                      className="min-h-[48px] md:min-h-0 rounded-full px-4 md:py-2 text-[13px] font-semibold transition-all duration-150 border"
                      style={{
                        borderColor: active ? cat.accent : "var(--border-default)",
                        background: active ? cat.accentSoft : "var(--bg-input)",
                        color: active ? cat.accent : "var(--text-secondary)",
                      }}
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
                    className="min-h-[48px] md:min-h-0 rounded-full px-4 md:py-2 text-[13px] font-semibold border transition-colors"
                    style={{
                      borderColor: !DAY_COUNT_CHOICES.includes(totalDays) ? cat.accent : "var(--border-default)",
                      background: !DAY_COUNT_CHOICES.includes(totalDays) ? cat.accentSoft : "var(--bg-input)",
                      color: !DAY_COUNT_CHOICES.includes(totalDays) ? cat.accent : "var(--text-secondary)",
                    }}
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
                      className="min-h-[48px] md:min-h-0 w-20 rounded-full border px-3 md:py-2 text-[13px] text-center outline-none bg-transparent text-[var(--text-primary)]"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-input)" }}
                    />
                    <button
                      onClick={applyCustomDays}
                      className="min-h-[48px] md:min-h-0 rounded-full px-3.5 md:py-2 text-[12.5px] font-semibold"
                      style={{ background: cat.accent, color: "#0b0c10" }}
                    >
                      Uygula
                    </button>
                  </div>
                )}
              </div>

              {/* Mobilde bu adımın "İleri" kontrolü — masaüstünde gizli
                  (orası zaten aşağıdaki editörle aynı ekranda). */}
              <button
                onClick={() => setMobileStep(2)}
                className="md:hidden mt-7 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl text-[14px] font-bold"
                style={{ background: "linear-gradient(90deg, #FF007F, #B026FF, #00F3FF)", color: "#fff" }}
              >
                Görevlere Geç <ChevronRight className="w-4 h-4" />
              </button>
            </section>

            {/* ADIM 2 (mobilde tek başına görünür) — Gün Sekmeleri + Editör */}
            <section className={mobileStep === 2 ? "block" : "hidden md:block"}>
              {/* Mobilde geri dönüş — 1. adıma (gün sayısını değiştirmek için). */}
              <button
                onClick={() => setMobileStep(1)}
                className="md:hidden mb-4 flex items-center gap-1 text-[12.5px] font-semibold min-h-[44px]"
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
                      className="shrink-0 min-h-[48px] md:min-h-0 flex items-center gap-1.5 rounded-xl px-3.5 md:py-2 text-[12.5px] font-semibold transition-all duration-150"
                      style={{
                        background: active ? cat.accent : "rgba(var(--overlay-rgb),0.05)",
                        color: active ? "#0b0c10" : "var(--text-secondary)",
                      }}
                    >
                      {d}. Gün
                      {count > 0 && (
                        <span
                          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9.5px] font-bold"
                          style={{ background: active ? "rgba(11,12,16,0.2)" : cat.accentSoft, color: active ? "#0b0c10" : cat.accent }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Hızlı Görev Ekle — ÖNCEDEN burada kategoriye göre sabit,
                  sıkışık öneri "çip"leri vardı (tek tıkla ekleyen küçük
                  pilller); YERİNE geniş, işlevsel tek satırlık bir form
                  koyuldu — başlık + süre + öncelik + (gezi ise bütçe) +
                  belirgin bir "+" ekle butonu. Enter da gönderir. */}
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
                      style={{ background: cat.accent, color: "#0b0c10" }}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="sm:hidden text-[13px]">Ekle</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Aktif günün görev listesi — minimalist satır-form */}
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

        {/* Alt — sabit footer. Mobilde yalnızca 2. adımda "Kaydet" görünür
            (1. adımda yerini yukarıdaki "Görevlere Geç" alıyor); masaüstünde
            her zaman görünür. */}
        <div
          className={`shrink-0 px-4 md:px-8 py-4 items-center justify-between gap-3 border-t ${mobileStep === 2 ? "flex" : "hidden md:flex"}`}
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
            className="shrink-0 flex items-center gap-2 rounded-2xl px-6 min-h-[48px] md:py-3 text-[14px] font-bold transition-all disabled:opacity-60"
            style={{
              background: "linear-gradient(90deg, #FF007F, #B026FF, #00F3FF)",
              color: "#fff",
              boxShadow: "0 8px 28px -10px rgba(255,0,127,0.6)",
            }}
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
