import { useState, useEffect, useMemo } from "react";
import { Share2, Plus, Trash2 } from "lucide-react";
import { MONO_FONT } from "../constants";
import { fetchDashboardData } from "../services/planService";
import { isRoutineChecked } from "../utils/routineCheckin";

// Bugünün GERÇEK rutin tamamlama yüzdesi. Rutin check-in'leri sunucuda
// tarih-bazlı SAKLANMIYOR (bkz. utils/routineCheckin.js — bilinçli olarak
// yalnızca localStorage, günün tarihine göre anahtarlı). Bu yüzden çok
// günlü bir "seri/streak" GÜN SAYISI gerçek bir veriye dayanamaz — kart
// bunun yerine bugünün gerçek % ilerlemesini gösterir, %100 olunca "seri"
// hissini gerçek bir kutlama rozetiyle (🔥) verir; uydurma bir gün sayısı
// GÖSTERİLMEZ.
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

// "Feature-First Mobile Layout" — ana ekranda HER ZAMAN görünür bento kart
// akışı (eski "Center Split Reveal" swipe-jesti bilinçli olarak kaldırıldı:
// bu turun isteği "hiçbir özellik derin menülere/jestlere saklanmasın" —
// bir kaydırma jesti arkasına gizlemek de bu ilkeyle çelişirdi). framer-motion
// bu yüzden artık kullanılmıyor; paketten de kaldırıldı (bkz. package.json).
export default function MobileActionDeck({ user, planGoal, onOpenCommunity, onNewPlan, onDeletePlan, savedPlansCount }) {
  const { totalCount, todayPct } = useTodayProgress(user);

  return (
    <div className="md:hidden w-full mb-5 flex flex-col gap-2.5">
      {/* 1) Günün İlerlemesi & Seri Kartı */}
      <div
        className="rounded-3xl p-4 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)", border: "1px solid rgba(255,255,255,0.18)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)", color: "#F3E8FF" }}>
            ☀️ Günün İlerlemesi
          </span>
          {totalCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: todayPct === 100 ? "#B9F8CF" : "#F3E8FF", fontFamily: MONO_FONT }}>
              {todayPct === 100 ? "🔥 Seri Devam Ediyor!" : `${todayPct}% tamam`}
            </span>
          )}
        </div>
        {totalCount > 0 ? (
          <>
            <div className="mt-2.5 text-[24px] font-black leading-none" style={{ fontFamily: MONO_FONT }}>
              %{todayPct} <span className="text-[12px] font-bold text-purple-100/80">Tamamlandı</span>
            </div>
            <div className="mt-2.5 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.16)" }}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${todayPct}%`, background: "#ffffff" }} />
            </div>
          </>
        ) : (
          <p className="mt-2.5 text-[13px] font-bold">{user ? "Henüz rutin eklenmedi" : "Giriş yapılmadı"}</p>
        )}
        {planGoal && <p className="mt-2.5 text-[11.5px] font-semibold text-purple-100/75 line-clamp-1">🎯 {planGoal}</p>}
      </div>

      {/* 2) Sosyal & Paylaşım Showcase Kartı */}
      <button
        type="button"
        onClick={onOpenCommunity}
        className="card-glow rounded-3xl p-4 text-left text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)", border: "1px solid rgba(255,255,255,0.2)" }}
      >
        <span className="w-9 h-9 rounded-2xl flex items-center justify-center bg-white/20">
          <Share2 className="w-4.5 h-4.5" strokeWidth={2.5} />
        </span>
        <p className="mt-2.5 text-[14.5px] font-black leading-tight">Planını Toplulukla Paylaş</p>
        <p className="mt-0.5 text-[11.5px] font-semibold text-white/80">Routinix Nexus'ta binlerce kişiye ilham ver</p>
      </button>

      {/* 3) Hızlı Erişim — Plan Ekle / Planları Yönet */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onNewPlan}
          className="card-glow flex flex-col items-start justify-between gap-3 rounded-3xl p-4 text-left"
          style={{ background: "rgba(var(--overlay-rgb),0.05)", border: "1px solid rgba(var(--overlay-rgb),0.12)" }}
        >
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-cyan-400 to-purple-600 shadow-lg shadow-purple-500/30">
            <Plus className="w-4.5 h-4.5" strokeWidth={2.75} />
          </span>
          <span className="text-[13px] font-black leading-tight" style={{ color: "var(--text-primary)" }}>
            Yeni Plan Hazırla
          </span>
        </button>
        <button
          onClick={onDeletePlan}
          disabled={!savedPlansCount}
          className="card-glow flex flex-col items-start justify-between gap-3 rounded-3xl p-4 text-left disabled:opacity-40 disabled:pointer-events-none"
          style={{ background: "rgba(var(--overlay-rgb),0.05)", border: "1px solid rgba(var(--overlay-rgb),0.12)" }}
        >
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-rose-500 to-red-700 shadow-lg shadow-rose-500/30">
            <Trash2 className="w-4.5 h-4.5" strokeWidth={2.5} />
          </span>
          <span className="text-[13px] font-black leading-tight" style={{ color: "var(--text-primary)" }}>
            Planları Yönet
          </span>
        </button>
      </div>
    </div>
  );
}
