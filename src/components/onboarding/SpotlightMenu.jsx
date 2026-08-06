import { useState } from "react";
import SpotlightOverlay from "./SpotlightOverlay";

// Hızlı Öğretici / Feature Tour — Header'daki [🎯] düğmesiyle açılır.
// Her satır, uygulamadaki GERÇEK bir arayüz elemanını (data-tour-id ile
// işaretli — bkz. Header.jsx/CategoryIntro.jsx) karartılmış bir Spotlight
// ile gösterir. `needsIntro: true` olan hedefler (AI Uzmanları/Studio
// Builder kartları) yalnızca Ana Sayfa/CategoryIntro ekranında DOM'da var
// olduğundan, seçilince ÖNCE oraya navigasyon (onNavigateIntro, ->
// usePlanStudio.resetToIntro — PlanBoard'daki "‹ Ana Sayfa" İLE AYNI,
// veri kaybettirmeyen geçiş) tetiklenir.
const FEATURES = [
  {
    key: "ai-experts",
    icon: "🧠",
    label: "AI Uzmanları",
    targetId: "tour-category-cards",
    needsIntro: true,
    accent: "#B26BFF",
    title: "🧠 AI Uzmanları",
    description: "4 farklı alanda uzmanlaşmış AI persona — birini seç, hedefini yaz, sana özel plan saniyeler içinde hazırlansın.",
  },
  {
    key: "manual-builder",
    icon: "⚙️",
    label: "Studio Builder",
    targetId: "tour-manual-plan-button",
    needsIntro: true,
    accent: "#FF007F",
    title: "⚙️ Studio Builder",
    description: "Yapay zekadan bağımsız, tamamen kendi ellerinle plan kurmak istersen bu düğmeye bas.",
  },
  {
    key: "pomodoro",
    icon: "⏱️",
    label: "Pomodoro",
    targetId: "tour-header-pomodoro",
    needsIntro: false,
    accent: "#FB7185",
    title: "⏱️ Pomodoro & Derin Odak",
    description: "Süreni ayarla, müziğini bağla, Odak Modu'na geç.",
  },
  {
    key: "nexus",
    icon: "🌐",
    label: "Nexus Sosyal",
    targetId: "tour-header-nexus",
    needsIntro: false,
    accent: "#22D3EE",
    title: "🌐 Nexus Sosyal",
    description: "Topluluğun paylaştığı planları keşfet, beğen, kendi planlarına ekle.",
  },
  {
    key: "tasks",
    icon: "📋",
    label: "Görevler ve Planlar",
    targetId: "tour-header-tasks",
    needsIntro: false,
    accent: "#00C2D6",
    title: "📋 Görevler ve Planlar",
    description: "Tüm planlarının ve görevlerinin tek, düzenli bir listesi.",
  },
];

export default function SpotlightMenu({ open, onClose, onNavigateIntro }) {
  const [activeFeature, setActiveFeature] = useState(null);

  const pick = (f) => {
    onClose();
    if (f.needsIntro) onNavigateIntro?.();
    setActiveFeature(f);
  };

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 z-[95]" onClick={onClose} />
          <div className="absolute right-0 top-full mt-2 z-[96] w-64 rounded-2xl p-1.5 glass" style={{ boxShadow: "0 20px 50px -16px rgba(0,0,0,0.4)" }}>
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              Hızlı Öğretici
            </p>
            {FEATURES.map((f) => (
              <button
                key={f.key}
                onClick={() => pick(f)}
                className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-semibold flex items-center gap-2.5 text-[var(--text-secondary)] hover:bg-[rgba(var(--overlay-rgb),0.06)] transition-colors"
              >
                <span className="text-[14px]">{f.icon}</span> {f.label}
              </button>
            ))}
          </div>
        </>
      )}
      {activeFeature && (
        <SpotlightOverlay
          targetId={activeFeature.targetId}
          title={activeFeature.title}
          description={activeFeature.description}
          accent={activeFeature.accent}
          notFoundMessage={`"${activeFeature.label}" şu an ekranında görünmüyor — mobil menüden (☰) veya ana sayfadan tekrar dener misin?`}
          onDone={() => setActiveFeature(null)}
        />
      )}
    </>
  );
}
