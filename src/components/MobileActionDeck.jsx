import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Repeat2, Timer, User, X, Plus, Trash2 } from "lucide-react";
import { MONO_FONT } from "../constants";
import { fetchDashboardData } from "../services/planService";
import { isRoutineChecked } from "../utils/routineCheckin";

const CARD_BG = "rgba(var(--overlay-rgb), 0.05)";
const CARD_BORDER = "1px solid rgba(var(--overlay-rgb), 0.12)";

// Bugünün GERÇEK rutin tamamlama yüzdesi — DrawerMenu.jsx'teki AYNI mantık
// (bkz. orada ki uzun yorum): rutin check-in'leri sunucuda tarih-bazlı
// SAKLANMIYOR, yalnızca localStorage'da bugünün tarihiyle. Bu yüzden burada
// da sahte bir "seri" sayısı YOK, yalnızca gerçek, o an hesaplanabilir %.
function useTodayProgress(user) {
  const [routines, setRoutines] = useState(null);

  useEffect(() => {
    if (!user) {
      setRoutines(null);
      return;
    }
    let cancelled = false;
    fetchDashboardData(user.id)
      .then((plans) => !cancelled && setRoutines(plans.flatMap((p) => p.routines || [])))
      .catch(() => !cancelled && setRoutines([]));
    return () => {
      cancelled = true;
    };
  }, [user]);

  return useMemo(() => {
    const list = routines || [];
    const done = list.filter((r) => isRoutineChecked(r.id)).length;
    return { totalCount: list.length, todayPct: list.length > 0 ? Math.round((done / list.length) * 100) : 0 };
  }, [routines]);
}

