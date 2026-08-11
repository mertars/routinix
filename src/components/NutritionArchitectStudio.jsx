import { useState } from "react";
import { X, ChefHat, Dumbbell, Flame, Info, Droplet, Shuffle, RotateCcw } from "lucide-react";
import { MONO_FONT } from "../constants";
import { generateNutritionArchitecture } from "../services/aiPipelineService";
import logger from "../utils/logger";

// ROUTINIX_CORE_ARCHITECT_v2 — "Sistem & Beslenme Mimarı" stüdyosu.
// PomodoroStudio/RhythmStudio ile AYNI tam-ekran shell deseni (fixed
// inset-0 z-[90], üst bar + kaydırılabilir gövde). Fitness kategorisinin
// kendi aksanını (#F4406B) kullanır — bu özellik doğrudan o kategorinin
// bir uzantısı.
const ACCENT = "#F4406B";
const ACCENT_SOFT = "rgba(244,64,107,0.14)";

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedanter" },
  { value: "light", label: "Hafif Aktif" },
  { value: "moderate", label: "Orta Aktif" },
  { value: "active", label: "Aktif" },
  { value: "very_active", label: "Çok Aktif" },
];

const GOAL_OPTIONS = [
  { value: "bulk", label: "Kilo Alma (Bulk)" },
  { value: "cut", label: "Kilo Verme (Cut)" },
  { value: "maintain", label: "Koruma" },
];

const BUDGET_OPTIONS = [
  { value: "dusuk", label: "Düşük" },
  { value: "orta", label: "Orta" },
  { value: "yuksek", label: "Yüksek" },
];

const inputCls =
  "input-glow glass w-full rounded-xl px-3.5 py-2.5 bg-transparent outline-none text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]";
const selectCls = inputCls + " [color-scheme:light_dark]";

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, unit, big }) {
  return (
    <div className="rounded-xl px-3.5 py-3 flex flex-col gap-1" style={{ background: "rgba(var(--overlay-rgb),0.05)" }}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-faint)]">{label}</span>
      <span className={`font-bold tabular-nums leading-none ${big ? "text-[24px]" : "text-[17px]"}`} style={{ fontFamily: MONO_FONT, color: "var(--text-primary)" }}>
        {value}
        {unit && <span className="text-[11px] font-semibold ml-1" style={{ color: "var(--text-faint)" }}>{unit}</span>}
      </span>
    </div>
  );
}

// --- v3 DYNAMIC WIDGET ENGINE — her widget_type için BAĞIMSIZ bir render
// fonksiyonu. ArchitectureResult, data.selected_widgets dizisini SIRAYLA
// gezip WIDGET_RENDERERS[widget_type]'ı çağırır — model bir widget'ı hiç
// seçmediyse (ör. liquid_calorie_shake) o kart HİÇ render edilmez, model
// bir günlük antrenman için ayrı ayrı workout_logger seçtiyse her biri
// kendi kartı olarak sırayla görünür.

function MacroTrackerWidget({ data: d }) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4" style={{ color: ACCENT }} strokeWidth={2.25} />
        <h3 className="text-[13.5px] font-bold text-[var(--text-primary)]">Kalori & Makro Sayacı</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard label="Günlük Kalori Hedefi" value={d.target_calories} unit="kcal" big />
        <StatCard label="Protein" value={d.protein_g} unit="g" />
        <StatCard label="Karbonhidrat" value={d.carb_g} unit="g" />
        <StatCard label="Yağ" value={d.fat_g} unit="g" />
      </div>
      {d.water_target_l > 0 && (
        <span
          className="self-start flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full px-2.5 py-1"
          style={{ background: "rgba(56,189,248,0.12)", color: "#38BDF8", fontFamily: MONO_FONT }}
        >
          <Droplet className="w-3 h-3" /> Su Hedefi: {d.water_target_l}L
        </span>
      )}
    </section>
  );
}

