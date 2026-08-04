import { memo, useState, useEffect } from "react";
import { X, Plus, Trash2, LogOut, Repeat2, Compass, ListChecks, Users2, BarChart3, Timer, FolderOpen, FileText } from "lucide-react";
import { fetchProfileByAuthUserId, fetchTemplatesByAuthor } from "../services/profileService";

// Sade toggle atomu — Ayarlar bölümünde kullanılır.
function ToggleSwitch({ checked, onChange, accent }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="w-10 h-[22px] rounded-full relative shrink-0 transition-colors duration-200"
      style={{ background: checked ? accent : "rgba(var(--overlay-rgb),0.14)" }}
    >
      <span
        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all duration-200"
        style={{ left: checked ? "20px" : "2px" }}
      />
    </button>
  );
}

// 2 sütunlu bento tuşu — "Orta Grid Menü Tuşları" bölümü için.
function GridButton({ icon, color, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl p-3 border border-slate-200 dark:border-white/10 text-left transition-colors"
      style={{ background: "var(--bg-card)" }}
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
// desen). Sade: tek hatlı kenarlık, gradyan/glow yok.
//
// Yerleşim: [Profil satırı + Nexus Hesabım] → [Şablonlarım] → [Ayarlar] →
// [2 sütunlu gezinme grid'i] → [Plan Ekle | Plan Sil] → [Çıkış Yap (tam genişlik)].
function DrawerMenu({
  open,
  onClose,
  accent,
  user,
  planGoal,
  savedPlansCount,
  remindersOn,
  onToggleReminders,
  hapticsOn,
  onToggleHaptics,
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
}) {
  const [myTemplates, setMyTemplates] = useState(null);

  // "Şablonlarım" — kullanıcının Nexus'ta yayınladığı gerçek şablonlar
  // (bkz. PublicProfileCard.jsx'in AYNI fetchTemplatesByAuthor kullanımı).
  useEffect(() => {
    if (!open || !user) {
      setMyTemplates(null);
      return;
    }
    let cancelled = false;
    fetchProfileByAuthUserId(user.id).then((p) => {
      if (cancelled) return;
      if (!p) return setMyTemplates([]);
      fetchTemplatesByAuthor(p.id).then((t) => !cancelled && setMyTemplates(t));
    });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  if (!open) return null;

  const go = (fn) => () => {
    fn?.();
    onClose?.();
  };

  const navItems = [
    { key: "routines", icon: <Repeat2 className="w-4 h-4" strokeWidth={2.25} />, color: "#2ED9A3", label: "Rutinlerim", onClick: onOpenRoutines, always: false },
    { key: "hub", icon: <Compass className="w-4 h-4" strokeWidth={2.25} />, color: "#F0B37E", label: "Keşfet / Şablonlar", onClick: onOpenHub, always: true },
    { key: "tasks", icon: <ListChecks className="w-4 h-4" strokeWidth={2.25} />, color: "#00C2D6", label: "Görevler", onClick: onOpenTasks, always: false },
    { key: "community", icon: <Users2 className="w-4 h-4" strokeWidth={2.25} />, color: "#8B5CF6", label: "Routinix Nexus", onClick: onOpenCommunity, always: true },
    { key: "rhythm", icon: <BarChart3 className="w-4 h-4" strokeWidth={2.25} />, color: "#8B5CF6", label: "Ritim & Gün Sonu", onClick: onOpenRhythm, always: false },
    { key: "pomodoro", icon: <Timer className="w-4 h-4" strokeWidth={2.25} />, color: "#F0827A", label: "Pomodoro & Focus", onClick: onOpenPomodoro, always: true },
    { key: "plans", icon: <FolderOpen className="w-4 h-4" strokeWidth={2.25} />, color: "#64748B", label: "Planlarım", onClick: onOpenPlans, always: false },
  ].filter((t) => (t.always || user) && (t.key !== "plans" || savedPlansCount > 0));

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

          {/* Şablonlarım */}
          {user && (
            <button
              onClick={go(onOpenCommunity)}
              className="w-full text-left rounded-xl border border-slate-200 dark:border-white/10 p-3.5"
              style={{ background: "var(--bg-card)" }}
            >
              <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] mb-2" style={{ color: "var(--text-faint)" }}>
                <FileText className="w-3 h-3" /> Şablonlarım {myTemplates ? `(${myTemplates.length})` : ""}
              </p>
              {myTemplates === null ? (
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Yükleniyor...
                </p>
              ) : myTemplates.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Henüz şablon paylaşmadın — Nexus'a git.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {myTemplates.slice(0, 3).map((t) => (
                    <li key={t.id} className="text-[12.5px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      • {t.title}
                    </li>
                  ))}
                  {myTemplates.length > 3 && (
                    <li className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                      +{myTemplates.length - 3} tane daha
                    </li>
                  )}
                </ul>
              )}
            </button>
          )}

          {/* Ayarlar */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3.5 flex flex-col gap-3" style={{ background: "var(--bg-card)" }}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: "var(--text-faint)" }}>
              ⚙️ Ayarlar
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
                🔔 Günlük Hatırlatıcılar
              </span>
              <ToggleSwitch checked={remindersOn} onChange={onToggleReminders} accent={accent} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                📳 Ses & Dokunsal Geri Bildirim
              </span>
              <ToggleSwitch checked={hapticsOn} onChange={onToggleHaptics} accent={accent} />
            </div>
          </div>

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
