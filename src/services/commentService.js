import { supabase } from "../lib/supabaseClient";
import { getUsageDays } from "./profileService";
import logger from "../utils/logger";

// "Topluluk Şablon Hub'ı" — yorumlar + yazar yanıtları. Yanıt ekleme yetkisi
// (yalnızca şablonun yazarı) veritabanı seviyesinde de zorunludur (bkz.
// migration.sql "template_comment_replies_insert_author_only" policy'si) —
// burada client tarafında `isAuthor` kontrolü yalnızca UI'da butonu gizlemek
// içindir, gerçek güvenlik sınırı RLS'tedir.

// Yorumları + (varsa) yazar yanıtlarını tek sorguda getirir — yanıtlar
// PostgREST embed ile (template_comment_replies.comment_id → template_comments.id).
export async function fetchComments(templateId) {
  const { data, error } = await supabase
    .from("template_comments")
    .select("*, author:community_profiles(id, username, display_name, avatar_url, is_bot), replies:template_comment_replies(*, author:community_profiles(id, username, display_name, avatar_url))")
    .eq("template_id", templateId)
    .order("created_at", { ascending: true });
  if (error) {
    logger.error("COMMUNITY_COMMENTS", "Yorumlar getirilemedi", { templateId, error: error?.message });
    throw error;
  }
  return data || [];
}

// `profile`/`authUserCreatedAt`: yorumu yazan kişinin KENDİ profili — yorumun
// üstündeki "[🔥 N Gün Uyguladı]" rozeti YAZILDIĞI ANDAKİ kıdemi donduğu için
// (bkz. migration.sql template_comments.usage_days_at_comment yorumu) burada hesaplanır.
export async function addComment(templateId, profile, authUserCreatedAt, content) {
  const trimmed = (content || "").trim();
  if (!trimmed) throw new Error("Yorum boş olamaz.");
  const usageDays = getUsageDays(profile, authUserCreatedAt);
  const { data, error } = await supabase
    .from("template_comments")
    .insert({ template_id: templateId, user_id: profile.id, content: trimmed, usage_days_at_comment: usageDays })
    .select("*, author:community_profiles(id, username, display_name, avatar_url, is_bot)")
    .single();
  if (error) {
    logger.error("COMMUNITY_COMMENTS", "Yorum eklenemedi", { templateId, error: error?.message });
    throw error;
  }
  return { ...data, replies: [] };
}

export async function addReply(commentId, authorProfileId, content) {
  const trimmed = (content || "").trim();
  if (!trimmed) throw new Error("Yanıt boş olamaz.");
  const { data, error } = await supabase
    .from("template_comment_replies")
    .insert({ comment_id: commentId, author_id: authorProfileId, content: trimmed })
    .select("*, author:community_profiles(id, username, display_name, avatar_url)")
    .single();
  if (error) {
    logger.error("COMMUNITY_COMMENTS", "Yanıt eklenemedi", { commentId, error: error?.message });
    throw error;
  }
  return data;
}