function MealPlanCardWidget({ data: d }) {
  const meals = d.meals || [];
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <ChefHat className="w-4 h-4" style={{ color: ACCENT }} strokeWidth={2.25} />
        <h3 className="text-[13.5px] font-bold text-[var(--text-primary)]">Dinamik Öğün Kartları</h3>
      </div>
      {meals.map((meal, i) => (
        <div key={meal.id || i} className="glass rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[13px] font-bold text-[var(--text-primary)]">{meal.name}</h4>
            <div className="flex items-center gap-1.5 shrink-0">
              {meal.calories > 0 && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-faint)", fontFamily: MONO_FONT }}>
                  {meal.calories} kcal
                </span>
              )}
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT, fontFamily: MONO_FONT }}>
                {meal.time}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {(meal.ingredients || []).map((it, j) => (
              <div key={j} className="flex items-center justify-between gap-2 text-[12.5px] rounded-lg px-3 py-2" style={{ background: "rgba(var(--overlay-rgb),0.04)" }}>
                <span className="text-[var(--text-secondary)] font-medium min-w-0 truncate">
                  {it.food} <span className="text-[var(--text-faint)]">· {it.amount}</span>
                </span>
                {(it.protein > 0 || it.carb > 0 || it.fat > 0) && (
                  <span className="shrink-0 text-[11px] font-semibold" style={{ fontFamily: MONO_FONT, color: "var(--text-faint)" }}>
                    P{it.protein || 0} K{it.carb || 0} Y{it.fat || 0}
                  </span>
                )}
              </div>
            ))}
          </div>
          {meal.smart_swap?.length > 0 && (
            <div className="flex flex-col gap-1 pt-2 border-t border-[var(--border-default)]">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--text-faint)]">
                <Shuffle className="w-3 h-3 shrink-0" /> Smart Swap
              </span>
              {meal.smart_swap.map((sw, k) => (
                <p key={k} className="text-[11.5px] text-[var(--text-secondary)]">
                  <b className="text-[var(--text-primary)]">{sw.option}:</b> {sw.desc}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function LiquidCalorieShakeWidget({ data: d }) {
  return (
    <section className="rounded-2xl p-4 sm:p-5 flex flex-col gap-2 border" style={{ background: "rgba(56,189,248,0.06)", borderColor: "rgba(56,189,248,0.3)" }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Droplet className="w-4 h-4 text-sky-400" strokeWidth={2.25} />
          <h3 className="text-[13.5px] font-bold text-[var(--text-primary)]">{d.shake_name || "İştah & Likit Kalori Modülü"}</h3>
        </div>
        {d.total_calories > 0 && (
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-sky-300" style={{ background: "rgba(56,189,248,0.16)", fontFamily: MONO_FONT }}>
            {d.total_calories} kcal
          </span>
        )}
      </div>
      {d.recipe_items?.length > 0 && <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">{d.recipe_items.join(" · ")}</p>}
      {d.prep_time_mins > 0 && <p className="text-[11.5px] font-semibold text-sky-300">⏱ Hazırlık: {d.prep_time_mins} dk</p>}
    </section>
  );
}

function WorkoutLoggerWidget({ data: d }) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="w-4 h-4" style={{ color: ACCENT }} strokeWidth={2.25} />
        <h4 className="text-[13px] font-bold text-[var(--text-primary)]">{d.workout_title}</h4>
      </div>
      <div className="flex flex-col gap-1.5">
        {(d.exercises || []).map((ex, j) => (
          <div key={j} className="rounded-lg px-3 py-2.5 flex flex-col gap-1" style={{ background: "rgba(var(--overlay-rgb),0.04)" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-bold text-[var(--text-primary)]">{ex.name}</span>
              <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT, fontFamily: MONO_FONT }}>
                {ex.sets} × {ex.reps}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold" style={{ fontFamily: MONO_FONT, color: "var(--text-faint)" }}>
              <span>RPE {ex.rpe}</span>
              <span>⏱ {ex.rest_seconds}sn dinlenme</span>
              <span>📈 {ex.overload}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SystemRulesWidget({ data: d }) {
  return (
    <section className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3 border border-[var(--border-default)]" style={{ background: "rgba(var(--overlay-rgb),0.03)" }}>
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4" style={{ color: "var(--amber-accent)" }} strokeWidth={2.25} />
        <h3 className="text-[13.5px] font-bold text-[var(--text-primary)]">Sistem Kuralları</h3>
      </div>
      {d.plateau_rule && (
        <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
          <b className="text-[var(--text-primary)]">Kilo Durması (Plateau):</b> {d.plateau_rule}
        </p>
      )}
      {d.timing_rule && (
        <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
          <b className="text-[var(--text-primary)]">Antrenman Beslenme Zamanlaması:</b> {d.timing_rule}
        </p>
      )}
    </section>
  );
}

const WIDGET_RENDERERS = {
  macro_tracker: MacroTrackerWidget,
  meal_plan_card: MealPlanCardWidget,
  liquid_calorie_shake: LiquidCalorieShakeWidget,
  workout_logger: WorkoutLoggerWidget,
  system_rules: SystemRulesWidget,
};

// Beslenme mimarisi sonucunu render eder — data.selected_widgets dizisini
// SIRAYLA, her widget_type'a uygun bileşenle render eder (bkz. yukarıdaki
// WIDGET_RENDERERS). Tanınmayan bir widget_type (teorik olarak — şema
// enum'la sınırlı, ama savunmacı davranmak ucuz) sessizce atlanır.
function ArchitectureResult({ data }) {
  const widgets = data?.selected_widgets || [];
  return (
    <div className="flex flex-col gap-6">
      {widgets.map((w, i) => {
        const Renderer = WIDGET_RENDERERS[w.widget_type];
        if (!Renderer) return null;
        return <Renderer key={i} data={w.data || {}} />;
      })}
    </div>
  );
}

export default function NutritionArchitectStudio({ open, onClose }) {
  const [stage, setStage] = useState("form"); // form | loading | result | error
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);

  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [goal, setGoal] = useState("bulk");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [budgetLevel, setBudgetLevel] = useState("orta");
  const [allergiesText, setAllergiesText] = useState("");

  if (!open) return null;

  const canSubmit = weightKg && heightCm && Number(weightKg) > 0 && Number(heightCm) > 0;

  const handleGenerate = async () => {
    if (!canSubmit || stage === "loading") return;
    setStage("loading");
    setErrorMsg("");
    try {
      const data = await generateNutritionArchitecture({
        weight_kg: Number(weightKg),
        height_cm: Number(heightCm),
        body_fat_pct: bodyFatPct ? Number(bodyFatPct) : undefined,
        activity_level: activityLevel,
        goal,
        wake_time: wakeTime,
        sleep_time: sleepTime,
        budget_level: budgetLevel,
        allergies: allergiesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setResult(data);
      setStage("result");
    } catch (err) {
      logger.error("NUTRITION_ARCHITECT", "Üretim başarısız", { error: err?.message });
      setErrorMsg(err?.message || "Bir sorun oluştu, tekrar dener misin?");
      setStage("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: "var(--bg-app)" }}>
      <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-5 pb-3 flex items-center justify-between gap-2 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <ChefHat className="w-5 h-5 shrink-0" style={{ color: ACCENT }} strokeWidth={2.25} />
          <h2 className="text-[17px] font-bold text-[var(--text-primary)] whitespace-nowrap">Beslenme & Antrenman Mimarı</h2>
        </div>
        <div className="flex items-center gap-2">
          {stage === "result" && (
            <button
              onClick={() => setStage("form")}
              className="flex items-center gap-1.5 rounded-full px-3 h-9 text-[11.5px] font-bold transition-colors"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.25} /> Yeniden Oluştur
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            style={{ background: "rgba(var(--overlay-rgb),0.05)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-mobile-safe">
          {stage === "form" && (
            <div className="flex flex-col gap-5">
              <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed">
                Fiziksel verilerini gir — sana özel, milimetrik hesaplanmış kalori/makro hedefi, öğün planı (alternatifleriyle) ve antrenman programı üretelim.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Kilo (kg)">
                  <input type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="75" className={inputCls} />
                </Field>
                <Field label="Boy (cm)">
                  <input type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="178" className={inputCls} />
                </Field>
                <Field label="Yağ Oranı (%)">
                  <input type="number" inputMode="decimal" value={bodyFatPct} onChange={(e) => setBodyFatPct(e.target.value)} placeholder="opsiyonel" className={inputCls} />
                </Field>
                <Field label="Aktivite Seviyesi">
                  <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)} className={selectCls}>
                    {ACTIVITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Hedef">
                  <select value={goal} onChange={(e) => setGoal(e.target.value)} className={selectCls}>
                    {GOAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Bütçe">
                  <select value={budgetLevel} onChange={(e) => setBudgetLevel(e.target.value)} className={selectCls}>
                    {BUDGET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Uyanış Saati">
                  <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={inputCls + " [color-scheme:light_dark]"} />
                </Field>
                <Field label="Uyku Saati">
                  <input type="time" value={sleepTime} onChange={(e) => setSleepTime(e.target.value)} className={inputCls + " [color-scheme:light_dark]"} />
                </Field>
                <div className="col-span-2 sm:col-span-1">
                  <Field label="Alerjiler (virgülle ayır)">
                    <input type="text" value={allergiesText} onChange={(e) => setAllergiesText(e.target.value)} placeholder="laktoz, yer fıstığı..." className={inputCls} />
                  </Field>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={!canSubmit}
                className="rounded-xl py-3 text-[13.5px] font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: ACCENT, color: "#0A0E13" }}
              >
                Sistemimi Oluştur
              </button>
            </div>
          )}

          {stage === "loading" && (
            <div className="flex flex-col items-center text-center gap-4 pt-16">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 opacity-20" style={{ borderColor: ACCENT }} />
                <div className="absolute inset-0 rounded-full border-2 border-transparent motion-safe:animate-spin" style={{ borderTopColor: ACCENT, animationDuration: "0.9s" }} />
              </div>
              <p className="text-[13px] font-semibold text-[var(--text-secondary)]">Metabolizman hesaplanıyor, öğün ve antrenman mimarisi kuruluyor...</p>
            </div>
          )}

          {stage === "error" && (
            <div className="flex flex-col items-center text-center gap-4 pt-16">
              <p className="text-[13px] font-semibold text-[var(--text-secondary)] max-w-[340px]">{errorMsg}</p>
              <button onClick={() => setStage("form")} className="rounded-xl px-5 py-2.5 text-[12.5px] font-bold" style={{ background: ACCENT, color: "#0A0E13" }}>
                Geri Dön
              </button>
            </div>
          )}

          {stage === "result" && result && <ArchitectureResult data={result} />}
        </div>
      </div>
    </div>
  );
}
