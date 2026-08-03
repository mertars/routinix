import { useState, useEffect } from "react";
import { X, Heart, Copy, BadgeCheck, Send, Check } from "lucide-react";
import { categoryOf } from "../../constants";
import { parseStorySections } from "../../utils/formatTemplateStory";
import { fetchComments, addComment, addReply } from "../../services/commentService";
import { toggleLike, hasLikedTemplate, recordTemplateClone, cloneTemplateToMyPlans } from "../../services/communityService";
import CoverPattern from "./CoverPattern";
import Avatar from "./Avatar";
import logger from "../../utils/logger";

function CommentRow({ comment, isTemplateAuthor, onReply }) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const author = comment.author;

  const submitReply = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await onReply(comment.id, draft.trim());
      setDraft("");
      setReplying(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <Avatar src={author?.avatar_url} name={author?.display_name} size="w-7 h-7" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-bold text-white">{author?.display_name || author?.username}</span>
            {author?.is_bot && <BadgeCheck className="w-3 h-3 text-cyan-400" />}
            {comment.usage_days_at_comment > 0 && (
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                🔥 {comment.usage_days_at_comment} Gün Uyguladı
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-slate-300 leading-relaxed mt-0.5">{comment.content}</p>
          {isTemplateAuthor && !replying && (
            <button onClick={() => setReplying(true)} className="text-[10.5px] font-semibold text-slate-500 hover:text-cyan-400 mt-1 transition-colors">
              Yanıtla
            </button>
          )}
          {replying && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitReply()}
                placeholder="Yazar olarak yanıtla..."
                className="flex-1 rounded-lg border border-white/10 bg-[#0c1322]/95 px-2.5 py-1.5 text-[11.5px] text-white outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={submitReply}
                disabled={sending}
                className="text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg text-black disabled:opacity-40"
                style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
              >
                Gönder
              </button>
            </div>
          )}
        </div>
      </div>

      {comment.replies?.length > 0 && (
        <div className="pl-9 flex flex-col gap-2">
          {comment.replies.map((r) => (
            <div key={r.id} className="rounded-xl px-3 py-2 border border-white/10 bg-white/[0.03]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-black" style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}>
                  YAZAR
                </span>
                <span className="text-[11px] font-semibold text-slate-300">{r.author?.display_name || r.author?.username}</span>
              </div>
              <p className="text-[12px] text-slate-300 leading-relaxed mt-1">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Şablon detayı — hikaye (formatTemplateStory çıktısının render'ı), yorumlar
// ("[🔥 N Gün Uyguladı]" rozetiyle) + yazar yanıtları, ve "Planlarıma Ekle".
// PERFORMANS: modal gövdesindeki `backdrop-blur-xl` ve ağır `box-shadow`
// ışımaları kaldırıldı — arkasında zaten hareket etmeyen statik bir zemin
// (NexusBackground) olduğu için blur'un görsel katkısı çok azdı, GPU maliyeti
// ise yüksekti. Sabit koyu mat zemin (`bg-[#0c1322]/95`) + border aynı "cam"
// hissini, bir çerçeve daha az iş yaparak veriyor.
// KLONLAMA MİMARİSİ NOTU: "Planlarıma Ekle" tıklanınca `template.template_tasks`/
// `preview_routines` alanındaki GERÇEK veriden ANINDA yeni bir plan+routines+
// tasks satırı oluşturulur (communityService.cloneTemplateToMyPlans) — AI
// boru hattı YENİDEN TETİKLENMEZ. Oluşan `plan` `onClone(plan)` ile yukarı
// (CommunityHub → app.jsx → usePlanStudio.openSavedPlan) iletilir.
export default function TemplateDetailModal({ template, myProfile, userId, authUserCreatedAt, onClose, onOpenAuthor, onClone }) {
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(template?.stats?.like_count || 0);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [cloneState, setCloneState] = useState("idle"); // idle | loading | success
  const [cloneError, setCloneError] = useState("");

  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    setLoadingComments(true);
    fetchComments(template.id)
      .then((rows) => !cancelled && setComments(rows))
      .catch((err) => logger.error("COMMUNITY_DETAIL", "Yorumlar yüklenemedi", { error: err?.message }))
      .finally(() => !cancelled && setLoadingComments(false));
    if (myProfile) hasLikedTemplate(template.id, myProfile.id).then((v) => !cancelled && setLiked(v));
    return () => {
      cancelled = true;
    };
  }, [template, myProfile]);

  if (!template) return null;

  const cat = categoryOf(template.category);
  const sections = parseStorySections(template.story_markdown);
  const isTemplateAuthor = myProfile && template.author?.id === myProfile.id;

  const handleLike = async () => {
    if (!myProfile) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    try {
      await toggleLike(template.id, myProfile.id, liked);
    } catch {
      setLiked(!next);
      setLikeCount((n) => n - (next ? 1 : -1));
    }
  };

  const handlePostComment = async () => {
    if (!draft.trim() || posting || !myProfile) return;
    setPosting(true);
    try {
      const created = await addComment(template.id, myProfile, authUserCreatedAt, draft);
      setComments((prev) => [...prev, created]);
      setDraft("");
    } catch (err) {
      logger.error("COMMUNITY_DETAIL", "Yorum gönderilemedi", { error: err?.message });
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async (commentId, content) => {
    const reply = await addReply(commentId, myProfile.id, content);
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, replies: [...(c.replies || []), reply] } : c)));
  };

  const handleClone = async () => {
    if (!myProfile || !userId || cloneState !== "idle") return;
    setCloneState("loading");
    setCloneError("");
    try {
      const plan = await cloneTemplateToMyPlans(template, userId);
      recordTemplateClone(template.id, myProfile.id); // sosyal-kanıt olayı — sessizce yut, klon akışını kesmesin
      setCloneState("success");
      onClone?.(plan);
    } catch (err) {
      logger.error("COMMUNITY_DETAIL", "Şablon klonlanamadı", { templateId: template.id, error: err?.message });
      setCloneState("idle");
      setCloneError("Plan kopyalanamadı, tekrar dener misin?");
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center px-4 py-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-full rounded-2xl border border-white/10 bg-[#0c1322]/95 shadow-2xl flex flex-col overflow-hidden"
      >
        <CoverPattern coverId={template.cover_url} className="w-full h-40 shrink-0">
          <button onClick={onClose} aria-label="Kapat" className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-black/55 text-white">
            <X className="w-4 h-4" />
          </button>
          <span
            className="absolute bottom-3 left-4 text-[10.5px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border"
            style={{ background: "rgba(8,13,26,0.75)", borderColor: `${cat.accent}55`, color: cat.accent }}
          >
            {cat.emoji} {cat.label} · {template.total_days} gün
          </span>
        </CoverPattern>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-5 flex flex-col gap-5">
          <div>
            <h2 className="text-[19px] font-bold text-white">{template.title}</h2>
            <button onClick={() => onOpenAuthor?.(template.author)} className="flex items-center gap-1.5 mt-2 hover:opacity-70 transition-opacity">
              <Avatar src={template.author?.avatar_url} name={template.author?.display_name} />
              <span className="text-[12.5px] font-semibold text-slate-300">{template.author?.display_name || template.author?.username}</span>
              {template.author?.is_bot && <BadgeCheck className="w-3 h-3 text-cyan-400" />}
            </button>
          </div>

          {template.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((t) => (
                <span key={t} className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full border border-white/10 text-slate-400">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold border transition-colors duration-200 ${
                liked ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-white/10 text-slate-300"
              }`}
            >
              <Heart className="w-3.5 h-3.5" fill={liked ? "currentColor" : "none"} /> {likeCount}
            </button>
            <button
              onClick={handleClone}
              disabled={cloneState !== "idle"}
              className="flex-1 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-bold text-black transition-all active:scale-95 disabled:active:scale-100 disabled:opacity-70"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
            >
              {cloneState === "success" ? (
                <>
                  <Check className="w-4 h-4 motion-safe:animate-[checkPop_0.4s_ease]" /> Planlarına Eklendi
                </>
              ) : cloneState === "loading" ? (
                "Kopyalanıyor..."
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Planlarıma Ekle
                </>
              )}
            </button>
          </div>
          {cloneError && <p className="text-[11.5px] font-medium text-red-400 -mt-3">{cloneError}</p>}

          {/* Hikaye — formatTemplateStory.js çıktısının minimal render'ı */}
          <div className="flex flex-col gap-4">
            {sections.map((s) => (
              <div key={s.title}>
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-1">{s.title}</p>
                <p className="text-[13px] leading-relaxed text-slate-300 whitespace-pre-line">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Yorumlar */}
          <div className="pt-4 border-t border-white/10 flex flex-col gap-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500">Yorumlar ({comments.length})</p>
            {loadingComments ? (
              <p className="text-[12px] text-slate-500">Yükleniyor...</p>
            ) : comments.length === 0 ? (
              <p className="text-[12px] text-slate-500">Henüz yorum yok — ilk yorumu sen yaz.</p>
            ) : (
              comments.map((c) => <CommentRow key={c.id} comment={c} isTemplateAuthor={isTemplateAuthor} onReply={handleReply} />)
            )}

            {myProfile && (
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                  placeholder="Deneyimini paylaş..."
                  className="flex-1 rounded-xl border border-white/10 bg-[#0c1322]/95 px-3.5 py-2.5 text-[12.5px] text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={handlePostComment}
                  disabled={posting || !draft.trim()}
                  className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-black disabled:opacity-40"
                  style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
