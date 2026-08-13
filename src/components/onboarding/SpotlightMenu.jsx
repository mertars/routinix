import { useState } from "react";
import { X } from "lucide-react";
import SpotlightOverlay from "./SpotlightOverlay";

// Hızlı Öğretici / Feature Tour — DrawerMenu'deki (☰) "Hızlı Öğretici"
// satırıyla açılır. Her satır, uygulamadaki GERÇEK bir arayüz elemanını
// (data-tour-id ile işaretli — bkz. Header.jsx/CategoryIntro.jsx/
// PlanBoard.jsx) karartılmış bir Spotlight ile gösterir. Her özellik artık
// BİRDEN FAZLA sıralı adıma sahip olabilir (`steps: [...]`, tek hedefli
// özellikler tek elemanlı dizi taşır) — "Aktif Plan Ekranı" bunu kullanır:
// plan alanı → gün sekmeleri → görev kartları sırayla anlatılır.
//
// SUNUM NOTU: eskiden Header'daki [🎯] düğmesine "absolute right-0 top-full"
// ile ANKORLANMIŞ küçük bir dropdown'dı. Tetikleyici artık DrawerMenu'nün
// İÇİNDE yaşıyor — drawer kapanınca (go() sarmalayıcısı) o buton hemen
// unmount olur, bir dropdown'ı ona ankorlamak KIRILGAN bir yarış durumu
// yaratırdı (buton kaybolduktan HEMEN SONRA popover'ın konum hesaplaması
// boşa düşerdi). Bunun yerine ConfirmModal.jsx İLE AYNI ORTALANMIŞ modal
// deseni kullanılır — hiçbir anchor/ref gerektirmez, drawer kapansa da
// sorunsuz açılır.
//
// needsIntro: true → seçilince ÖNCE Ana Sayfa'ya navigasyon (onNavigateIntro,
// -> usePlanStudio.resetToIntro) tetiklenir (AI Uzmanları/Studio Builder
// kartları yalnızca o ekranda DOM'da var).
// requiresPlan: true → kullanıcının EN AZ bir kayıtlı planı olmalı; yoksa
// menüde %40 opaklıkta, tıklanamaz durur. Varsa seçilince (henüz açık bir
// plan yoksa) onEnsurePlanOpen ile ilk kayıtlı plan açılır, SONRA spotlight
// başlar — AI Uzmanları/Studio Builder'ın needsIntro'suyla AYNI ilke.
const FEATURES = [
  {
    key: "ai-experts",
    icon: "🧠",
    label: "AI Uzmanları",
    needsIntro: true,
    accent: "#B26BFF",
    steps: [{ targetId: "tour-category-cards", title: "🧠 AI Uzmanları", description: "4 farklı alanda uzmanlaşmış AI persona — birini seç, hedefini yaz, sana özel plan saniyeler içinde hazırlansın." }],
  },
  {
    key: "manual-builder",
    icon: "⚙️",
    label: "Studio Builder",
    needsIntro: true,
    accent: "#FF007F",
    steps: [{ targetId: "tour-manual-plan-button", title: "⚙️ Studio Builder", description: "Yapay zekadan bağımsız, tamamen kendi ellerinle plan kurmak istersen bu düğmeye bas." }],
  },
  {
    key: "active-plan",
    icon: "🗓️",
    label: "Aktif Plan Ekranı",
    requiresPlan: true,
    accent: "#8B5CF6",
    steps: [
      { targetId: "tour-plan-area", title: "🗓️ Plan Alanı", description: "Planının başlığı, genel ilerleme yüzden ve rutinlerin burada özetlenir." },
      { targetId: "tour-day-tabs", title: "📅 Gün Sekmeleri", description: "Günler arasında buradan anında geçiş yaparsın." },
      { targetId: "tour-task-cards", title: "✅ Görev Kartları", description: "Görevlerini buradan tikleyip yönetirsin, Pomodoro'yu da doğrudan burada başlatabilirsin." },
    ],
  },
  {
    key: "pomodoro",
    icon: "⏱️",
    label: "Pomodoro Öğreticisi",
    accent: "#FB7185",
    // openKey: seçilince ÖNCE gerçek Pomodoro ekranı açılır (bkz. app.jsx
    // screenOpeners), SONRA aşağıdaki adımlar o ekranın GERÇEK elemanları
    // (fake demo/ekran görüntüsü DEĞİL) üzerinde sırayla gösterilir.
    openKey: "pomodoro",
    steps: [
      { targetId: "tour-pomodoro-timer", title: "⏱️ Süre & Görev", description: "Odaklanma/Mola sürelerini buradan seçersin." },
      { targetId: "tour-pomodoro-music", title: "🎵 Müzik", description: "Spotify çalma listeni buradan bağlayıp başlatırsın." },
      { targetId: "tour-pomodoro-focus", title: "💡 Odak Modu", description: "Gereksiz kontroller kaybolsun, geriye yalnızca sayaç kalsın." },
    ],
  },
  {
    key: "nexus",
    icon: "🌐",
    label: "Nexus Sosyal",
    accent: "#22D3EE",
    openKey: "nexus",
    steps: [
      { targetId: "tour-nexus-search", title: "🔍 Şablon Ara", description: "Topluluğun paylaştığı binlerce plandan aradığına anında ulaş." },
      { targetId: "tour-nexus-wrapped", title: "✨ Haftalık Wrapped", description: "Bu haftaki verimlilik karneni Instagram Story formatında gör." },
    ],
  },
  {
    key: "tasks",
    icon: "📋",
    label: "Görevler ve Planlar",
    accent: "#00C2D6",
    openKey: "tasks",
    steps: [{ targetId: "tour-tasks-panel", title: "📋 Görevler ve Planlar", description: "Tüm planlarının ve görevlerinin tek, düzenli bir listesi burada." }],
  },
];

