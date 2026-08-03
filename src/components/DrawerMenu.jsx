import { memo, useState } from "react";
import { Repeat2, Compass, ListChecks, Users2, Timer, BarChart3, User, Settings, ChevronRight, ChevronDown } from "lucide-react";
import { MONO_FONT } from "../constants";

// Sadece bu menüde kullanılan küçük toggle atomu.
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

// Kare/geniş Bento kartı — Rutinlerim/Keşfet/Görevler/Nexus/Ritim/Pomodoro
// gibi tüm birincil hedefler AYNI bu görsel dilde render edilir (yalnızca
// ikon/renk/etiket değişir) — kullanıcının istediği "2'li Bento kart"
// ESTETİĞİ, eski menünün TÜM 6-7 gezinme hedefini kaybetmeden uygulanmış
// hali (bkz. dosya başı tasarım notu).
function BentoTile({ icon, label, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-glow group relative flex flex-col items-start justify-between gap-3 rounded-2xl p-3.5 h-[92px] text-left bg-white/[0.03] border border-white/10 transition-colors duration-150 active:border-purple-500/50 active:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
    >
      <span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: `${color}1F`, color }}>
        {icon}
      </span>
      <span className="text-[12px] font-bold text-white leading-tight">{label}</span>
    </button>
  );
}

// İnce yatay Bento şeridi — sağında ya bir gezinme oku (`ChevronRight`) ya da
// (Ayarlar için) yerinde açılan bir akordeon oku (`ChevronDown`) bulunur.
function BentoStrip({ icon, label, onClick, expandable = false, expanded = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expandable ? expanded : undefined}
      className="card-glow w-full flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/[0.03] border border-white/10 transition-colors duration-150 active:border-purple-500/50 active:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
    >
      <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.05] text-slate-300 shrink-0">{icon}</span>
      <span className="flex-1 text-[13px] font-bold text-white text-left truncate">{label}</span>
      {expandable ? (
        <ChevronDown className={`accordion-chevron w-4 h-4 text-slate-500 shrink-0 ${expanded ? "open" : ""}`} />
      ) : (
        <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
      )}
    </button>
  );
}

