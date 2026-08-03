import { memo } from "react";
import { X, Target, Plus, Trash2, User, Settings, ChevronRight, Repeat2, Compass, ListChecks, Users2, BarChart3, Timer, FolderOpen } from "lucide-react";

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

// Klasik liste satırı — tek hatlı sade kenarlık, gradyan/glow YOK.
function ListRow({ icon, iconBg, iconColor, label, onClick, disabled, trailing }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 border border-slate-200 dark:border-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
      style={{ background: "var(--bg-card)" }}
    >
      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </span>
      <span className="flex-1 text-[13.5px] font-semibold text-left" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      {trailing || <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />}
    </button>
  );
}

// Standart Hamburger Menü — sağdan kayan klasik çekmece (bkz. GlobalStyles.jsx
// .drawer-panel, AiCoachWidget.jsx'in kendi yan paneliyle AYNI, kanıtlanmış
// desen). Bilinçli olarak SADE: jest yok, neon/glow yok, tek hatlı kenarlık
// (`border-slate-200 dark:border-white/10`), düz tipografi.
//
// Sıra: Hedef kutusu → Plan Ekle → Planları Yönet & Sil → Nexus Profilim →
// Ayarlar → (korunan) diğer gezinme hedefleri. Gezinme listesi kullanıcının
// istediği 5 maddeye EK olarak korundu — Rutinler/Keşfet/Görevler/Ritim/
// Pomodoro/Nexus'a mobilde başka erişim yolu yok, sessizce kaldırmak gerçek
// bir işlev kaybı olurdu.
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
  onOpenHub,
  onOpenTasks,
  onOpenRoutines,
  onOpenPlans,
  onOpenRhythm,
  onOpenCommunity,
  onOpenPomodoro,
  onOpenProfile,
}) {
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
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-200 dark:border-white/10">
          <span className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
            Menü
          </span>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-2.5">
          {/* Günün Odak Noktası — gerçek plan hedefi, sade kutu */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3.5" style={{ background: "var(--bg-card)" }}>
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: "var(--text-faint)" }}>
              <Target className="w-3 h-3" /> Günün Odak Noktası
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {planGoal || "Henüz bir hedef belirlenmedi — yeni bir plan başlat."}
            </p>
          </div>

          <ListRow icon={<Plus className="w-4 h-4" strokeWidth={2.5} />} iconBg={`${accent}1A`} iconColor={accent} label="Plan Ekle" onClick={go(onNewPlan)} />
          <ListRow
            icon={<Trash2 className="w-4 h-4" strokeWidth={2.25} />}
            iconBg="rgba(244,64,107,0.12)"
            iconColor="#F0575A"
            label="Planları Yönet & Sil"
            onClick={go(onDeletePlan)}
            disabled={!savedPlansCount}
          />
          {user && (
            <ListRow
              icon={<User className="w-4 h-4" strokeWidth={2.25} />}
              iconBg="rgba(34,211,238,0.14)"
              iconColor="#22D3EE"
              label="Nexus Profilim"
              onClick={go(onOpenProfile)}
            />
          )}

          {/* Ayarlar */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3.5 flex flex-col gap-3" style={{ background: "var(--bg-card)" }}>
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em]" style={{ color: "var(--text-faint)" }}>
              <Settings className="w-3 h-3" /> Ayarlar
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

          <div className="h-px my-1 bg-slate-200 dark:bg-white/10" />

          {navItems.map((n) => (
            <ListRow key={n.key} icon={n.icon} iconBg={`${n.color}1A`} iconColor={n.color} label={n.label} onClick={go(n.onClick)} />
          ))}
        </div>
      </div>
    </>
  );
}
export default memo(DrawerMenu);
