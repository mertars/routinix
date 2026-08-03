// React.lazy Suspense fallback'leri.
//
// Görünüm İzolasyonu mimarisi (bkz. app.jsx): TaskDrawer/RoutinesPopover/
// AuthModal/TemplateHub/MyPlansHub/RhythmStudio artık KOŞULLU mount ediliyor
// (`{open && <Suspense>...}`) — kapalıyken DOM'da hiç yoklar, bu yüzden
// Suspense boundary'leri de yalnızca kullanıcı GERÇEKTEN bir panel açtığında
// ağaca girer. Bu durumda görünür bir fallback hem güvenli HEM gerekli
// (kullanıcı az önce bir butona tıkladı, "hiçbir şey olmadı" hissi
// vermemeli) — aşağıdaki `OverlayFallback`/`InlineFallback`/`FabFallback`
// üçü de gerçek bileşenin kaplayacağı alanın AYNISINI/BİREBİRİNİ önceden
// ayırır ki gerçek içerik gelince düzen sıçramaz (CLS = 0).
// `prefers-reduced-motion`a saygılı (motion-safe:animate-spin —
// CategoryIntro'nun "loading" durumuyla aynı görsel dil).
//
// PomodoroStudio/PrintModal/PrintablePlan İSTİSNA: bunlar hâlâ UNCONDITIONAL
// mount + `fallback={null}` kullanır (bkz. app.jsx yorumları) — Pomodoro'nun
// sayacı Studio kapalıyken de gerçek zamanda saymaya devam etmesi GEREKİYOR
// (bkz. PomodoroStudio.jsx `display:none` yorumu), PrintablePlan ise
// `window.print()` tetiklendiği anda DOM'da olmak zorunda.
function Spinner({ size = 34 }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-2 opacity-20" style={{ borderColor: "var(--pomo-accent)" }} />
      <div
        className="absolute inset-0 rounded-full border-2 border-transparent motion-safe:animate-spin"
        style={{ borderTopColor: "var(--pomo-accent)", animationDuration: "0.9s" }}
      />
    </div>
  );
}

// Tam ekran/geniş paneller (TaskDrawer, RoutinesPopover, AuthModal,
// TemplateHub, MyPlansHub, RhythmStudio) için — `z` prop'u o panelin gerçek
// z-index'iyle eşleşir ki başka bir eş-zamanlı katmanla (ör. ConfirmModal)
// çakışma olmasın. Hafif bir dim backdrop + ortalanmış spinner; panel her
// zaman `{open && ...}` içinde render edildiğinden (koşullu mount), bu
// yalnızca kullanıcı panelin AÇILMASINI istediği anda görünür — sayfa
// ilk yüklendiğinde asla tetiklenmez.
export function OverlayFallback({ z = 90 }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/20 dark:bg-black/50 backdrop-blur-sm animate-[fadeIn_0.15s_ease]"
      style={{ zIndex: z }}
      aria-hidden="true"
    >
      <Spinner />
    </div>
  );
}

// OnboardingWizard için — yalnızca `stage === STAGE_WIZARD` olunca ağaca
// girer ("Devam Et" tıklamasının doğrudan sonucu). CategoryIntro'nun kendi
// "loading" ekranıyla aynı üst boşluğu (pt-24) kullanır ki wizard gelince
// içerik aynı dikey konumda oturur, sayfa zıplamaz.
export function InlineFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 pt-24 pb-10 animate-[fadeIn_0.2s_ease]">
      <Spinner size={40} />
    </div>
  );
}

// MobileActionDeck için — `stage === STAGE_PLAN` olunca ağaca girer
// (framer-motion, bu tek bileşen için gelen tek bağımlılık — masaüstünü/diğer
// ekranları hiç etkilememesi için lazy). Gerçek bileşenle AYNI rezerve
// alanı (`md:hidden`, minHeight 168) kullanır, CLS = 0.
export function DeckFallback() {
  return (
    <div className="md:hidden w-full mb-5 rounded-3xl animate-pulse" style={{ minHeight: 168, background: "rgba(var(--overlay-rgb),0.04)" }} aria-hidden="true" />
  );
}

// AiCoachWidget için — yalnızca `stage === STAGE_PLAN && dbPlan` olunca
// ağaca girer. Widget'ın sağ-alt sabit tetikleyici baloncuğuyla BİREBİR aynı
// konum/boyutta (w-14 h-14, aynı fixed ofset, aynı z-40) — chunk gelip
// gerçek buton takılınca hiçbir kayma olmaz, yalnızca statik halka döner
// içeriğe dönüşür.
export function FabFallback() {
  return (
    <div className="fixed z-40" style={{ right: "1.5rem", bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }} aria-hidden="true">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: "rgba(var(--overlay-rgb),0.06)", border: "1px solid rgba(124,58,237,0.35)" }}
      >
        <Spinner size={22} />
      </div>
    </div>
  );
}
