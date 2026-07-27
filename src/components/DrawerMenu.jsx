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
      style={{ background: checked ? accent : "rgba(255,255,255,0.14)" }}
    >
      <span
        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all duration-200"
        style={{ left: checked ? "20px" : "2px" }}
      />
    </button>
  );
}

// Sağdan açılan cam efektli kontrol paneli — yeni pipeline modeline sadeleştirildi.
export default function DrawerMenu({
  open,
  onClose,
  accent,
  accentSoft,
  user,
  savedPlansCount,
  remindersOn,
  onToggleReminders,
  focusSoundsOn,
  onToggleFocusSounds,
  onNewPlan,
  onSignOut,
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div
        className="fixed top-0 right-0 z-50 h-full w-[86%] max-w-[340px] flex flex-col drawer-panel no-scrollbar"
        style={{
          background: "rgba(15,20,27,0.78)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-24px 0 60px -20px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header & Profil */}
        <div className="px-5 pt-6 pb-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ background: accentSoft, color: accent, border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {user ? (user.email || "?").charAt(0).toUpperCase() : "👤"}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#ECF2F4] truncate">{user ? user.email : "Misafir"}</div>
                <span className="text-[11.5px] text-[#8695A3]">
                  {user ? `${savedPlansCount} kayıtlı plan` : "Giriş yapılmadı"}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8695A3] hover:text-[#ECF2F4] transition-colors shrink-0"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-5 flex flex-col gap-5">
          {/* Özet */}
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#7C8894] mb-2">Özet</p>
            <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[20px] font-bold text-[#ECF2F4]" style={{ fontFamily: MONO_FONT }}>
                {savedPlansCount}
              </div>
              <div className="text-[10.5px] text-[#8695A3] mt-0.5">Kayıtlı Plan</div>
            </div>
          </div>

          {/* Hızlı ayarlar */}
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#7C8894] mb-2">Hızlı Ayarlar</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between py-2">
                <span className="text-[13px] font-medium text-[#ECF2F4]">🔔 Günlük Hatırlatıcılar</span>
                <ToggleSwitch checked={remindersOn} onChange={onToggleReminders} accent={accent} />
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[13px] font-medium text-[#ECF2F4]">🎵 Odaklanma Sesleri</span>
                <ToggleSwitch checked={focusSoundsOn} onChange={onToggleFocusSounds} accent={accent} />
              </div>
            </div>
          </div>
        </div>

        {/* Aksiyonlar */}
        <div className="px-5 py-5 border-t flex flex-col gap-2.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <button
            onClick={onNewPlan}
            className="w-full rounded-xl py-3 text-[13.5px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: accent, color: "#0A0E13" }}
          >
            + Yeni Plan Oluştur
          </button>
          {user && (
            <button
              onClick={onSignOut}
              className="w-full rounded-xl py-3 text-[13.5px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "rgba(240,90,90,0.10)", color: "#F0827A", border: "1px solid rgba(240,90,90,0.25)" }}
            >
              Çıkış Yap
            </button>
          )}
        </div>
      </div>
    </>
  );
}
