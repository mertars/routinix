import { memo } from "react";
import { X, Plus, Trash2, LogOut, Repeat2, Compass, ListChecks, Users2, BarChart3, Timer, FolderOpen, HelpCircle, Target, ChefHat } from "lucide-react";
import { FEATURE_FLAGS } from "../constants";

// 2 sütunlu bento tuşu — "Orta Grid Menü Tuşları" bölümü için. "Siyah Cam"
// (Black Glassmorphism): düz opak `var(--bg-card)` yerine ince, saydam
// `rgba(var(--overlay-rgb),0.04)` zemin + üstte hafif ışık yansıması
// (inset shadow). BİLEREK `backdrop-blur` YOK — çekmecenin kendi zemini
// (`blur-cap-mobile`) zaten arkayı bulanıklaştırıyor; bunun üstüne HER
// tek tuşa ayrı bir blur katmanı eklemek mobilde gereksiz GPU maliyeti
// (ve performans isteğiyle doğrudan çelişki) olurdu — aynı "cam" hissi
// saydamlık + kenarlık + iç ışıkla, sıfır ekstra blur maliyetiyle veriliyor.
function GridButton({ icon, color, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl p-3 border border-slate-200 dark:border-white/10 text-left transition-colors"
      style={{ background: "rgba(var(--overlay-rgb),0.04)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.08)" }}
    >
      <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}1A`, color }}>
        {icon}
      </span>
      <span className="text-[12px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
    </button>
  );
}

// Standart Hamburger Menü — sağdan kayan klasik çekmece (bkz. GlobalStyles.jsx
// .drawer-panel, AiCoachWidget.jsx'in kendi yan paneliyle AYNI, kanıtlanmış
// desen). "Şablonlarım" artık BURADA değil — doğrudan NexusProfileOverlay.jsx
// içinde, profil bilgisinin hemen altında (bkz. o dosyanın yorumu). "Ayarlar"
// (Hatırlatıcı/Haptics) henüz aktif olmadığı için tamamen kaldırıldı.
//
// Yerleşim: [Profil satırı + Nexus Hesabım] → [2 sütunlu gezinme grid'i] →
// [Plan Ekle | Plan Sil] → [Çıkış Yap (tam genişlik)] — tek ekrana sığar,
// kaydırma gerekmez.
function DrawerMenu({
  open,
  onClose,
  accent,
  user,
  planGoal,
  savedPlansCount,
  onNewPlan,
  onDeletePlan,
  onSignOut,
  onOpenHub,
  onOpenTasks,
  onOpenRoutines,
  onOpenPlans,
  onOpenRhythm,
  onOpenCommunity,
  onOpenPomodoro,
  onOpenProfile,
  onOpenTour,
  onOpenSpotlight,
  onOpenNutritionArchitect,
}) {
  if (!open) return null;

  const go = (fn) => () => {
    fn?.();
    onClose?.();
  };

  const navItems = [
    { key: "routines", icon: <Repeat2 className="w-4 h-4" strokeWidth={2.25} />, color: "#2ED9A3", label: "Rutinlerim", onClick: onOpenRoutines, always: false },
    // FEATURE_FLAGS.SHOW_TEMPLATES=false iken gizli (bkz. constants.js +
    // Header.jsx'teki AYNI bayrak) — kod SİLİNMEDİ.
    { key: "hub", icon: <Compass className="w-4 h-4" strokeWidth={2.25} />, color: "#F0B37E", label: "Keşfet / Şablonlar", onClick: onOpenHub, always: true, hidden: !FEATURE_FLAGS.SHOW_TEMPLATES },
    { key: "tasks", icon: <ListChecks className="w-4 h-4" strokeWidth={2.25} />, color: "#00C2D6", label: "Görevler", onClick: onOpenTasks, always: false },
    { key: "community", icon: <Users2 className="w-4 h-4" strokeWidth={2.25} />, color: "#8B5CF6", label: "Routinix Nexus", onClick: onOpenCommunity, always: true },
    { key: "rhythm", icon: <BarChart3 className="w-4 h-4" strokeWidth={2.25} />, color: "#8B5CF6", label: "Ritim & Gün Sonu", onClick: onOpenRhythm, always: false },
    { key: "pomodoro", icon: <Timer className="w-4 h-4" strokeWidth={2.25} />, color: "#F0827A", label: "Pomodoro & Focus", onClick: onOpenPomodoro, always: true },
    {
      key: "nutrition",
      icon: <ChefHat className="w-4 h-4" strokeWidth={2.25} />,
      color: "#F4406B",
      label: "Beslenme & Antrenman Mimarı",
      onClick: onOpenNutritionArchitect,
      always: true,
    },
    { key: "plans", icon: <FolderOpen className="w-4 h-4" strokeWidth={2.25} />, color: "#64748B", label: "Planlarım", onClick: onOpenPlans, always: false },
    { key: "tour", icon: <HelpCircle className="w-4 h-4" strokeWidth={2.25} />, color: "#10B981", label: "Nasıl Kullanılır?", onClick: onOpenTour, always: true },
    // Header'ın (🎯) tetikleyicisinin YENİ yeri — bkz. onboarding/SpotlightMenu.jsx
    // dosya başı yorumu: artık ortalanmış bir modal, drawer kapansa da sorunsuz açılır.
    { key: "spotlight", icon: <Target className="w-4 h-4" strokeWidth={2.25} />, color: "#F0B37E", label: "Hızlı Öğretici", onClick: onOpenSpotlight, always: true },
  ].filter((t) => !t.hidden && (t.always || user) && (t.key !== "plans" || savedPlansCount > 0));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div
        className="blur-cap-mobile fixed top-0 right-0 z-50 h-full w-[86%] max-w-[340px] flex flex-col drawer-panel no-scrollbar"
        style={{ background: "rgba(var(--glass-rgb), var(--alpha-modal))", borderLeft: "1px solid var(--modal-border)" }}
      >
        {/* Profil satırı */}
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-slate-200 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0"
                style={{ background: `${accent}1F`, color: accent, border: "1px solid rgba(var(--overlay-rgb),0.1)" }}
              >
                {user ? (user.email || "?").charAt(0).toUpperCase() : "👤"}
              </div>
              <span className="text-[12.5px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {user ? user.email : "Misafir"}
              </span>
            </div>
            {user && (
              <button
                onClick={go(onOpenProfile)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
                style={{ background: "rgba(34,211,238,0.12)", color: "#0891B2", border: "1px solid rgba(34,211,238,0.35)" }}
              >
                <Users2 className="w-3 h-3" /> Nexus Hesabım
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-2.5">
          {planGoal && (
            <p className="text-[12px] font-medium leading-relaxed px-0.5" style={{ color: "var(--text-muted)" }}>
              🎯 {planGoal}
            </p>
          )}

          {/* Orta grid menü tuşları — 2 sütun */}
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((n) => (
              <GridButton key={n.key} icon={n.icon} color={n.color} label={n.label} onClick={go(n.onClick)} />
            ))}
          </div>
        </div>

        {/* En alt aksiyon alanı */}
        <div className="px-4 py-4 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={go(onNewPlan)}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold transition-opacity hover:opacity-90"
              style={{ background: accent, color: "#0A0E13" }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Plan Ekle
            </button>
            <button
              onClick={go(onDeletePlan)}
              disabled={!savedPlansCount}
              className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-[13px] font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
              style={{ background: "rgba(244,64,107,0.12)", color: "#F0575A", border: "1px solid rgba(244,64,107,0.30)" }}
            >
              <Trash2 className="w-4 h-4" /> Plan Sil / Yönet
            </button>
          </div>
          {user && (
            <button
              onClick={go(onSignOut)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl py-3.5 text-[13.5px] font-bold transition-opacity hover:opacity-90"
              style={{ background: "rgba(240,90,90,0.10)", color: "#F0827A", border: "1px solid rgba(240,90,90,0.25)" }}
            >
              <LogOut className="w-4 h-4" /> Çıkış Yap
            </button>
          )}
        </div>
      </div>
    </>
  );
}
export default memo(DrawerMenu);
