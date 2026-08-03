import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// "Topluluk Şablon Hub'ı" — kişisel profil + takip grafiği. Bot profilleri
// GERÇEK bir auth.users kaydı OLMADAN var olabildiği için (bkz. migration.sql
// 9. bölüm yorumu), her yerde "kullanıcı" = profiles.id, "oturum" = Supabase
// auth kullanıcısı ayrımına DİKKAT edilir — bu dosya ikisi arasındaki köprüdür.

// Gerçek kullanıcılarda "kaç gündür Routinix üyesi" GERÇEK auth kullanıcısının
// created_at'inden anlık hesaplanır (her zaman doğru, ayrı bir güncelleme
// mekanizması gerekmez); bot profillerde ise migration'da manuel seed edilen
// `usage_days_count` sütunu kullanılır (bkz. o dosyadaki tasarım notu).
export function getUsageDays(profile, authUserCreatedAt) {
  if (!profile) return 0;
  if (profile.is_bot) return profile.usage_days_count || 0;
  if (!authUserCreatedAt) return 0;
  const diffMs = Date.now() - new Date(authUserCreatedAt).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export async function fetchProfileByAuthUserId(authUserId) {
  if (!authUserId) return null;
  const { data, error } = await supabase.from("community_profiles").select("*").eq("auth_user_id", authUserId).maybeSingle();
  if (error) {
    logger.error("COMMUNITY_PROFILE", "Profil getirilemedi", { authUserId, error: error?.message });
    return null;
  }
  return data;
}

export async function fetchProfileById(profileId) {
  const { data, error } = await supabase.from("community_profiles").select("*").eq("id", profileId).single();
  if (error) {
    logger.error("COMMUNITY_PROFILE", "Profil getirilemedi", { profileId, error: error?.message });
    throw error;
  }
  return data;
}

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
export function isValidUsername(username) {
  return USERNAME_RE.test(username || "");
}

// Topluluk Hub'ında ilk kez bir kimlik gerektiren eyleme (şablon paylaşma,
// yorum, takip) girişildiğinde çağrılır — kullanıcı adı zaten VARSA onu
// döner, yoksa verilen kullanıcı adıyla YENİ bir profil satırı oluşturur.
export async function ensureOwnProfile(authUser, desiredUsername) {
  const existing = await fetchProfileByAuthUserId(authUser.id);
  if (existing) return existing;

  if (!isValidUsername(desiredUsername)) {
    throw new Error("Kullanıcı adı 3-24 karakter, yalnızca küçük harf/rakam/alt çizgi içerebilir.");
  }
  const { data, error } = await supabase
    .from("community_profiles")
    .insert({
      auth_user_id: authUser.id,
      username: desiredUsername,
      display_name: desiredUsername,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Bu kullanıcı adı zaten alınmış.");
    logger.error("COMMUNITY_PROFILE", "Profil oluşturulamadı", { error: error?.message });
    throw error;
  }
  return data;
}

export async function updateProfile(profileId, { displayName, bio, avatarUrl }) {
  const { data, error } = await supabase
    .from("community_profiles")
    .update({ display_name: displayName, bio, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", profileId)
    .select()
    .single();
  if (error) {
    logger.error("COMMUNITY_PROFILE", "Profil güncellenemedi", { profileId, error: error?.message });
    throw error;
  }
  return data;
}

// Beğeni/klon/yorum/şablon/takipçi toplamları — bkz. migration.sql
// profile_stats view'i (Yazar Stüdyosu + Kamusal Profil kartı ortak kullanır).
export async function fetchProfileStats(profileId) {
  const { data, error } = await supabase.from("profile_stats").select("*").eq("profile_id", profileId).maybeSingle();
  if (error) {
    logger.error("COMMUNITY_PROFILE", "Profil istatistikleri getirilemedi", { profileId, error: error?.message });
    return { total_likes: 0, total_clones: 0, total_comments: 0, template_count: 0, follower_count: 0, following_count: 0 };
  }
  return data || { total_likes: 0, total_clones: 0, total_comments: 0, template_count: 0, follower_count: 0, following_count: 0 };
}

export async function isFollowing(followerId, followingId) {
  if (!followerId || !followingId) return false;
  const { data, error } = await supabase
    .from("user_follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

// Frontend tarafı kendi kendini takip koruması — SQL RLS/CHECK constraint
// (user_follows_no_self_follow) TEK gerçek sınır, bu yalnızca UX nezaketi
// (hatalı isteği ağa hiç göndermeden önle).
export async function followUser(followerId, followingId) {
  if (followerId === followingId) throw new Error("Kendini takip edemezsin.");
  const { error } = await supabase.from("user_follows").insert({ follower_id: followerId, following_id: followingId });
  if (error) {
    logger.error("COMMUNITY_PROFILE", "Takip edilemedi", { followerId, followingId, error: error?.message });
    throw error;
  }
}

export async function unfollowUser(followerId, followingId) {
  const { error } = await supabase.from("user_follows").delete().eq("follower_id", followerId).eq("following_id", followingId);
  if (error) {
    logger.error("COMMUNITY_PROFILE", "Takipten çıkılamadı", { followerId, followingId, error: error?.message });
    throw error;
  }
}

// "Takip Edilenler" filtresi için — bu profilin takip ettiği TÜM profile id'leri.
export async function fetchFollowingIds(profileId) {
  if (!profileId) return [];
  const { data, error } = await supabase.from("user_follows").select("following_id").eq("follower_id", profileId);
  if (error) {
    logger.error("COMMUNITY_PROFILE", "Takip listesi getirilemedi", { profileId, error: error?.message });
    return [];
  }
  return (data || []).map((r) => r.following_id);
}

// Kamusal profil kartının "paylaştığı şablonlar" listesi.
export async function fetchTemplatesByAuthor(profileId) {
  const { data, error } = await supabase.from("templates").select("*").eq("author_id", profileId).order("created_at", { ascending: false });
  if (error) {
    logger.error("COMMUNITY_PROFILE", "Yazarın şablonları getirilemedi", { profileId, error: error?.message });
    return [];
  }
  return data || [];
}
