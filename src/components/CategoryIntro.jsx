import { useState } from "react";
import { Wand2 } from "lucide-react";
import { CATEGORIES, CATEGORY_KEYS, MIN_GOAL_LENGTH, TEMPLATE_CHIPS } from "../constants";
import { getPromptSuggestions } from "../utils/promptSuggestions";
import DashboardHeader from "./DashboardHeader";

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
  onOpenManualBuilder,
  extraNote,
  onExtraNoteChange,
}) {
  const mode = CATEGORIES[category] || CATEGORIES.general;
  const [pulse, setPulse] = useState(false);
  const suggestions = getPromptSuggestions(category);

  // Öneri çipine tıklanınca metni extraNote'a EKLER (üzerine yazmaz) — kutu
  // zaten doluysa aralarına bir boşluk/nokta ile ayrılmış olarak eklenir.
  const appendSuggestion = (text) => {
    const trimmed = (extraNote || "").trim();
    onExtraNoteChange(trimmed ? `${trimmed} ${text}` : text);
  };

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

  // stage === "intro" — mobilde artık KATI "tek ekrana kilitli" DEĞİL: kartlar
  // 1 sütuna geçtiğinden (bkz. ORTA GRUP) içerik eskisinden ÇOK daha uzun —
  // `overflow-y-auto` BURADA (kök seviyede, iç içe/ayrı bir kaydırma kutusu
  // DEĞİL) TEK, doğal bir kaydırma alanı sağlar; app.jsx'teki dış kabuk
  // (`h-[100dvh] overflow-hidden`, intro-benzeri aşamalar için) DEĞİŞMEDİ —
  // bu, o sabit-yükseklikli kabuğun İÇİNDE kayan TEK bölge.
  return (
    <div className="flex flex-col h-full overflow-y-auto md:h-auto md:overflow-visible md:gap-8 animate-[fadeIn_0.35s_ease]">
      {/* ÜST GRUP: kayıtlı planlar (kompakt strip) + hero başlık */}
      <div className="shrink-0 flex flex-col gap-4 md:gap-6">
        {savedPlans.length > 0 && (
          <div className="edge-fade-x -mx-4 md:-mx-6 px-4 md:px-6 flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap py-2 w-full">
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

        <DashboardHeader />
      </div>

      {/* ORTA GRUP: odak kartları. Orijinal tasarım geri getirildi — mobilde
          (<640px) DAİMA 2 sütun (`grid-cols-2`). Kartlar sıkıştırıldı
          (`p-3`, küçültülmüş font/ikon boyutları, `min-h-[100px]`) ki 2
          sütuna rağmen ekrana rahat sığsın; metin taşarsa `line-clamp-2`
          kesiyor. `h-auto` (sabit yükseklik YOK) hâlâ korunuyor — bir kart
          diğerinden uzun olsa da komşu kartların üstüne BİNMEZ, sadece o
          satırın yüksekliği büyür. */}
      <div className="shrink-0 py-3 md:py-0">
        <div data-tour-id="tour-category-cards" className="relative w-full grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-5">
          {CATEGORY_KEYS.map((key) => {
            const c = CATEGORIES[key];
            const active = key === category;
            return (
              <button
                key={key}
                onClick={() => onCategoryChange(key)}
                className="category-card group relative h-auto min-h-[100px] flex flex-col items-center justify-center gap-1 md:gap-3 rounded-2xl p-3 md:p-6 text-center transition-all duration-200 card-glow"
                style={{
                  borderColor: active ? c.accent : undefined,
                  background: active ? `${c.accent}1f` : undefined,
                  boxShadow: active ? `0 0 0 2px ${c.accent}, 0 10px 40px -18px ${c.accent}` : undefined,
                }}
              >
                <span className="text-xl md:text-3xl">{c.emoji}</span>
                <span className="text-[13px] md:text-lg font-semibold leading-snug text-[var(--text-primary)]">{c.label}</span>
                <span className="text-[10px] md:text-sm text-[var(--text-muted)] leading-snug line-clamp-2 md:line-clamp-none">
                  {c.tagline}
                </span>
                {active && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: c.accent, boxShadow: `0 0 8px ${c.accent}` }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* "Kendi Planını Hazırla" — grid'den TAMAMEN bağımsız, viewport'a göre
          `fixed` bir FAB (Floating Action Button): içerik ne kadar uzarsa
          uzasın asla kartlarla ÇAKIŞAMAZ.
          KONUM NOTU: istenen köşe sağ alt (`right-6`) — AMA o köşenin tam
          `bottom-6` noktası UYGULAMA GENELİNDE zaten AiCoachWidget.jsx'in
          kalıcı "AI Koç" baloncuğu tarafından kullanılıyor (aynı `right:
          1.5rem, bottom: 1.5rem`, w-14 h-14, z-40) — piksel piksel aynı yere
          konsaydı ikisi tam üst üste biner, biri diğerini tıklanamaz hale
          getirirdi. Bunun yerine AYNI köşede, AI Koç baloncuğunun HEMEN
          ÜSTÜNE istiflendi (`bottom-24 right-6`) — "sağ alt köşede sabit
          buton" niyeti birebir korunuyor, sadece iki buton dikeyde ayrışıyor. */}
      <div className="fixed bottom-24 right-6 z-50">
        <div className="group/manual relative flex items-center justify-center">
          {/* onOpenManualBuilder() ARGÜMANSIZ çağrılmalı — bare `onClick=
              {onOpenManualBuilder}` React'in SyntheticEvent'ini 1. argüman
              (planId) olarak sızdırır; usePlanStudio.openManualBuilder bunu
              "düzenlenecek plan id'si" sanıp fetchPlanDetail'i geçersiz bir
              değerle çağırır — builder hiç açılmadan kısa bir yükleniyor
              ekranından sonra sessizce başarısız olur. */}
          <button
            data-tour-id="tour-manual-plan-button"
            onClick={() => onOpenManualBuilder()}
            aria-label="Kendi Planını Hazırla"
            className="relative w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #FF007F, #B026FF 55%, #00F3FF)",
              boxShadow: "0 8px 28px -8px rgba(255,0,127,0.65), 0 0 22px -6px rgba(0,243,255,0.55)",
            }}
          >
            {/* Hover'da neon pulse halkası — AiCoachWidget tetikleyicisindeki
                "canlı durum noktası" ping deseniyle AYNI teknik. */}
            <span className="absolute inset-0 rounded-full motion-safe:group-hover/manual:animate-ping opacity-0 group-hover/manual:opacity-60" style={{ background: "#FF007F" }} />
            <Wand2 className="relative w-4 h-4 md:w-5 md:h-5 text-white drop-shadow-sm" strokeWidth={2.25} />
          </button>

          {/* Tooltip/label — yalnızca hover'da (masaüstü). Buton artık sağ
              kenara yakın (`right-6`) olduğundan, eskiden kullanılan `left-0`
              ankraj tooltip'i sağa doğru büyütüp viewport dışına taşırırdı —
              `right-0` ile SOLA doğru büyüyecek şekilde çevrildi. */}
          <div
            className="absolute bottom-full mb-2 right-0 pointer-events-none opacity-0 translate-y-1 group-hover/manual:opacity-100 group-hover/manual:translate-y-0 transition-all duration-200 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold hidden md:block"
            style={{
              background: "rgba(var(--glass-rgb), var(--alpha-modal))",
              backdropFilter: "blur(16px) saturate(160%)",
              WebkitBackdropFilter: "blur(16px) saturate(160%)",
              border: "1px solid var(--modal-border)",
              color: "var(--text-primary)",
            }}
          >
            ✨ Kendi Planını Hazırla
          </div>
        </div>
      </div>

      {/* ALT GRUP: şablon çipleri + hedef giriş çubuğu + Başla */}
      <div className="shrink-0 pt-2 md:pt-0">
        {/* Akıllı şablon çipleri — yatay kaydırılabilir, ana başlıktan
            (DashboardHeader/kategori kartları) AYRI bir grup; whitespace-nowrap
            + shrink-0 (her çip zaten taşıyor) satır içi sarılmayı KESİN olarak
            engeller. `my-3` hem üstteki kartlardan hem alttaki "Hedefin"
            girişinden net bir boşlukla ayırır, ikisi de üzerine binmez. */}
        <div className="edge-fade-x -mx-4 md:-mx-6 px-4 md:px-6 py-2 my-3 flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap w-full">
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

        {/* Dinamik "Ek İstek / Soru" Alanı (Smart Prompt Assistant) —
            extraNote zaten usePlanStudio.finalizeAndGenerate tarafından AI
            bağlamına ekleniyordu (bkz. "Ek notlar / özel istekler" satırı),
            ama hiçbir ekranda GERÇEK bir giriş alanı YOKTU — burada eklendi.
            Kategoriye göre mikro rehber/placeholder/öneri çipleri değişir
            (bkz. utils/promptSuggestions.js). */}
        {onExtraNoteChange && (
          // w-full max-w-full: bu kapsayıcı BAZ genişliği aşıp mobilde
          // sağdan/soldan taşmasın diye açıkça sınırlanır (textarea zaten
          // w-full'du ama sarmalayıcının kendisi sınırsızdı; çip satırı
          // flex-wrap olduğundan taşmaz ama kapsayıcı yine de netleştirildi).
          <div className="mt-3 md:mt-4 w-full max-w-full">
            <label className="block text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-[var(--text-faint)] mb-1">
              Eklemek istediğin bir şey var mı?
            </label>
            <p className="text-[11px] text-[var(--text-faint)] mb-1.5 leading-relaxed">{suggestions.guide}</p>
            <textarea
              value={extraNote || ""}
              onChange={(e) => onExtraNoteChange(e.target.value)}
              placeholder={suggestions.placeholder}
              rows={2}
              className="input-glow glass w-full max-w-full rounded-2xl p-3 bg-transparent outline-none resize-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)] leading-relaxed"
              style={{ borderColor: "rgba(var(--overlay-rgb),0.10)" }}
            />
            <div className="mt-2 flex flex-wrap gap-1.5 w-full max-w-full">
              {suggestions.chips.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => appendSuggestion(chip.insertText)}
                  className="rounded-full pl-2.5 pr-2.5 h-7 text-[11px] font-semibold transition-colors"
                  style={{ background: "rgba(6,182,212,0.14)", color: "#06B6D4", border: "1px solid rgba(6,182,212,0.35)" }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
