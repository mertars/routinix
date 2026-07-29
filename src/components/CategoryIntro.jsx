import { useState } from "react";
import { CATEGORIES, CATEGORY_KEYS, MIN_GOAL_LENGTH, TEMPLATE_CHIPS } from "../constants";

// Giriş ekranı: kategori (persona) seçimi + hedef, "Planlarım" listesi ve
// yükleme/hata durumları. "Devam Et" ile dinamik onboarding sihirbazına geçilir.
export default function CategoryIntro({
  stage,
  category,
  goal,
  goalTooShort,
  canStart,
  savedPlans,
  onCategoryChange,
  onGoalChange,
  onStart,
  onOpenSavedPlan,
  errorMsg,
  onBackToIntro,
}) {
  const mode = CATEGORIES[category] || CATEGORIES.general;
  const [pulse, setPulse] = useState(false);

  // Şablon çipi: kategori + hedefi doldurur, kısa bir parıltı animasyonu tetikler.
  const applyTemplate = (chip) => {
    onCategoryChange(chip.category);
    onGoalChange(chip.goal);
    setPulse(false);
    requestAnimationFrame(() => setPulse(true));
    setTimeout(() => setPulse(false), 650);
  };

  if (stage === "loading") {
    return (
      <div className="flex flex-col items-center text-center gap-6 pt-24 animate-[fadeIn_0.3s_ease]">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 opacity-20" style={{ borderColor: mode.accent }} />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent motion-safe:animate-spin"
            style={{ borderTopColor: mode.accent, animationDuration: "0.9s" }}
          />
          <span className="text-2xl">{mode.emoji}</span>
        </div>
        <div>
          <h2 className="text-[16.5px] font-bold tracking-tight mb-1.5 text-[var(--text-primary)]">Routinix odağını yapılandırıyor...</h2>
          <p className="text-[12.5px] text-[var(--text-faint)]">Sana özel performans çerçeven hazırlanıyor, biraz sürebilir.</p>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex flex-col items-center text-center gap-5 pt-20 animate-[fadeIn_0.4s_ease]">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "rgba(240,150,80,0.12)" }}>
          🤔
        </div>
        <div>
          <h2 className="text-[19px] font-bold text-[var(--text-primary)] mb-2 text-balance">Bir şeyler ters gitti</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-[300px] leading-relaxed mx-auto">{errorMsg}</p>
        </div>
        <button
          onClick={onBackToIntro}
          className="mt-2 rounded-2xl px-6 py-3 text-[14.5px] font-semibold"
          style={{ background: mode.accent, color: "#0A0E13" }}
        >
          Geri Dön
        </button>
      </div>
    );
  }

  // stage === "intro" — mobilde tek ekrana kilitli (justify-between), md'den serbest.
  return (
    <div className="flex flex-col h-full md:h-auto md:gap-8 animate-[fadeIn_0.35s_ease]">
      {/* ÜST GRUP: kayıtlı planlar (kompakt strip) + hero başlık */}
      <div className="shrink-0 flex flex-col gap-4 md:gap-6">
        {savedPlans.length > 0 && (
          <div className="edge-fade-x -mx-4 md:-mx-6 px-4 md:px-6 flex gap-2 overflow-x-auto no-scrollbar">
            {savedPlans.map((p) => {
              const cat = CATEGORIES[p.mode] || CATEGORIES.general;
              return (
                <button
                  key={p.id}
                  onClick={() => onOpenSavedPlan(p.id)}
                  className="glass shrink-0 flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 hover:border-slate-300 dark:hover:border-white/20 transition-colors card-glow"
                >
                  <span className="text-[13px]">{cat.emoji}</span>
                  <span className="text-[11.5px] font-medium text-[var(--text-secondary)] max-w-[130px] truncate">{p.title || "Plan"}</span>
                </button>
              );
            })}
          </div>
        )}

        <div>
          <h1 className="text-2xl md:text-5xl font-bold leading-[1.12] tracking-tight text-balance">
            <span
              style={{
                background: "var(--hero-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Hedefini tanımla, disiplinini yapılandıralım.
            </span>
          </h1>
          <p className="mt-2 md:mt-3 text-sm md:text-lg text-[var(--text-muted)] leading-relaxed md:max-w-2xl">
            Önce odak alanını seç, sonra hedefini net bir şekilde yaz.
          </p>
        </div>
      </div>

      {/* ORTA GRUP: 4'lü odak kartları — mobilde dikey alanı doldurur */}
      <div className="flex-1 min-h-0 flex items-center md:flex-none md:block py-3 md:py-0">
        <div className="w-full grid grid-cols-2 gap-2.5 md:gap-5">
          {CATEGORY_KEYS.map((key) => {
            const c = CATEGORIES[key];
            const active = key === category;
            return (
              <button
                key={key}
                onClick={() => onCategoryChange(key)}
                className="category-card group relative flex flex-col items-start gap-1.5 md:gap-3 rounded-2xl p-3.5 md:p-6 text-left transition-all duration-200 card-glow"
                style={{
                  borderColor: active ? c.accent : undefined,
                  background: active ? `${c.accent}1f` : undefined,
                  boxShadow: active ? `0 0 0 2px ${c.accent}, 0 10px 40px -18px ${c.accent}` : undefined,
                }}
              >
                <span className="text-2xl md:text-3xl">{c.emoji}</span>
                <span className="text-sm md:text-lg font-semibold leading-snug text-[var(--text-primary)]">{c.label}</span>
                <span className="text-[11px] md:text-sm text-[var(--text-muted)] leading-snug line-clamp-2 md:line-clamp-none">
                  {c.tagline}
                </span>
                {active && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: c.accent, boxShadow: `0 0 8px ${c.accent}` }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ALT GRUP: şablon çipleri + hedef giriş çubuğu + Başla */}
      <div className="shrink-0 pt-2 md:pt-0">
        {/* Akıllı şablon çipleri — yatay kaydırılabilir */}
        <div className="edge-fade-x -mx-4 md:-mx-6 px-4 md:px-6 mb-2.5 flex gap-2 overflow-x-auto no-scrollbar">
          {TEMPLATE_CHIPS.map((chip) => {
            const c = CATEGORIES[chip.category] || CATEGORIES.general;
            return (
              <button
                key={chip.label}
                onClick={() => applyTemplate(chip)}
                className="glass shrink-0 flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors card-glow"
                style={{ borderColor: `${c.accent}33` }}
              >
                <span className="text-[12px]">{chip.emoji}</span>
                {chip.label}
              </button>
            );
          })}
        </div>

        <label className="block text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-[var(--text-faint)] mb-1.5 md:mb-2">
          Hedefin
        </label>
        <div
          className={`input-glow glass flex items-center gap-2 rounded-2xl p-2 md:p-2.5 ${pulse ? "chip-fill-pulse" : ""}`}
          style={{ borderColor: goalTooShort ? "var(--amber-accent)" : "rgba(var(--overlay-rgb),0.10)" }}
        >
          <input
            type="text"
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canStart && onStart()}
            placeholder="Örn: 3 ayda full-stack geliştirici ol..."
            className="flex-1 min-w-0 bg-transparent outline-none text-sm md:text-base text-[var(--text-primary)] placeholder:text-[var(--placeholder)] px-2.5"
          />
          <button
            onClick={onStart}
            disabled={!canStart}
            className="shrink-0 rounded-xl px-5 md:px-7 py-2.5 md:py-3 text-sm md:text-base font-semibold transition-all duration-200 disabled:opacity-40"
            style={{ background: canStart ? mode.accent : "var(--disabled-bg)", color: canStart ? "#0b0c10" : "var(--text-faint)" }}
          >
            Başla
          </button>
        </div>
        {goalTooShort && (
          <p className="mt-1.5 text-[11px] font-medium" style={{ color: "var(--amber-accent)" }}>
            Hedefini biraz daha açık yaz — en az {MIN_GOAL_LENGTH} karakter gerekli.
          </p>
        )}
      </div>
    </div>
  );
}
