import { useState, useEffect } from "react";
import { BadgeCheck, Flame, Trophy, UserPlus, UserMinus } from "lucide-react";
import FocusSidePanel from "../FocusSidePanel";
import { categoryOf } from "../../constants";
import CoverPattern from "./CoverPattern";
import Avatar from "./Avatar";
import { fetchProfileStats, fetchTemplatesByAuthor, isFollowing, followUser, unfollowUser, getUsageDays } from "../../services/profileService";
import logger from "../../utils/logger";

function rankBadge(usageDays, totalClones) {
  if (totalClones >= 50) return { icon: Trophy, label: "Ritim Ustası" };
  if (usageDays >= 100) return { icon: Flame, label: "Kıdemli" };
  return null;
}

// Kamusal Profil — FocusSidePanel'i (mevcut, TaskCard'ın "Mikro-Arayüz"ünde
// zaten kullanılan responsive kabuk: mobilde Bottom Sheet, masaüstünde yan
// panel) İÇERİK olarak doldurur; yeni bir responsive shell İCAT ETMEZ.
export default function PublicProfileCard({ profile, myProfile, onClose, onFollowChange, onOpenTemplate }) {
  const [stats, setStats] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchProfileStats(profile.id),
      fetchTemplatesByAuthor(profile.id),
      myProfile ? isFollowing(myProfile.id, profile.id) : Promise.resolve(false),
    ])
      .then(([s, t, f]) => {
        if (cancelled) return;
        setStats(s);
        setTemplates(t);
        setFollowing(f);
      })
      .catch((err) => logger.error("COMMUNITY_PROFILE_CARD", "Profil verisi getirilemedi", { error: err?.message }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [profile, myProfile]);

  if (!profile) return null;

  // Başka bir kullanıcının GERÇEK auth.users.created_at'ine client'tan erişim
  // YOK (cross-user auth şeması erişimi kapalı) — bu yüzden kamusal profillerde
  // "kaç gündür üye" için profiles.created_at (bu profilin İLK topluluk
  // ziyaretinde oluşturulduğu an) makul/dürüst bir vekil olarak kullanılır;
  // yalnızca KENDİ profilinde (bkz. commentService.addComment) gerçek
  // auth.users.created_at kullanılır.
  const usageDays = getUsageDays(profile, profile.created_at);
  const badge = stats ? rankBadge(usageDays, stats.total_clones) : null;
  const isOwnProfile = myProfile?.id === profile.id;

  const handleFollowToggle = async () => {
    if (!myProfile || busy || isOwnProfile) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      if (next) await followUser(myProfile.id, profile.id);
      else await unfollowUser(myProfile.id, profile.id);
      onFollowChange?.(profile.id, next);
    } catch (err) {
      logger.error("COMMUNITY_PROFILE_CARD", "Takip işlemi başarısız", { error: err?.message });
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  };

  // Başlık boş bırakılır — panelin içeriği kendi (monokrom) avatar/isim
  // satırını taşıyor; FocusSidePanel'in kendi başlık satırı yalnızca
  // konumlandırma/kapatma kabuğu olarak kullanılıyor, çift isim gösterimini
  // önlemek için `title` boş geçiliyor.
  return (
    <FocusSidePanel open={!!profile} onClose={onClose} side="right" icon={null} title="">
      {/* FocusSidePanel'in kendi gövdesi zaten `p-4` taşıyor — burada ekstra
          dolgu EKLEMİYORUZ, yalnızca monokrom zemin/metin rengini bindiriyoruz. */}
      <div className="-m-4 p-5 flex flex-col gap-5 bg-[#080d1a] min-h-[calc(100%+2rem)] text-white">
        <div className="flex items-center gap-3">
          <Avatar src={profile.avatar_url} name={profile.display_name || profile.username} size="w-14 h-14" textSize="text-[18px]" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-bold truncate">{profile.display_name || profile.username}</h3>
              {profile.is_bot && <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400" />}
            </div>
            <p className="text-[11.5px] text-slate-400">@{profile.username}</p>
          </div>
        </div>

        {badge && (
          <span
            className="w-fit flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-full text-black"
            style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
          >
            <badge.icon className="w-3 h-3" /> {badge.label}
          </span>
        )}

        {profile.bio && <p className="text-[12.5px] text-slate-300 leading-relaxed">{profile.bio}</p>}

        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-400">
          <span>⚡ {usageDays} Gündür Routinix Üyesi</span>
        </div>

        {!isOwnProfile && myProfile && (
          <button
            onClick={handleFollowToggle}
            disabled={busy}
            className={`w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-[12.5px] font-bold transition-all active:scale-95 disabled:opacity-50 ${
              following ? "border border-white/15 text-slate-300" : "text-black"
            }`}
            style={following ? undefined : { background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
          >
            {following ? (
              <>
                <UserMinus className="w-4 h-4" /> Takibi Bırak
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Takip Et
              </>
            )}
          </button>
        )}

        <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/10">
          <div className="text-center">
            <p className="text-[16px] font-bold tabular-nums">{stats?.template_count ?? "—"}</p>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.04em] text-slate-500">Şablon</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold tabular-nums">🏆 {stats?.total_clones ?? "—"}</p>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.04em] text-slate-500">Hayata Dokundu</p>
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold tabular-nums">{stats?.follower_count ?? "—"}</p>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.04em] text-slate-500">Takipçi</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-2.5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-500">Paylaştığı Şablonlar</p>
          {loading ? (
            <p className="text-[12px] text-slate-500">Yükleniyor...</p>
          ) : templates.length === 0 ? (
            <p className="text-[12px] text-slate-500">Henüz bir şablon paylaşmamış.</p>
          ) : (
            templates.map((t) => {
              const cat = categoryOf(t.category);
              return (
                <button
                  key={t.id}
                  onClick={() => onOpenTemplate?.(t)}
                  className="flex items-center gap-2.5 rounded-xl p-2 border border-white/10 text-left hover:border-cyan-500/40 transition-colors"
                >
                  <CoverPattern coverId={t.cover_url} className="w-10 h-10 rounded-lg shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold truncate">{t.title}</span>
                    <span className="block text-[10.5px] text-slate-500">
                      {cat.emoji} {cat.label}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </FocusSidePanel>
  );
}
