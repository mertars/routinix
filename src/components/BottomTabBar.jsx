import { memo, useState } from "react";
import { Compass, Repeat2, User, Plus, Share2 } from "lucide-react";

function Tab({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 py-2 flex-1 transition-colors active:scale-95"
      style={{ color: "var(--text-secondary)" }}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

// "Feature-First Mobile Layout" — gizli hamburger/çekmece menü YERİNE,
// mobilde HER ZAMAN görünür, sabit bir alt gezinme barı (bkz. app.jsx: eski
// Header ortası tetikleyici + DrawerMenu artık yalnızca masaüstünde
// (md:flex) erişilebilir — mobilde Ritim/Görevler/Planlarım gibi ikincil
// hedefler kayboldu DEĞİL, DrawerMenu masaüstünde hâlâ duruyor; mobildeki
// EN SIK kullanılan 3 hedef + hızlı eylemler artık burada, tek dokunuşla).
//
// Ortadaki "+" FAB barın üstünden taşar (grid hücresi DEĞİL, mutlak
// konumlandırılmış) — bastığında Plan Ekle/Şablon Paylaş için küçük bir
// hızlı-eylem paneli açılır.
function BottomTabBar({ onOpenCommunity, onOpenRoutines, onOpenProfile, onNewPlan }) {
  const [quickOpen, setQuickOpen] = useState(false);

  const go = (fn) => () => {
    setQuickOpen(false);
    fn?.();
  };

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40">
      {quickOpen && (
        <>
          <div className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease]" onClick={() => setQuickOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+0.75rem)] w-[min(88vw,320px)] flex flex-col gap-2 p-2 rounded-3xl backdrop-blur-2xl bg-white/95 dark:bg-[#0c0d12]/95 border border-purple-500/30 dark:border-white/10 shadow-2xl animate-[modalPopIn_0.2s_cubic-bezier(0.32,0.72,0,1)]">
            <button
              onClick={go(onNewPlan)}
              className="card-glow flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
              style={{ background: "linear-gradient(135deg, #22D3EE, #7C3AED)" }}
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20 text-white shrink-0">
                <Plus className="w-4.5 h-4.5" strokeWidth={2.75} />
              </span>
              <span className="text-[13.5px] font-black text-white">Plan Ekle</span>
            </button>
            <button
              onClick={go(onOpenCommunity)}
              className="card-glow flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
              style={{ background: "rgba(var(--overlay-rgb),0.05)", border: "1px solid rgba(var(--overlay-rgb),0.12)" }}
            >
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-pink-500 to-rose-600 shrink-0">
                <Share2 className="w-4.5 h-4.5" strokeWidth={2.5} />
              </span>
              <span className="text-[13.5px] font-black" style={{ color: "var(--text-primary)" }}>
                Şablon Paylaş
              </span>
            </button>
          </div>
        </>
      )}

      <nav
        className="relative grid grid-cols-3 items-center backdrop-blur-xl bg-white/90 dark:bg-[#0c0d12]/90 border-t border-slate-200 dark:border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <Tab icon={<Compass className="w-5 h-5" strokeWidth={2.25} />} label="Keşfet" onClick={onOpenCommunity} />
        <Tab icon={<Repeat2 className="w-5 h-5" strokeWidth={2.25} />} label="Rutinlerim" onClick={onOpenRoutines} />
        <Tab icon={<User className="w-5 h-5" strokeWidth={2.25} />} label="Nexus Profil" onClick={onOpenProfile} />

        <button
          type="button"
          onClick={() => setQuickOpen((v) => !v)}
          aria-label="Hızlı Eylemler"
          className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full flex items-center justify-center text-white transition-transform active:scale-95"
          style={{
            background: "linear-gradient(135deg, #B26BFF, #22D3EE)",
            boxShadow: "0 10px 26px -6px rgba(178,107,255,0.55), 0 0 0 4px var(--bg-app)",
          }}
        >
          <Plus className={`w-6 h-6 transition-transform duration-200 ${quickOpen ? "rotate-45" : ""}`} strokeWidth={2.75} />
        </button>
      </nav>
    </div>
  );
}
export default memo(BottomTabBar);
