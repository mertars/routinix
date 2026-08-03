import { memo, useState, useEffect, useMemo } from "react";
import { Repeat2, Compass, ListChecks, Users2, Timer, BarChart3, User, FolderOpen, ChevronRight, X, Trash2, Plus } from "lucide-react";
import { MONO_FONT } from "../constants";
import { fetchDashboardData } from "../services/planService";
import { isRoutineChecked } from "../utils/routineCheckin";

// Nötr Bento kartı (gezinme kareleri + Planlarım/Profil şeritleri) — arka
// plan/kenarlık `--overlay-rgb` token'ı üzerinden kurulur: koyu temada bu
// token BEYAZ (255,255,255), açık temada KOYU LACİVERT (15,23,42) — yani
// AYNI `rgba(var(--overlay-rgb), 0.05)` ifadesi iki temada da otomatik
// doğru yönde ince bir "overlay" tonu üretir (bkz. index.css :root /
// :root[data-theme="light"]). Hardcoded `bg-white/[0.03]` gibi bir değer
// açık temada TAMAMEN yanlış yöne (neredeyse görünmez) giderdi.
const CARD_BG = "rgba(var(--overlay-rgb), 0.05)";
const CARD_BORDER = "1px solid rgba(var(--overlay-rgb), 0.12)";

function BentoTile({ icon, label, gradient, glow, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bento-card card-glow group relative flex flex-col items-start justify-between gap-2 rounded-3xl p-3 pb-2.5 text-left"
      style={{ background: CARD_BG, border: CARD_BORDER }}
    >
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${gradient} shadow-lg ${glow}`}>
        {icon}
      </span>
      <span className="text-[11.5px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
    </button>
  );
}

function BentoStrip({ icon, iconGradient, iconGlow, label, trailing, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bento-card card-glow w-full flex items-center gap-3 rounded-3xl px-4 py-2.5"
      style={{ background: CARD_BG, border: CARD_BORDER }}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${iconGradient} shadow-lg ${iconGlow} shrink-0`}>
        {icon}
      </span>
      <span className="flex-1 text-[13px] font-bold text-left truncate" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      {trailing}
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
    </button>
  );
}