export default function SpotlightMenu({ open, onClose, onNavigateIntro, savedPlansCount = 0, onEnsurePlanOpen, screenOpeners = {} }) {
  const [activeFeature, setActiveFeature] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  // DİKKAT: `onClose()` BURADA ÇAĞRILMAZ. app.jsx SpotlightMenu'yü
  // `{spotlightOpen && <SpotlightMenu/>}` ile koşullu monte ediyor — pick()
  // aynı anda hem onClose() (spotlightOpen'ı false yapar) hem de
  // setActiveFeature(f) (yerel state) çağırırsa, React'in AYNI render
  // turunda SpotlightMenu'yü TAMAMEN UNMOUNT etmesiyle activeFeature'a
  // atanan değer hiç kullanılmadan kaybolur — spotlight ASLA görünmezdi
  // (canlıda doğrulanan gerçek hata). Bunun yerine bileşen `open` DOĞRUYKEN
  // monte kalır; küçük menü popover'ı yalnızca `activeFeature` set olunca
  // KENDİ İÇİNDE gizlenir (bkz. aşağıdaki JSX `open && !activeFeature`).
  const pick = (f, disabled) => {
    if (disabled) return;
    if (f.needsIntro) onNavigateIntro?.();
    if (f.requiresPlan) onEnsurePlanOpen?.();
    // openKey: Pomodoro/Nexus/Görevler gibi kendi ekranı olan özellikler —
    // spotlight'ın hedef alacağı gerçek elemanlar önce bu ekran AÇIK
    // olmalı, aksi halde SpotlightOverlay "bulunamadı" düşer.
    if (f.openKey) screenOpeners[f.openKey]?.();
    setStepIndex(0);
    setActiveFeature(f);
  };

  const handleStepDone = () => {
    if (activeFeature && stepIndex < activeFeature.steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      // Son adım bitti — YALNIZCA burada gerçekten kapat (bileşeni unmount
      // eder, bkz. yukarıdaki not).
      setActiveFeature(null);
      onClose();
    }
  };

  const currentStep = activeFeature?.steps[stepIndex];

  return (
    <>
      {open && !activeFeature && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center px-6" onClick={onClose}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="blur-cap-mobile relative w-full max-w-[320px] rounded-3xl p-2 animate-[fadeIn_0.2s_ease]"
            style={{
              background: "rgba(var(--glass-rgb), var(--alpha-modal))",
              backdropFilter: "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              border: "1px solid var(--modal-border)",
              boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)",
            }}
          >
            {/* Görünür Kapat (X) — ilk ziyarette OTOMATİK açılan bir menü
                için "dışarı tıkla" tek başına yeterli bir ipucu DEĞİL (yeni
                kullanıcı henüz hiçbir modal alışkanlığı edinmemiş olabilir);
                diğer tüm modallardaki (PaywallModal/AuthModal) AYNI görünür
                X deseni buraya da eklendi. */}
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
              style={{ background: "rgba(var(--overlay-rgb),0.08)" }}
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.25} />
            </button>
            <p className="px-3 pt-3 pb-2 pr-9 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              🎯 Hızlı Öğretici
            </p>
            {FEATURES.map((f) => {
              const disabled = f.requiresPlan && savedPlansCount === 0;
              return (
                <button
                  key={f.key}
                  onClick={() => pick(f, disabled)}
                  disabled={disabled}
                  title={disabled ? "Önce bir plan oluşturmalısın" : undefined}
                  className={`w-full text-left px-3 py-3 rounded-xl text-[13px] font-semibold flex items-center gap-2.5 transition-colors ${disabled ? "" : "hover:bg-[rgba(var(--overlay-rgb),0.06)]"}`}
                  style={disabled ? { color: "var(--text-faint)", opacity: 0.4, cursor: "not-allowed" } : { color: "var(--text-secondary)" }}
                >
                  <span className="text-[15px]">{f.icon}</span> {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {activeFeature && currentStep && (
        <SpotlightOverlay
          targetId={currentStep.targetId}
          title={currentStep.title}
          description={currentStep.description}
          accent={activeFeature.accent}
          stepLabel={activeFeature.steps.length > 1 ? `${stepIndex + 1}/${activeFeature.steps.length}` : null}
          isLastStep={stepIndex === activeFeature.steps.length - 1}
          notFoundMessage={`"${activeFeature.label}" şu an ekranında görünmüyor — mobil menüden (☰) veya ana sayfadan tekrar dener misin?`}
          onDone={handleStepDone}
        />
      )}
    </>
  );
}