function FrontCard({ icon, label, value, gradient, glow, onClick, side, revealed }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      animate={{ x: revealed ? (side === "left" ? -18 : 18) : 0, opacity: revealed ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{ pointerEvents: revealed ? "none" : "auto", background: CARD_BG, border: CARD_BORDER }}
      className="bento-card card-glow relative flex items-center gap-3 rounded-3xl p-3.5 text-left"
    >
      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br ${gradient} shadow-lg ${glow} shrink-0`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10.5px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <span className="block text-[15px] font-black truncate" style={{ color: "var(--text-primary)", fontFamily: MONO_FONT }}>
          {value}
        </span>
      </span>
    </motion.button>
  );
}

// "Center Split Reveal" — Routinix ana ekranındaki 2x2 Bento kart bloğu.
// Kullanıcı yatay kaydırdığında (ya da ortadaki indikatöre dokunduğunda)
// sol sütun sola, sağ sütun sağa akıcı bir spring'le ayrılır ve arkasındaki
// aksiyon panelini (Eylem Deck'i) açığa çıkarır. DrawerMenu.jsx'in (☰ menü)
// YERİNE geçmez — o hâlâ tüm gezinme hedeflerini taşıyor; bu, ana ekrandaki
// en sık kullanılan 4 kısayol için AYRI, kasıtlı olarak dar kapsamlı bir
// hızlı-erişim bileşenidir.
//
// TEMA: DrawerMenu ile birebir aynı token seti (`--overlay-rgb`/`--text-*`/
// `--glass-rgb`/`--modal-border`) — hiçbir hardcoded siyah/beyaz yok, tek
// kaynaktan (index.css) hem koyu hem açık temada doğru çalışır. Kartlarda
// TEK bir `border` katmanı var (çift kenarlık hatası burada da bilerek
// tekrarlanmadı).
export default function MobileActionDeck({ user, planGoal, onOpenRoutines, onOpenPomodoro, onOpenProfile, onNewPlan, onDeletePlan }) {
  const [revealed, setRevealed] = useState(false);
  const { totalCount, todayPct } = useTodayProgress(user);

  const cards = [
    {
      key: "progress",
      side: "left",
      icon: <Sparkles className="w-[18px] h-[18px]" strokeWidth={2.25} />,
      label: "İlerleme",
      value: totalCount > 0 ? `%${todayPct}` : "—",
      gradient: "from-cyan-400 to-purple-600",
      glow: "shadow-purple-500/30",
      onClick: () => setRevealed((v) => !v),
    },
    {
      key: "routines",
      side: "right",
      icon: <Repeat2 className="w-[18px] h-[18px]" strokeWidth={2.25} />,
      label: "Rutinler",
      value: "Bugün",
      gradient: "from-emerald-400 to-teal-600",
      glow: "shadow-emerald-500/30",
      onClick: onOpenRoutines,
    },
    {
      key: "pomodoro",
      side: "left",
      icon: <Timer className="w-[18px] h-[18px]" strokeWidth={2.25} />,
      label: "Pomodoro",
      value: "Odaklan",
      gradient: "from-pink-500 to-rose-600",
      glow: "shadow-pink-500/30",
      onClick: onOpenPomodoro,
    },
    {
      key: "profile",
      side: "right",
      icon: <User className="w-[18px] h-[18px]" strokeWidth={2.25} />,
      label: "Profil",
      value: "Nexus",
      gradient: "from-sky-400 to-indigo-600",
      glow: "shadow-indigo-500/30",
      onClick: onOpenProfile,
    },
  ];

  const handlePanEnd = (_e, info) => {
    if (Math.abs(info.offset.x) > 44 || Math.abs(info.velocity.x) > 350) setRevealed((v) => !v);
  };

  return (
    <div className="md:hidden relative w-full mb-5" style={{ minHeight: 168 }}>
      {/* Arka katman — açılan eylem paneli */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="absolute inset-0 z-0 flex flex-col gap-3 rounded-3xl p-4"
            style={{ background: "rgba(var(--glass-rgb), var(--alpha-modal))", border: "1px solid var(--modal-border)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)" }}
          >
            <button
              onClick={() => setRevealed(false)}
              aria-label="Kapat"
              className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-muted)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div
              className="rounded-2xl p-3.5 pr-9"
              style={{
                background: "rgba(var(--overlay-rgb),0.045)",
                boxShadow: "-6px 0 18px -6px rgba(178,107,255,0.4), 6px 0 18px -6px rgba(34,211,238,0.35), 0 0 0 1px rgba(178,107,255,0.3)",
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-faint)" }}>
                🎯 Bugünkü Odak Noktan
              </p>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed line-clamp-2" style={{ color: "var(--text-primary)" }}>
                {planGoal || "Henüz bir hedef belirlenmedi — yeni bir plan başlat."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
              <button
                onClick={() => {
                  onNewPlan?.();
                  setRevealed(false);
                }}
                className="card-glow flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-black text-white transition-transform active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg, #22D3EE, #7C3AED)" }}
              >
                <Plus className="w-4 h-4" strokeWidth={2.75} /> Plan Ekle
              </button>
              <button
                onClick={() => {
                  onDeletePlan?.();
                  setRevealed(false);
                }}
                className="card-glow flex items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-bold transition-colors active:scale-[0.97]"
                style={{ background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-secondary)", border: "1px solid rgba(var(--overlay-rgb),0.14)" }}
              >
                <Trash2 className="w-4 h-4" /> Planları Yönet
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ön katman — 2x2 Bento grid, yatay pan jestiyle ikiye ayrılır */}
      <motion.div className="relative z-10 grid grid-cols-2 gap-2.5" onPanEnd={handlePanEnd}>
        {cards.map((c) => (
          <FrontCard
            key={c.key}
            icon={c.icon}
            label={c.label}
            value={c.value}
            gradient={c.gradient}
            glow={c.glow}
            side={c.side}
            revealed={revealed}
            onClick={c.onClick}
          />
        ))}

        {/* Ortadaki yön indikatörü — dokununca da paneli açar/kapatır */}
        <motion.button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          animate={{ opacity: revealed ? 0 : 1, x: [0, 3, -3, 0] }}
          transition={{ opacity: { duration: 0.2 }, x: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } }}
          style={{ pointerEvents: revealed ? "none" : "auto", background: "rgba(var(--glass-rgb), var(--alpha-modal))", border: "1px solid var(--modal-border)", color: "var(--text-secondary)" }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded-full px-3 py-1.5 text-[10.5px] font-bold whitespace-nowrap backdrop-blur-md"
        >
          ↔ Eylemler için kaydır
        </motion.button>
      </motion.div>
    </div>
  );
}
