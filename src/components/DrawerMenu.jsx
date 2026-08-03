import { memo, useState, useEffect, useMemo } from "react";
import { Repeat2, Compass, ListChecks, Users2, Timer, BarChart3, User, FolderOpen, ChevronRight, X, Trash2 } from "lucide-react";
import { MONO_FONT } from "../constants";
import { fetchDashboardData } from "../services/planService";
import { isRoutineChecked } from "../utils/routineCheckin";

// Kare Bento kartı — Rutinlerim/Keşfet/Görevler/Nexus/Ritim/Pomodoro TÜM
// birincil gezinme hedefleri AYNI bu dilde render edilir; yalnızca ikon/
// gradyan/etiket değişir. `gradient`/`glow` gerçek Tailwind sınıfları
// (örn. "from-purple-500 to-indigo-600" / "shadow-purple-500/30").
function BentoTile({ icon, label, gradient, glow, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-glow group relative flex flex-col items-start justify-between gap-2.5 rounded-2xl p-3 h-[74px] text-left bg-white/[0.03] border border-white/10 transition-colors duration-150 active:border-purple-500/50 active:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${gradient} shadow-lg ${glow}`}>
        {icon}
      </span>
      <span className="text-[11.5px] font-bold text-white leading-tight">{label}</span>
    </button>
  );
}

// "Hibrit Bento Bottom Sheet" — mobilde alttan yaylı (spring) açılan,
// kaydırma GEREKTİRMEYEN, tek ekrana sığan bir gezinme paneli (bkz.
// GlobalStyles.jsx .bento-sheet — md'den itibaren ince bir sağ panele
// dönüşür). Eski ☰ header butonu KALDIRILDI — açılış artık app.jsx'teki
// yüzen alt-orta "Menü" dock'undan tetiklenir.
//
// "Günün İlerlemesi" GERÇEK veriyle çalışır: rutin check-in'leri sunucuda
// tarih-bazlı SAKLANMIYOR (bkz. utils/routineCheckin.js — bilinçli olarak
// yalnızca localStorage, günün tarihine göre anahtarlı). Bu yüzden çok
// günlü bir "seri/streak" sayacı GERÇEK bir veriye dayanamaz — sahte bir
// rakam göstermek yerine bugünün GERÇEK tamamlanma yüzdesini gösteriyoruz;
// %100 olduğunda "seri" hissini kutlama rozetiyle (🔥 Bugün Tamamlandı!)
// veriyoruz. Çok-günlü streak GERÇEKTEN isteniyorsa sunucu tarafında yeni
// bir tarih-bazlı tablo gerekir — bu, bir menü redesign'ının kapsamı DEĞİL.
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

        <div className="relative shrink-0">
          {/* Çekme çizgisi — yalnızca mobil bottom-sheet halinde (bkz. .bento-sheet md:hidden override) */}
          <div className="bento-drag-handle flex justify-center pt-3 pb-1">
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="absolute top-2.5 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Kaydırma GEREKTİRMEYECEK şekilde sıkıştırılmış içerik — overflow-y-auto
            yalnızca çok küçük ekran/büyütülmüş yazı tipi gibi uç durumlar için
            bir güvenlik ağı olarak kalır, normal telefonlarda hiç tetiklenmez. */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-1.5 flex flex-col gap-2">
          {/* Günün İlerlemesi — gerçek rutin check-in verisiyle */}
          <button type="button" onClick={go(onOpenRoutines)} className="card-glow w-full text-left rounded-3xl p-4 relative overflow-hidden active:border-purple-500/50 active:shadow-[0_0_20px_rgba(168,85,247,0.2)]" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(99,102,241,0.18))", border: "1px solid rgba(168,85,247,0.35)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded-full" style={{ background: "rgba(168,85,247,0.25)", color: "#E9D5FF" }}>
                ☀️ Günün İlerlemesi
              </span>
              {totalCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: todayPct === 100 ? "#7DE9C3" : "#E9D5FF", fontFamily: MONO_FONT }}>
                  {todayPct === 100 ? "🔥 Bugün Tamamlandı!" : `${doneCount}/${totalCount} rutin`}
                </span>
              )}
            </div>
            {totalCount > 0 ? (
              <>
                <div className="mt-2.5 text-[22px] font-black text-white leading-none" style={{ fontFamily: MONO_FONT }}>
                  %{todayPct} <span className="text-[12px] font-bold text-purple-200/70">Tamamlandı</span>
                </div>
                <div className="mt-2.5 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${todayPct}%`, background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
                  />
                </div>
              </>
            ) : (
              <div className="mt-2.5 text-[13px] font-bold text-white">
                {user ? "Henüz rutin eklenmedi" : "Giriş yapılmadı"}
              </div>
            )}
          </button>

          {/* Bento grid — kare kartlar */}
          <div className="grid grid-cols-2 gap-2">
            {bentoTiles.map((t) => (
              <BentoTile key={t.key} icon={t.icon} label={t.label} gradient={t.gradient} glow={t.glow} onClick={go(t.onClick)} />
            ))}
          </div>

          {/* Direkt aksiyonlar — eski "Ayarlar" akordeonu/toggle'ları YOK
              (bilerek kaldırıldı, bkz. istek notu); yalnızca en sık kullanılan
              2 aksiyon doğrudan burada. */}
          <div className="flex gap-2">
            <button
              onClick={go(onNewPlan)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[12.5px] font-bold transition-opacity hover:opacity-90"
              style={{ background: accent, color: "#0A0E13" }}
            >
              ➕ Plan Ekle
            </button>
            <button
              onClick={go(onDeletePlan)}
              disabled={!savedPlansCount}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[12.5px] font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
              style={{ background: "rgba(244,64,107,0.12)", color: "#FF6E92", border: "1px solid rgba(244,64,107,0.30)" }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Planları Yönet
            </button>
          </div>

          {/* Planlarım — birden fazla kayıtlı plan arasında GEÇİŞ (DeletePlanModal
              yalnızca SİLME içindir, ikisi farklı ihtiyaç — bkz. tasarım notu). */}
          {user && savedPlansCount > 0 && (
            <button
              type="button"
              onClick={go(onOpenPlans)}
              className="card-glow w-full flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/[0.03] border border-white/10 transition-colors duration-150 active:border-purple-500/50 active:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-600 shadow-lg shadow-slate-500/30 text-white shrink-0">
                <FolderOpen className="w-4 h-4" strokeWidth={2.5} />
              </span>
              <span className="flex-1 text-[13px] font-bold text-white text-left truncate">Planlarım</span>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          )}

          {/* Profil & İstatistikler — doğrudan kendi Nexus profiline açılır */}
          {user && (
            <button
              type="button"
              onClick={go(onOpenProfile)}
              className="card-glow w-full flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/[0.03] border border-white/10 transition-colors duration-150 active:border-purple-500/50 active:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-sky-400 to-indigo-600 shadow-lg shadow-indigo-500/30 text-white shrink-0">
                <User className="w-4 h-4" strokeWidth={2.5} />
              </span>
              <span className="flex-1 text-[13px] font-bold text-white text-left truncate">Profil & İstatistikler</span>
              <span className="text-[10.5px] font-semibold text-purple-200/70 shrink-0 truncate max-w-[90px]" style={{ fontFamily: MONO_FONT }}>
                {savedPlansCount} plan
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
export default memo(DrawerMenu);
