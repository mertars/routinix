import { useState, useEffect } from "react";
import { X, BadgeCheck, Flame, Trophy, ListChecks, Repeat2, FolderOpen } from "lucide-react";
import Avatar from "./Avatar";
import { fetchProfileByAuthUserId, fetchProfileStats, getUsageDays } from "../../services/profileService";
import { fetchDashboardData } from "../../services/planService";
import { MONO_FONT } from "../../constants";
import logger from "../../utils/logger";

// PublicProfileCard.jsx'teki GERÇEK rozet mantığıyla AYNI (tek doğruluk
// kaynağı orada) — burada TEKRAR yazılıyor çünkü PublicProfileCard onu
// FocusSidePanel'e (yan panel/bottom-sheet kabuğu) gömülü tutuyor; bu
// bileşen kasıtlı olarak TAM EKRAN kendi kabuğunda.
function rankBadge(usageDays, totalClones) {
  if (totalClones >= 50) return { icon: Trophy, label: "Ritim Ustası" };
  if (usageDays >= 100) return { icon: Flame, label: "Kıdemli" };
  return null;
}

function StatTile({ icon, value, label }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-2xl py-4 px-2 text-center"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.12)",
      }}
    >
      <span className="text-slate-400">{icon}</span>
      <span className="text-[17px] font-black text-white tabular-nums" style={{ fontFamily: MONO_FONT }}>
        {value}
      </span>
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.05em] text-slate-500">{label}</span>
    </div>
  );
}

// "Nexus Profilim" — DrawerMenu'deki "Profil & İstatistikler" kartından
// tam ekrana AÇILAN özel görünüm (bkz. app.jsx openNexusProfile). Kasıtlı
// olarak CommunityHub'ı (ağır: tüm şablon feed'i + arama) MONTE ETMİYOR —
// yalnızca kendi kimlik/istatistik verisini çeker, çok daha hafif.
//
// İki İSTATİSTİK GRUBU, iki FARKLI gerçek kaynaktan:
//  1) Nexus toplulık istatistikleri (şablon/hayata dokundu/takipçi) —
//     profile_stats view'i, PublicProfileCard'la AYNI kaynak.
//  2) Kişisel üretkenlik istatistikleri (tamamlanan görev/aktif rutin) —
//     fetchDashboardData, tüm planların gerçek `tasks`/`routines` satırları.
// Sahte bir "gün serisi" YOK: rutin check-in geçmişi sunucuda hiç
// saklanmıyor (bkz. DrawerMenu.jsx yorumu) — burada da uydurulmadı.
export default function NexusProfileOverlay({ open, user, onClose, onCreateProfile }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [productivity, setProductivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchProfileByAuthUserId(user.id), fetchDashboardData(user.id)])
      .then(([p, plans]) => {
        if (cancelled) return;
        setProfile(p);
        const tasks = plans.flatMap((pl) => pl.tasks || []);
        const routines = plans.flatMap((pl) => pl.routines || []);
        setProductivity({
          completedTasks: tasks.filter((t) => t.is_completed).length,
          activeRoutines: routines.length,
          planCount: plans.length,
        });
        if (p) {
          fetchProfileStats(p.id).then((s) => !cancelled && setStats(s));
        }
      })
      .catch((err) => logger.error("NEXUS_PROFILE_OVERLAY", "Profil verisi getirilemedi", { error: err?.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  if (!open) return null;

  const usageDays = getUsageDays(profile, user?.created_at);
  const badge = profile && stats ? rankBadge(usageDays, stats.total_clones) : null;

  return (
    <div className="full-screen-in fixed inset-0 z-[110] flex flex-col bg-[#030304] text-white" style={{ animation: "fullScreenIn 0.32s cubic-bezier(0.32,0.72,0,1)" }}>
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: [
            "radial-gradient(circle at 10% -6%, rgba(178,107,255,0.26) 0%, transparent 45%)",
            "radial-gradient(circle at 96% 105%, rgba(34,211,238,0.2) 0%, transparent 45%)",
          ].join(", "),
        }}
      />

      <div className="relative z-10 flex items-center justify-between px-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2 shrink-0">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-cyan-300">✨ Nexus Profilim</span>
        <button
          onClick={onClose}
          aria-label="Kapat"
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto no-scrollbar px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] flex flex-col gap-5">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-[13px]">Yükleniyor...</div>
        ) : !profile ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
            <span className="text-[36px]">👤</span>
            <p className="text-[14px] font-bold text-white">Henüz bir Nexus profilin yok</p>
            <p className="text-[12.5px] text-slate-400">Şablon paylaşmak ve topluluğa katılmak için önce bir profil oluştur.</p>
            <button
              onClick={onCreateProfile}
              className="mt-2 rounded-full px-5 py-2.5 text-[12.5px] font-bold text-black"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
            >
              Nexus'ta Profil Oluştur
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3.5 mt-1">
              <Avatar src={profile.avatar_url} name={profile.display_name || profile.username} size="w-16 h-16" textSize="text-[20px]" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[17px] font-black truncate">{profile.display_name || profile.username}</h2>
                  {profile.is_bot && <BadgeCheck className="w-4 h-4 shrink-0 text-cyan-400" />}
                </div>
                <p className="text-[12px] text-slate-400">@{profile.username}</p>
                {badge && (
                  <span
                    className="mt-1.5 w-fit flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full text-black"
                    style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
                  >
                    <badge.icon className="w-3 h-3" /> {badge.label}
                  </span>
                )}
              </div>
            </div>

            {profile.bio && <p className="text-[12.5px] text-slate-300 leading-relaxed">{profile.bio}</p>}

            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-2">Nexus İstatistikleri</p>
              <div className="grid grid-cols-3 gap-2">
                <StatTile icon="📄" value={stats?.template_count ?? "—"} label="Şablon" />
                <StatTile icon="🏆" value={stats?.total_clones ?? "—"} label="Hayata Dokundu" />
                <StatTile icon="👥" value={stats?.follower_count ?? "—"} label="Takipçi" />
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-2">Genel İlerleme</p>
              <div className="grid grid-cols-3 gap-2">
                <StatTile icon={<ListChecks className="w-4 h-4" strokeWidth={2.25} />} value={productivity?.completedTasks ?? 0} label="Tamamlanan Görev" />
                <StatTile icon={<Repeat2 className="w-4 h-4" strokeWidth={2.25} />} value={productivity?.activeRoutines ?? 0} label="Aktif Rutin" />
                <StatTile icon={<FolderOpen className="w-4 h-4" strokeWidth={2.25} />} value={productivity?.planCount ?? 0} label="Kayıtlı Plan" />
              </div>
            </div>

            <p className="text-[11.5px] font-semibold text-slate-500 text-center mt-1">⚡ {usageDays} gündür Routinix üyesi</p>
          </>
        )}
      </div>
    </div>
  );
}