// "Hibrit Bento Bottom Sheet" — eski dikey-liste hamburger menünün yerine
// geçer. Mobilde alttan yaylı (spring) bir animasyonla açılan, üst köşeleri
// derin oval, buzlu-cam bir Bento Grid paneli; md'den itibaren (bkz.
// GlobalStyles.jsx .bento-sheet) FocusSidePanel/TaskDrawer ile AYNI
// duyarlı desenle ince bir sağ yan panele dönüşür — masaüstü kullanımı
// (☰ her boyutta görünür, bkz. Header.jsx) bozulmaz.
//
// "Ayarlar" şeridi bilinçli olarak bir EKRANA gitmiyor (böyle bir ekran
// yok) — yerinde bir akordeon olarak açılıp eski menüdeki hatırlatıcı/
// dokunsal geri bildirim toggle'larını + Plan Ekle/Sil + Çıkış Yap'ı
// gösterir. Bu sayede tasarım vizyonu (ince şerit + ok) korunurken hiçbir
// gerçek işlev kaybolmaz.
function DrawerMenu({
  open,
  onClose,
  accent,
  accentSoft,
  user,
  savedPlans,
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
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!open) return null;

  // `savedPlans` en yeni önce sıralı gelir (bkz. planService.fetchUserPlans)
  // — ilk eleman "aktif" plan olarak ele alınır. Uygulamanın geri kalanında
  // (bkz. rhythmAnalytics.js) bilinçli olarak bir "streak sayacı" YOK —
  // kullanıcıyı zincir kırma kaygısına sokmamak için — o yüzden hero kart
  // sahte bir seri rakamı GÖSTERMEZ, gerçek veriyle "Aktif Plan" özetler.
  const activePlan = savedPlans?.[0];

  const go = (fn) => () => {
    fn?.();
    onClose?.();
  };

  const bentoTiles = [
    { key: "routines", icon: <Repeat2 className="w-4 h-4" strokeWidth={2.25} />, label: "Rutinlerim", color: "#7DE9C3", onClick: onOpenRoutines, always: false },
    { key: "hub", icon: <Compass className="w-4 h-4" strokeWidth={2.25} />, label: "Keşfet / Şablonlar", color: "#F0B37E", onClick: onOpenHub, always: true },
    { key: "tasks", icon: <ListChecks className="w-4 h-4" strokeWidth={2.25} />, label: "Görevler", color: "#00F2FE", onClick: onOpenTasks, always: false },
    { key: "community", icon: <Users2 className="w-4 h-4" strokeWidth={2.25} />, label: "Routinix Nexus", color: "#22D3EE", onClick: onOpenCommunity, always: true },
    { key: "rhythm", icon: <BarChart3 className="w-4 h-4" strokeWidth={2.25} />, label: "Ritim & Gün Sonu", color: "#A78BFA", onClick: onOpenRhythm, always: false },
    { key: "pomodoro", icon: <Timer className="w-4 h-4" strokeWidth={2.25} />, label: "Pomodoro & Focus", color: "#FB7185", onClick: onOpenPomodoro, always: true },
  ].filter((t) => t.always || user);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div
        className="bento-sheet blur-cap-mobile fixed z-50 flex flex-col backdrop-blur-2xl bg-[#0b0c10]/90 no-scrollbar"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          borderLeft: "1px solid var(--sidebar-border)",
          boxShadow: "0 -24px 70px -20px rgba(0,0,0,0.7), inset 1px 0 20px -10px rgba(178,107,255,0.35)",
        }}
      >
        <div className="neon-strip" />

        {/* Çekme çizgisi — yalnızca mobil bottom-sheet halinde (bkz. .bento-sheet md:hidden override) */}
        <div className="bento-drag-handle flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pt-3 pb-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
              style={{ background: accentSoft, color: accent, border: "1px solid rgba(var(--overlay-rgb),0.1)" }}
            >
              {user ? (user.email || "?").charAt(0).toUpperCase() : "👤"}
            </div>
            <span className="text-[12.5px] font-bold text-white truncate">{user ? user.email : "Misafir"}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-1 flex flex-col gap-2.5">
          {/* Öne çıkan kart — aktif plan özeti */}
          <button type="button" onClick={go(onOpenPlans)} className="card-glow w-full text-left rounded-3xl p-4 relative overflow-hidden active:border-purple-500/50 active:shadow-[0_0_20px_rgba(168,85,247,0.2)]" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(99,102,241,0.18))", border: "1px solid rgba(168,85,247,0.35)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded-full" style={{ background: "rgba(168,85,247,0.25)", color: "#E9D5FF" }}>
                ✨ Aktif Plan
              </span>
              <ChevronRight className="w-4 h-4 text-purple-200/70 shrink-0" />
            </div>
            <div className="mt-2.5 text-[15px] font-black text-white leading-tight truncate">
              {activePlan ? activePlan.title : user ? "Henüz bir planın yok" : "Giriş yapılmadı"}
            </div>
            <div className="mt-1 text-[11.5px] text-purple-200/70" style={{ fontFamily: MONO_FONT }}>
              {user ? `${savedPlansCount} kayıtlı plan` : "Keşfetmeye başla →"}
            </div>
          </button>

          {/* Bento grid — kare kartlar */}
          <div className="grid grid-cols-2 gap-2.5">
            {bentoTiles.map((t) => (
              <BentoTile key={t.key} icon={t.icon} label={t.label} color={t.color} onClick={go(t.onClick)} />
            ))}
          </div>

          {/* Yatay bento şeritleri */}
          <div className="flex flex-col gap-2 mt-0.5">
            <BentoStrip icon={<User className="w-4 h-4" strokeWidth={2.25} />} label="Profil & İstatistikler" onClick={go(onOpenCommunity)} />
            <BentoStrip
              icon={<Settings className="w-4 h-4" strokeWidth={2.25} />}
              label="Ayarlar"
              expandable
              expanded={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
            />
          </div>

          {/* "Ayarlar" akordeonu — eski menünün tercihler/plan/çıkış aksiyonları
              hiçbiri kaybolmadan burada yaşamaya devam eder. */}
          <div className={`accordion-body ${settingsOpen ? "open" : ""}`}>
            <div className="accordion-inner">
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mt-0.5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-white">🔔 Günlük Hatırlatıcılar</span>
                  <ToggleSwitch checked={remindersOn} onChange={onToggleReminders} accent={accent} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] font-semibold text-white leading-snug">📳 Ses & Dokunsal Geri Bildirim</span>
                  <ToggleSwitch checked={hapticsOn} onChange={onToggleHaptics} accent={accent} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={go(onNewPlan)}
                    className="flex-1 rounded-xl py-2.5 text-[12.5px] font-semibold transition-opacity hover:opacity-90"
                    style={{ background: accent, color: "#0A0E13" }}
                  >
                    + Plan Ekle
                  </button>
                  <button
                    onClick={go(onDeletePlan)}
                    disabled={!savedPlansCount}
                    className="flex-1 rounded-xl py-2.5 text-[12.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
                    style={{ background: "rgba(244,64,107,0.12)", color: "#FF6E92", border: "1px solid rgba(244,64,107,0.30)" }}
                  >
                    🗑️ Plan Sil
                  </button>
                </div>
                {user && (
                  <button
                    onClick={go(onSignOut)}
                    className="w-full rounded-xl py-3 text-[12.5px] font-semibold transition-opacity hover:opacity-90"
                    style={{ background: "rgba(240,90,90,0.10)", color: "#F0827A", border: "1px solid rgba(240,90,90,0.25)" }}
                  >
                    🚪 Çıkış Yap
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export default memo(DrawerMenu);
