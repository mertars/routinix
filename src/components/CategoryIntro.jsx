import { CATEGORIES, CATEGORY_KEYS, MIN_GOAL_LENGTH, LOADING_MESSAGES } from "../constants";

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
          <h2 className="text-[16.5px] font-bold tracking-tight mb-1.5 text-[#ECF2F4]">{LOADING_MESSAGES[2]}</h2>
          <p className="text-[12.5px] text-[#55636F]">Uzman şapkası giyiliyor, biraz sürebilir...</p>
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
          <h2 className="text-[19px] font-bold text-[#ECF2F4] mb-2 text-balance">Bir şeyler ters gitti</h2>
          <p className="text-sm text-[#8695A3] max-w-[300px] leading-relaxed mx-auto">{errorMsg}</p>
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

  // stage === "intro"
  return (
    <div className="flex flex-col gap-7 animate-[fadeIn_0.35s_ease]">
      {/* Kayıtlı planlar */}
      {savedPlans.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#55636F] mb-3">Planlarım</p>
          <div className="flex flex-col gap-2.5">
            {savedPlans.map((p) => {
              const cat = CATEGORIES[p.mode] || CATEGORIES.general;
              return (
                <button
                  key={p.id}
                  onClick={() => onOpenSavedPlan(p.id)}
                  className="w-full text-left rounded-2xl border p-4 flex items-center gap-3 transition-colors hover:bg-[#141B23]"
                  style={{ borderColor: "#232C36", background: "#12181F" }}
                >
                  <span className="text-lg shrink-0">{cat.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-[#ECF2F4] truncate">{p.title || "Plan"}</div>
                    <div className="text-[11.5px] text-[#8695A3] truncate">{cat.label}</div>
                  </div>
                  <span className="text-[15px] shrink-0" style={{ color: "#55636F" }}>›</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-balance text-[#ECF2F4]">
          Hedefini söyle, uzman
          <br />
          planını çıkarsın.
        </h1>
        <p className="mt-2 text-sm text-[#8695A3] leading-relaxed">Önce bir alan seç, sonra hedefini yaz.</p>
      </div>

      {/* Kategori kartları */}
      <div className="grid grid-cols-2 gap-3">
        {CATEGORY_KEYS.map((key) => {
          const c = CATEGORIES[key];
          const active = key === category;
          return (
            <button
              key={key}
              onClick={() => onCategoryChange(key)}
              className="relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left border transition-all duration-200"
              style={{
                borderColor: active ? c.accent : "#232C36",
                background: active ? c.accentSoft : "#12181F",
                boxShadow: active ? `0 0 0 1px ${c.accent}` : "none",
              }}
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-[13px] font-semibold leading-snug text-[#ECF2F4]">{c.label}</span>
              <span className="text-[11px] text-[#8695A3] leading-snug">{c.tagline}</span>
              {active && <span className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: c.accent }} />}
            </button>
          );
        })}
      </div>

      {/* Hedef */}
      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#55636F] mb-2">Hedefin</label>
        <div
          className="rounded-2xl border p-4 transition-colors duration-200"
          style={{ borderColor: goalTooShort ? "#F0B37E" : "#232C36", background: "#12181F" }}
        >
          <textarea
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder={mode.placeholder}
            rows={3}
            className="w-full bg-transparent resize-none outline-none text-[15px] text-[#ECF2F4] placeholder:text-[#4A5761] leading-relaxed"
          />
        </div>
        {goalTooShort && (
          <p className="mt-2 text-[11.5px] font-medium" style={{ color: "#F0B37E" }}>
            Hedefini biraz daha açık yaz — en az {MIN_GOAL_LENGTH} karakter gerekli.
          </p>
        )}
        <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-400">
          <span className="shrink-0">💡</span>
          <span>
            Devam edince yapay zeka sana <b>hedefine özel birkaç soru</b> soracak; cevaplarına göre kişiselleştirilmiş
            bir plan üretecek.
          </span>
        </p>
      </div>

      <button
        onClick={onStart}
        disabled={!canStart}
        className="w-full rounded-2xl py-3.5 text-[15px] font-semibold transition-all duration-200 disabled:opacity-40"
        style={{ background: canStart ? mode.accent : "#1A222B", color: canStart ? "#0A0E13" : "#55636F" }}
      >
        Devam Et
      </button>
    </div>
  );
}
