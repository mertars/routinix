import { useState, useEffect } from "react";
import { Wand2, MessageSquarePlus, X } from "lucide-react";
import { CATEGORIES, CATEGORY_KEYS, MIN_GOAL_LENGTH, TEMPLATE_CHIPS } from "../constants";
import { getPromptSuggestions } from "../utils/promptSuggestions";
import { fetchPlanUsage } from "../services/entitlementsService";
import DashboardHeader from "./DashboardHeader";

// Giriş ekranı: kategori (persona) seçimi + hedef, "Planlarım" listesi ve
// yükleme/hata durumları. "Devam Et" ile dinamik onboarding sihirbazına geçilir.
export default function CategoryIntro({
  stage,
  userId,
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
  const [extraNoteOpen, setExtraNoteOpen] = useState(false);
  const suggestions = getPromptSuggestions(category);

  // Freemium rozeti — "Plan Hakkı: 2/3". Premium kullanıcılarda gizli.
  const [planUsage, setPlanUsage] = useState(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchPlanUsage(userId).then((u) => !cancelled && setPlanUsage(u));
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  // stage === "intro" — mobilde KESİNLİKLE kaydırma YOK: `h-full overflow-
  // hidden` + `justify-between` üç grubu (ÜST/ORTA/ALT) mevcut yüksekliğe
  // (app.jsx'teki dış kabuk zaten `h-[100dvh]`) eşit aralıklarla yayar.
  // `h-screen` DEĞİL `h-full`/`max-h-full`: bileşen zaten Header/DrawerMenu
  // altındaki `h-[100dvh]` kabuğun İÇİNDE — ham 100vh, Header payını
  // düşmeden kendi yüksekliğini o kadar büyütür, alt kısmı görünmez şekilde
  // kırpardı. Yatay `p-3` BİLEREK eklenmedi: `main` (app.jsx) zaten
  // `px-4 md:px-6 pt-4 md:pt-8 pb-4 md:pb-10` veriyor — üstüne bir p-3 daha
  // eklemek dikeyde tam bu turun amacına (taşmadan sığdırma) ters, yatayda
  // da chip şeritlerinin edge-to-edge kaydırma hizasını bozardı.
  // NOT (masaüstü no-scroll): md: (768-1023px, tablet) BİLEREK eski
  // serbest-akış davranışını (overflow-visible/justify-normal) korur —
  // yalnızca lg: (1024px+, gerçek masaüstü) yeniden mobildeki gibi
  // "yüksekliğe sığdır, taşma yok" moduna döner. Bu, lg: kuralının CSS
  // kaynak sırasında md:'den SONRA gelmesiyle çalışır (Tailwind breakpoint
  // sıralaması) — aynı özgüllükte SONRAKİ kural kazanır. `lg:h-full` (SABİT
  // `lg:h-screen` DEĞİL): app.jsx'teki üst kapsayıcı zaten yalnızca
  // `onIntroLike` iken `lg:h-screen lg:overflow-hidden` oluyor — bu bileşen
  // o ÖNCEDEN doğru boyutlandırılmış kapsayıcının içinde `h-full` ile onu
  // doldurur; burada AYRICA `h-screen` yazılırsa Header/GuestBanner
  // yüksekliği İKİ KEZ sayılır, taşma daha da KÖTÜLEŞİRDİ.
  return (
    <div className="relative flex flex-col h-full max-h-full overflow-hidden justify-between gap-2 [@media(max-height:700px)]:gap-1 md:h-auto md:max-h-none md:overflow-visible md:justify-normal md:gap-8 lg:h-full lg:max-h-full lg:overflow-hidden lg:justify-between lg:gap-4 animate-[fadeIn_0.35s_ease]">
      {/* ÜST GRUP: kayıtlı planlar (kompakt strip) + hero başlık */}
      <div className="shrink-0 flex flex-col gap-2.5 [@media(max-height:700px)]:gap-1.5 md:gap-6">
        {savedPlans.length > 0 && (
          <div className="edge-fade-x -mx-4 md:-mx-6 px-4 md:px-6 pr-6 flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap py-2 w-full">
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

      {/* ORTA GRUP: odak kartları. TÜM breakpoint'lerde DAİMA 2 sütun
          (`grid-cols-2`, masaüstünde de `lg:grid-cols-4`'e GEÇİLMEZ) — 2x2
          matris orijinal tasarım, ortadaki FAB'ın tam kesişim noktasında
          durabilmesi de buna bağlı (bkz. aşağıdaki not). Büyütülmüş/dolgun
          kartlar (`p-4`, `min-h-[150px]`). `auto-rows-fr` KRİTİK: 4 kart 2
          satıra dizilince satırlardan biri
          (ör. bir kartın tagline'ı 2 satıra sarınca) komşusundan doğal
          olarak uzun olabilir — `auto-rows-fr` olmadan bu, aşağıdaki FAB'ın
          `top-1/2` merkezini satır sınırından kaydırıp kart METNİNİN
          ÜSTÜNE bindirir (bu bileşende daha önce yaşanan gerçek hataydı).
          `auto-rows-fr` iki satırı da EN UZUN satıra göre eşitler — merkez
          nokta her zaman tam iki satırın arasında kalır, FAB asla kart
          içeriğine binmez.
          `[@media(max-height:700px)]:` katmanı — test ederken buldum: Safari
          adres çubuğu/araç çubuğu AÇIKKEN (sayfa ilk yüklendiğindeki
          varsayılan durum) iPhone SE gibi cihazlarda GERÇEK görünür yükseklik
          667px değil, ~580-620px civarına düşebiliyor. `min-h-[150px]` +
          `overflow-hidden` sabit kalınca bu durumda "Hedefin" inputu YİNE
          sessizce kırpılıyordu (bunu Playwright ile 620/600/580px'te
          doğruladım). Bu katman SADECE kısa görünür alanlarda kartları
          otomatik küçültüyor — normal/uzun ekranlarda (chrome kapalıyken)
          görsel fark YOK, `min-h-[150px]` dolgun haliyle kalıyor. */}
      <div className="shrink-0 py-2 [@media(max-height:700px)]:py-1 md:py-0">
        <div
          data-tour-id="tour-category-cards"
          className="relative w-full max-w-7xl mx-auto grid grid-cols-2 auto-rows-fr gap-2.5 md:gap-5"
        >
          {CATEGORY_KEYS.map((key) => {
            const c = CATEGORIES[key];
            const active = key === category;
            return (
              <button
                key={key}
                onClick={() => onCategoryChange(key)}
                className="category-card group relative h-auto min-h-[150px] [@media(max-height:700px)]:min-h-[112px] flex flex-col items-center justify-center gap-1.5 md:gap-3 rounded-2xl p-4 [@media(max-height:700px)]:p-3 md:p-6 text-center transition-all duration-200 card-glow"
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
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full" style={{ background: c.accent, boxShadow: `0 0 8px ${c.accent}` }} />
                )}
              </button>
            );
          })}

          {/* "Kendi Planını Hazırla" — 2x2 grid'in tam kesişim noktasına
              `absolute` ankorlu. Bu, grid kapsayıcısının BİR ÇOCUĞU (fixed
              DEĞİL): mutlak konumlandırılmış grid çocukları CSS Grid
              yerleşiminden tamamen ÇIKAR (grid item SAYILMAZ) — bu yüzden
              5. bir "hücre" açmaz, sadece kapsayıcının tam ortasına oturur. */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
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
                className="relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #FF007F, #B026FF 55%, #00F3FF)",
                  boxShadow: "0 8px 28px -8px rgba(255,0,127,0.65), 0 0 22px -6px rgba(0,243,255,0.55)",
                }}
              >
                <span className="absolute inset-0 rounded-full motion-safe:group-hover/manual:animate-ping opacity-0 group-hover/manual:opacity-60" style={{ background: "#FF007F" }} />
                <Wand2 className="relative w-5 h-5 md:w-6 md:h-6 text-white drop-shadow-sm" strokeWidth={2.25} />
              </button>

              {/* Tooltip/label — yalnızca hover'da (masaüstü); buton artık
                  ekranın ORTASINDA olduğundan altında, yatayda ortalı açılır. */}
              <div
                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 translate-y-1 group-hover/manual:opacity-100 group-hover/manual:translate-y-0 transition-all duration-200 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold hidden md:block"
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
        </div>
      </div>

      {/* ALT GRUP: şablon çipleri + hedef giriş çubuğu + Başla. */}
      <div className="shrink-0 pt-1.5 md:pt-0">
        {/* Akıllı şablon çipleri — yatay kaydırılabilir, ana başlıktan
            (DashboardHeader/kategori kartları) AYRI bir grup; whitespace-nowrap
            + shrink-0 (her çip zaten taşıyor) satır içi sarılmayı KESİN olarak
            engeller. `my-2` hem üstteki kartlardan hem alttaki "Hedefin"
            girişinden net bir boşlukla ayırır, ikisi de üzerine binmez. */}
        <div className="edge-fade-x -mx-4 md:-mx-6 px-4 md:px-6 pr-6 py-2 [@media(max-height:700px)]:py-1 my-2 [@media(max-height:700px)]:my-1 flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap w-full">
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

        {/* "Hedefin" başlığı + Ek İstek tetikleyicisi aynı satırda — eskiden
            altında ayrı bir "Eklemek istediğin bir şey var mı?" bloğu
            (rehber metni + textarea + öneri çipleri, ~90-110px) DAİMA
            görünürdü; artık dikeyde YER KAPLAMAYAN küçük bir tıklanabilir
            etikete indirgendi, tıklanınca aşağıdaki Popover/Modal açılır. */}
        <div className="flex items-center justify-between mb-1.5 md:mb-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-[var(--text-faint)]">
              Hedefin
            </label>
            {planUsage && !planUsage.isPremium && (
              <span
                className="text-[9.5px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(178,107,255,0.14)", color: mode.accent }}
              >
                Plan Hakkı: {planUsage.count}/{planUsage.limit}
              </span>
            )}
          </div>
          {onExtraNoteChange && (
            <button
              type="button"
              onClick={() => setExtraNoteOpen(true)}
              className="flex items-center gap-1 text-[10px] md:text-[11px] font-semibold transition-colors"
              style={{ color: extraNote?.trim() ? mode.accent : "var(--text-faint)" }}
            >
              <MessageSquarePlus className="w-3.5 h-3.5" strokeWidth={2.25} />
              Ek İstek{extraNote?.trim() ? " ✓" : ""}
            </button>
          )}
        </div>
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
            // text-base (16px) BİLEREK taban: iOS Safari, input font'u 16px'in
            // altındaysa dokunulduğunda sayfayı otomatik zoom'luyor — 16px
            // (veya üstü) bunu engelliyor. sm: (640px+) itibarıyla artık
            // dokunmatik zoom riski olmadığından biraz küçültülebilir.
            className="flex-1 min-w-0 bg-transparent outline-none text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--placeholder)] px-2.5"
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

      {/* "Ek İstek" Popover/Modal — extraNote zaten usePlanStudio.
          finalizeAndGenerate tarafından AI bağlamına ekleniyor (bkz. "Ek
          notlar / özel istekler" satırı); rehber metni/placeholder/öneri
          çipleri kategoriye göre değişir (bkz. utils/promptSuggestions.js).
          `fixed inset-0` olduğundan flex akışında YER KAPLAMAZ — kök
          kapsayıcının `justify-between` dağılımını etkilemez. */}
      {extraNoteOpen && onExtraNoteChange && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center px-6" onClick={() => setExtraNoteOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="blur-cap-mobile relative w-full max-w-[380px] rounded-3xl p-5 animate-[fadeIn_0.2s_ease]"
            style={{
              background: "rgba(var(--glass-rgb), var(--alpha-modal))",
              backdropFilter: "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              border: "1px solid var(--modal-border)",
              boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14.5px] font-bold text-[var(--text-primary)]">Eklemek istediğin bir şey var mı?</h3>
              <button
                onClick={() => setExtraNoteOpen(false)}
                aria-label="Kapat"
                className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </div>
            <p className="text-[11.5px] text-[var(--text-faint)] mb-2 leading-relaxed">{suggestions.guide}</p>
            <textarea
              value={extraNote || ""}
              onChange={(e) => onExtraNoteChange(e.target.value)}
              placeholder={suggestions.placeholder}
              rows={3}
              autoFocus
              className="input-glow glass w-full rounded-2xl p-3 bg-transparent outline-none resize-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)] leading-relaxed"
              style={{ borderColor: "rgba(var(--overlay-rgb),0.10)" }}
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
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
            <button
              onClick={() => setExtraNoteOpen(false)}
              className="mt-4 w-full rounded-xl py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: mode.accent, color: "#0A0E13" }}
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