// "Hibrit Bento Bottom Sheet" — mobilde alttan yaylı (spring) açılan gezinme
// paneli (bkz. GlobalStyles.jsx .bento-sheet — md'den itibaren ince bir sağ
// panele dönüşür). Açılış app.jsx'teki yüzen cam kapsül tetikleyiciden gelir.
//
// TEMA: sheet'in kendisi + nötr kartlar TAMAMEN `--glass-rgb`/`--overlay-rgb`/
// `--text-*` token'larıyla kurulur (bkz. index.css) — hiçbir yerde hardcoded
// `bg-black`/`text-white` yok. Yalnızca 3 "hero-tier" kart (Günün İlerlemesi,
// Plan Ekle, Planları Yönet) BİLİNÇLİ olarak kendi katı/opak canlı gradyan
// zeminini taşır (temaya göre DEĞİL) — sebebi: bu kartlar açık temada
// sayfanın beyaz zemininin üzerine oturan YARI SAYDAM bir renk katmanı
// olsaydı (ör. %12 opaklıkta mor), rengi solup üzerindeki beyaz metnin
// kontrastı açık temada çökerdi. Katı/opak bir renk bloğu bu sorunu temaya
// bakılmaksızın kökten çözer.
//
// "Günün İlerlemesi" GERÇEK veriyle çalışır: rutin check-in'leri sunucuda
// tarih-bazlı SAKLANMIYOR (bkz. utils/routineCheckin.js — bilinçli olarak
// yalnızca localStorage, günün tarihine göre anahtarlı). Bu yüzden çok
// günlü bir "seri/streak" sayacı GERÇEK bir veriye dayanamaz — sahte bir
// rakam göstermek yerine bugünün GERÇEK tamamlanma yüzdesini gösteriyoruz.
function DrawerMenu({
  open,
  onClose,
  accent,
  user,
  savedPlansCount,
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
  const [todayRoutines, setTodayRoutines] = useState(null);

  useEffect(() => {
    if (!open || !user) {
      setTodayRoutines(null);
      return;
    }
    let cancelled = false;
    fetchDashboardData(user.id)
      .then((plans) => !cancelled && setTodayRoutines(plans.flatMap((p) => p.routines || [])))
      .catch(() => !cancelled && setTodayRoutines([]));
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const { doneCount, totalCount, todayPct } = useMemo(() => {
    const list = todayRoutines || [];
    const done = list.filter((r) => isRoutineChecked(r.id)).length;
    return { doneCount: done, totalCount: list.length, todayPct: list.length > 0 ? Math.round((done / list.length) * 100) : 0 };
  }, [todayRoutines]);

  if (!open) return null;

  const go = (fn) => () => {
    fn?.();
    onClose?.();
  };

  const bentoTiles = [
    { key: "routines", icon: <Repeat2 className="w-4 h-4" strokeWidth={2.5} />, label: "Rutinlerim", gradient: "from-emerald-400 to-teal-600", glow: "shadow-emerald-500/30", onClick: onOpenRoutines, always: false },
    { key: "hub", icon: <Compass className="w-4 h-4" strokeWidth={2.5} />, label: "Keşfet / Şablonlar", gradient: "from-amber-400 to-orange-600", glow: "shadow-orange-500/30", onClick: onOpenHub, always: true },
    { key: "tasks", icon: <ListChecks className="w-4 h-4" strokeWidth={2.5} />, label: "Görevler", gradient: "from-cyan-400 to-blue-600", glow: "shadow-blue-500/30", onClick: onOpenTasks, always: false },
    { key: "community", icon: <Users2 className="w-4 h-4" strokeWidth={2.5} />, label: "Routinix Nexus", gradient: "from-purple-500 to-indigo-600", glow: "shadow-purple-500/30", onClick: onOpenCommunity, always: true },
    { key: "rhythm", icon: <BarChart3 className="w-4 h-4" strokeWidth={2.5} />, label: "Ritim & Gün Sonu", gradient: "from-violet-500 to-purple-700", glow: "shadow-violet-500/30", onClick: onOpenRhythm, always: false },
    { key: "pomodoro", icon: <Timer className="w-4 h-4" strokeWidth={2.5} />, label: "Pomodoro & Focus", gradient: "from-pink-500 to-rose-600", glow: "shadow-pink-500/30", onClick: onOpenPomodoro, always: true },
  ].filter((t) => t.always || user);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div
        className="bento-sheet blur-cap-mobile fixed z-50 flex flex-col backdrop-blur-2xl no-scrollbar"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          border: "1px solid var(--modal-border)",
          boxShadow: "0 -24px 60px -24px rgba(0,0,0,0.45)",
        }}
      >
        <div className="neon-strip" />

        <div className="relative shrink-0">
          {/* Çekme çizgisi — yalnızca mobil bottom-sheet halinde (bkz. .bento-sheet md:hidden override) */}
          <div className="bento-drag-handle flex justify-center pt-3 pb-1">
            <div className="w-10 h-1.5 rounded-full" style={{ background: "rgba(var(--overlay-rgb),0.2)" }} />
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="absolute top-2.5 right-3 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-muted)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-1.5 flex flex-col gap-2">
          {/* Günün İlerlemesi — gerçek rutin check-in verisiyle, katı mor/indigo zemin */}
          <button
            type="button"
            onClick={go(onOpenRoutines)}
            className="bento-card card-glow w-full text-left rounded-3xl p-4 relative overflow-hidden text-white"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)", border: "1px solid rgba(255,255,255,0.18)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)", color: "#F3E8FF" }}>
                ☀️ Günün İlerlemesi
              </span>
              {totalCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: todayPct === 100 ? "#B9F8CF" : "#F3E8FF", fontFamily: MONO_FONT }}>
                  {todayPct === 100 ? "🔥 Bugün Tamamlandı!" : `${doneCount}/${totalCount} rutin`}
                </span>
              )}
            </div>
            {totalCount > 0 ? (
              <>
                <div className="mt-2.5 text-[22px] font-black leading-none" style={{ fontFamily: MONO_FONT }}>
                  %{todayPct} <span className="text-[12px] font-bold text-purple-100/80">Tamamlandı</span>
                </div>
                <div className="mt-2.5 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.16)" }}>
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${todayPct}%`, background: "#ffffff" }} />
                </div>
              </>
            ) : (
              <div className="mt-2.5 text-[13px] font-bold">{user ? "Henüz rutin eklenmedi" : "Giriş yapılmadı"}</div>
            )}
          </button>

          {/* Direkt aksiyonlar — büyük, dolgun, katı renkli premium kartlar
              (eski "Ayarlar" akordeonu/toggle'ları bilerek kaldırıldı). */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={go(onNewPlan)}
              className="bento-card card-glow flex flex-col items-start justify-between gap-3 rounded-3xl p-5 text-left"
              style={{ background: accent, border: "1px solid rgba(255,255,255,0.25)" }}
            >
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(10,14,19,0.16)", color: "#0A0E13" }}>
                <Plus className="w-5 h-5" strokeWidth={2.75} />
              </span>
              <span className="text-[14.5px] font-black leading-tight" style={{ color: "#0A0E13" }}>
                Plan Ekle
              </span>
            </button>
            <button
              onClick={go(onDeletePlan)}
              disabled={!savedPlansCount}
              className="bento-card card-glow flex flex-col items-start justify-between gap-3 rounded-3xl p-5 text-left text-white disabled:opacity-40 disabled:pointer-events-none"
              style={{ background: "linear-gradient(135deg, #FB7185 0%, #E11D48 100%)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/20">
                <Trash2 className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <span className="text-[14.5px] font-black leading-tight">Planları Yönet</span>
            </button>
          </div>

          {/* Bento grid — kare gezinme kartları */}
          <div className="grid grid-cols-2 gap-2">
            {bentoTiles.map((t) => (
              <BentoTile key={t.key} icon={t.icon} label={t.label} gradient={t.gradient} glow={t.glow} onClick={go(t.onClick)} />
            ))}
          </div>

          {/* Planlarım — birden fazla kayıtlı plan arasında GEÇİŞ (DeletePlanModal
              yalnızca SİLME içindir, ikisi farklı ihtiyaç). */}
          {user && savedPlansCount > 0 && (
            <BentoStrip
              icon={<FolderOpen className="w-4 h-4" strokeWidth={2.5} />}
              iconGradient="from-slate-400 to-slate-600"
              iconGlow="shadow-slate-500/30"
              label="Planlarım"
              onClick={go(onOpenPlans)}
            />
          )}

          {/* Profil & İstatistikler — doğrudan kendi Nexus profiline açılır */}
          {user && (
            <BentoStrip
              icon={<User className="w-4 h-4" strokeWidth={2.5} />}
              iconGradient="from-sky-400 to-indigo-600"
              iconGlow="shadow-indigo-500/30"
              label="Profil & İstatistikler"
              trailing={
                <span className="text-[10.5px] font-semibold shrink-0 truncate max-w-[70px]" style={{ color: "var(--text-muted)", fontFamily: MONO_FONT }}>
                  {savedPlansCount} plan
                </span>
              }
              onClick={go(onOpenProfile)}
            />
          )}
        </div>
      </div>
    </>
  );
}
export default memo(DrawerMenu);
