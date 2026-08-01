import { memo } from "react";
import { Timer, BarChart3 } from "lucide-react";
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

// Sağdan açılan cam efektli, mor/kırmızı neon aksanlı kontrol paneli. `open`
// çoğunlukla false; memo + App.jsx'in stabilize edilmiş callback'leri
// sayesinde kapalıyken alakasız App re-render'larında (ör. yazı yazarken)
// bu bileşenin fonksiyon gövdesi hiç çalışmaz.
function DrawerMenu({
  open,
  onClose,
  accent,
  accentSoft,
  user,
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
  onOpenPomodoro,
}) {
  if (!open) return null;

  // Mobilde navbar'da gizlenen aksiyon butonları (masaüstünde zaten header'da
  // yatay sıralı olduğu için burada yalnızca md altında gösterilir).
  const quickAccess = [
    { key: "hub", emoji: "✨", label: "Şablon Keşfet", color: "#F0B37E", onClick: onOpenHub, always: true },
    { key: "tasks", emoji: "📋", label: "Görevler ve Planlar", color: "#00F2FE", onClick: onOpenTasks, always: false },
    { key: "routines", emoji: "🔁", label: "Rutinler", color: "#7DE9C3", onClick: onOpenRoutines, always: false },
    { key: "plans", emoji: "📂", label: "Planlarım", color: "#8FA0FF", onClick: onOpenPlans, always: false },
    { key: "rhythm", icon: <BarChart3 className="w-4 h-4" strokeWidth={2.25} />, label: "Ritim & Gün Sonu", color: "#A78BFA", onClick: onOpenRhythm, always: false },
    { key: "pomodoro", icon: <Timer className="w-4 h-4" strokeWidth={2.25} />, label: "Pomodoro & Focus", color: "#FB7185", onClick: onOpenPomodoro, always: true },
  ].filter((b) => b.always || user);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div
        className="blur-cap-mobile fixed top-0 right-0 z-50 h-full w-[86%] max-w-[340px] flex flex-col drawer-panel no-scrollbar"
        style={{
          // Okunabilirlik önceliği: yoğun "buzlu cam" yerine büyük ölçüde OPAK bir
          // zemin + hafif blur. --alpha-chrome (Header'ın şeffaf ambient katmanı)
          // yerine bilinçli olarak --alpha-modal kullanılıyor — bu, uygulamadaki
          // "yüksek okunabilirlik" katmanı (AI Koç, dropdown'lar) ile aynı token.
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
          borderLeft: "1px solid var(--sidebar-border)",
          boxShadow: "-24px 0 70px -20px rgba(0,0,0,0.7), inset 1px 0 20px -10px rgba(178,107,255,0.35)",
        }}
      >
        {/* Üstte mor/kırmızı neon şerit */}
        <div className="neon-strip" />

        {/* Header & Profil */}
        <div className="px-5 pt-5 pb-5 border-b" style={{ borderColor: "rgba(var(--overlay-rgb),0.08)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ background: accentSoft, color: accent, border: "1px solid rgba(var(--overlay-rgb),0.1)" }}
              >
                {user ? (user.email || "?").charAt(0).toUpperCase() : "👤"}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">{user ? user.email : "Misafir"}</div>
                <span className="text-[11.5px] text-[var(--text-muted)]">
                  {user ? `${savedPlansCount} kayıtlı plan` : "Giriş yapılmadı"}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              style={{ background: "rgba(var(--overlay-rgb),0.05)" }}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-5 flex flex-col gap-5">
          {/* Hızlı Erişim — yalnızca mobilde (md'den itibaren bu butonlar zaten header'da) */}
          <div className="md:hidden">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)] mb-2">Hızlı Erişim</p>
            <div className="grid grid-cols-2 gap-2">
              {quickAccess.map((b) => (
                <button
                  key={b.key}
                  onClick={b.onClick}
                  className="flex flex-col items-start gap-1 rounded-xl p-3 text-left transition-colors card-glow"
                  style={{ background: `${b.color}14`, border: `1px solid ${b.color}40` }}
                >
                  {b.icon ? (
                    <span className="text-[16px]" style={{ color: b.color }}>
                      {b.icon}
                    </span>
                  ) : (
                    <span className="text-[16px]">{b.emoji}</span>
                  )}
                  <span className="text-[11.5px] font-bold tracking-wide leading-snug" style={{ color: b.color }}>
                    {b.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Özet */}
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)] mb-2">Özet</p>
            <div className="rounded-xl p-3.5" style={{ background: "rgba(var(--overlay-rgb),0.045)", border: "1px solid rgba(var(--overlay-rgb),0.08)" }}>
              <div className="text-[20px] font-bold text-[var(--text-primary)]" style={{ fontFamily: MONO_FONT }}>
                {savedPlansCount}
              </div>
              <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">Kayıtlı Plan</div>
            </div>
          </div>

          {/* Hızlı ayarlar */}
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)] mb-2">Tercihler</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between py-2">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">🔔 Günlük Hatırlatıcılar</span>
                <ToggleSwitch checked={remindersOn} onChange={onToggleReminders} accent={accent} />
              </div>
              <div className="flex items-center justify-between py-2 gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">📳 Ses & Dokunsal Geri Bildirim</span>
                <ToggleSwitch checked={hapticsOn} onChange={onToggleHaptics} accent={accent} />
              </div>
            </div>
          </div>
        </div>

        {/* Aksiyonlar */}
        <div className="px-5 py-5 border-t flex flex-col gap-2.5" style={{ borderColor: "rgba(var(--overlay-rgb),0.08)" }}>
          {/* Yan yana: Plan Ekle + Plan Sil */}
          <div className="flex gap-2.5">
            <button
              onClick={onNewPlan}
              className="flex-1 rounded-xl py-3 text-[13px] font-semibold transition-opacity hover:opacity-90 card-glow"
              style={{ background: accent, color: "#0A0E13" }}
            >
              + Plan Ekle
            </button>
            <button
              onClick={onDeletePlan}
              disabled={!savedPlansCount}
              className="flex-1 rounded-xl py-3 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none card-glow"
              style={{ background: "rgba(244,64,107,0.12)", color: "#FF6E92", border: "1px solid rgba(244,64,107,0.30)" }}
            >
              🗑️ Plan Sil
            </button>
          </div>
          {/* Tek parça büyük: Çıkış Yap */}
          {user && (
            <button
              onClick={onSignOut}
              className="w-full rounded-xl py-3.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "rgba(240,90,90,0.10)", color: "#F0827A", border: "1px solid rgba(240,90,90,0.25)" }}
            >
              🚪 Çıkış Yap
            </button>
          )}
        </div>
      </div>
    </>
  );
}
export default memo(DrawerMenu);
