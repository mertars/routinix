import { useState, useEffect } from "react";
import { X, Heart, Copy, BadgeCheck, Send, Check, Share2, Pencil } from "lucide-react";
import { categoryOf } from "../../constants";
import { parseStorySections } from "../../utils/formatTemplateStory";
import { fetchComments, addComment, addReply } from "../../services/commentService";
import { toggleLike, hasLikedTemplate, recordTemplateClone, cloneTemplateToMyPlans } from "../../services/communityService";
import { isPlanLimitError } from "../../services/entitlementsService";
import { buildTemplateShareUrl } from "../../utils/shareLink";
import CoverPattern from "./CoverPattern";
import Avatar from "./Avatar";
import TemplateTaskEditor from "./TemplateTaskEditor";
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
            <span className="text-[12px] font-bold text-[var(--text-primary)]">{author?.display_name || author?.username}</span>
            {author?.is_bot && <BadgeCheck className="w-3 h-3 text-cyan-400" />}
            {comment.usage_days_at_comment > 0 && (
              <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(var(--overlay-rgb),0.1)] text-[var(--text-secondary)]">
                🔥 {comment.usage_days_at_comment} Gün Uyguladı
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed mt-0.5">{comment.content}</p>
          {isTemplateAuthor && !replying && (
            <button onClick={() => setReplying(true)} className="text-[10.5px] font-semibold text-[var(--text-faint)] hover:text-cyan-400 mt-1 transition-colors">
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
                className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-primary)] outline-none focus:border-cyan-500/50"
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
            <div key={r.id} className="rounded-xl px-3 py-2 border border-[var(--border-default)] bg-[rgba(var(--overlay-rgb),0.04)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-black" style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}>
                  YAZAR
                </span>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{r.author?.display_name || r.author?.username}</span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-1">{r.content}</p>
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
// ise yüksekti. Sabit, tema-uyumlu mat zemin (`rgba(var(--glass-rgb),0.95)`)
// + border aynı "cam" hissini, bir çerçeve daha az iş yaparak veriyor.
// KLONLAMA MİMARİSİ NOTU: "Planlarıma Ekle" tıklanınca `template.template_tasks`/
// `preview_routines` alanındaki GERÇEK veriden ANINDA yeni bir plan+routines+
// tasks satırı oluşturulur (communityService.cloneTemplateToMyPlans) — AI
// boru hattı YENİDEN TETİKLENMEZ. Oluşan `plan` `onClone(plan)` ile yukarı
// (CommunityHub → app.jsx → usePlanStudio.openSavedPlan) iletilir.
export default function TemplateDetailModal({ template, myProfile, userId, authUserCreatedAt, onClose, onOpenAuthor, onClone, onLimitReached }) {
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(template?.stats?.like_count || 0);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [cloneState, setCloneState] = useState("idle"); // idle | loading | success
  const [cloneError, setCloneError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  // "Eklemeden Önce Düzenle" — SharedTemplateView.jsx'teki AYNI akış, Nexus
  // içinden şablon açan giriş yapmış kullanıcılar için de mevcut.
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTotalDays, setEditTotalDays] = useState(7);
  const [editRoutines, setEditRoutines] = useState([]);
  const [editTasks, setEditTasks] = useState([]);

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

  // "🚀 Planlarıma Ekle" — hiç düzenlemeden, orijinal şablon verisiyle anında klonlar.
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
      if (isPlanLimitError(err)) {
        onLimitReached?.("plans");
        setCloneError("Ücretsiz plan limitine (3) ulaştın — Pro'ya geç.");
      } else {
        setCloneError("Plan kopyalanamadı, tekrar dener misin?");
      }
    }
  };

  // "✏️ Planı Düzenle & Öyle Ekle" — edit state'ini o ANDAKİ şablon
  // değerleriyle doldurup düzenleme moduna geçer.
  const handleEnterEditMode = () => {
    setEditTitle(template.title);
    setEditTotalDays(template.total_days || 7);
    setEditRoutines((template.preview_routines || []).map((r) => ({ content: r.content || "", frequency: r.frequency || "weekly" })));
    setEditTasks(
      (template.template_tasks || []).map((t) => ({
        day_number: t.day_number || 1,
        week_number: t.week_number || 1,
        title: t.title || "",
        detail: t.detail || "",
        duration_min: t.duration_min || null,
        priority: t.priority || null,
      }))
    );
    setCloneError("");
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setCloneError("");
  };

  // "💾 Değişikliklerle Ekle" — yalnızca düzenleme modundan çağrılır.
  const handleCloneEdited = async () => {
    if (!myProfile || !userId || cloneState !== "idle") return;
    setCloneState("loading");
    setCloneError("");
    try {
      const templateForClone = {
        ...template,
        title: editTitle.trim() || template.title,
        total_days: Number(editTotalDays) || template.total_days,
        preview_routines: editRoutines.filter((r) => r.content.trim()),
        template_tasks: editTasks.filter((t) => t.title.trim()),
      };
      const plan = await cloneTemplateToMyPlans(templateForClone, userId);
      recordTemplateClone(template.id, myProfile.id);
      setCloneState("success");
      onClone?.(plan);
    } catch (err) {
      logger.error("COMMUNITY_DETAIL", "Şablon klonlanamadı (düzenlenmiş)", { templateId: template.id, error: err?.message });
      setCloneState("idle");
      if (isPlanLimitError(err)) {
        onLimitReached?.("plans");
        setCloneError("Ücretsiz plan limitine (3) ulaştın — Pro'ya geç.");
      } else {
        setCloneError("Plan kopyalanamadı, tekrar dener misin?");
      }
    }
  };

  // Nexus Link Paylaşımı — `/t/:slugOrId` HERKESE açık, oturumsuz/anonim
  // ziyaretçiler bile önizleyip "Aktif Rutinlerime Ekle" yapabilir (bkz.
  // SharedTemplateView.jsx + app.jsx'teki deep-link ayrıştırması). Panoya
  // yalın URL yerine hazır, güven vurgulu bir mesaj kopyalanır (bkz.
  // shareLink.js) — arkadaşa doğrudan yapıştırılabilir.
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildTemplateShareUrl(template));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* pano izni yoksa sessizce yut — kritik olmayan bir kolaylık */
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center px-4 py-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-full rounded-2xl border border-[var(--border-default)] bg-[rgba(var(--glass-rgb),0.95)] shadow-2xl flex flex-col overflow-hidden"
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
          {/* Bot/AI tarafından üretilmiş deneme şablonu belirteci — TemplateCard.jsx
              ile AYNI metin/stil, kart → detay geçişinde tutarlı okunur. */}
          {template.author?.is_bot && (
            <span
              className="absolute top-3 left-3 text-[9.5px] font-bold uppercase tracking-[0.02em] px-2.5 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap"
              style={{
                background: "rgba(8,13,26,0.85)",
                borderColor: "rgba(250,204,21,0.55)",
                color: "#FDE047",
                boxShadow: "0 0 10px -2px rgba(34,211,238,0.55)",
              }}
            >
              🤖 AI / Bot Test Şablonu
            </span>
          )}
        </CoverPattern>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-5 flex flex-col gap-5">
          <div>
            <h2 className="text-[19px] font-bold text-[var(--text-primary)]">{template.title}</h2>
            <button onClick={() => onOpenAuthor?.(template.author)} className="flex items-center gap-1.5 mt-2 hover:opacity-70 transition-opacity">
              <Avatar src={template.author?.avatar_url} name={template.author?.display_name} />
              <span className="text-[12.5px] font-semibold text-[var(--text-secondary)]">{template.author?.display_name || template.author?.username}</span>
              {template.author?.is_bot && <BadgeCheck className="w-3 h-3 text-cyan-400" />}
            </button>
          </div>

          {template.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((t) => (
                <span key={t} className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full border border-[var(--border-default)] text-[var(--text-muted)]">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Bot şablonu bilgilendirme notu — başlık/etiketlerin ALTINDA,
              ama aksiyon butonlarının (Beğen/Paylaş/Planlarıma Ekle)
              ÜSTÜNDE: kaydırmadan görünür, gizlenmiyor. */}
          {template.author?.is_bot && (
            <div
              className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 border text-[11.5px] font-medium leading-relaxed"
              style={{ background: "rgba(250,204,21,0.08)", borderColor: "rgba(250,204,21,0.35)", color: "#FDE047" }}
            >
              <span className="shrink-0">🤖</span>
              <span>Bu şablon Nexus botları tarafından deneme ve test amaçlı otomatik oluşturulmuştur.</span>
            </div>
          )}

          {!editMode && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold border transition-colors duration-200 ${
                  liked ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-[var(--border-default)] text-[var(--text-secondary)]"
                }`}
              >
                <Heart className="w-3.5 h-3.5" fill={liked ? "currentColor" : "none"} /> {likeCount}
              </button>
              <button
                onClick={handleCopyLink}
                aria-label="Linki Kopyala"
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-cyan-500/40 transition-colors duration-200"
              >
                {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                {linkCopied ? "Kopyalandı" : "Paylaş"}
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
          )}

          {!editMode && myProfile && cloneState === "idle" && (
            <button
              onClick={handleEnterEditMode}
              className="flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-[var(--text-primary)] border border-[var(--border-strong)] hover:border-cyan-500/40 transition-colors duration-200"
            >
              <Pencil className="w-3.5 h-3.5" /> Planı Düzenle & Öyle Ekle
            </button>
          )}

          {cloneError && <p className="text-[11.5px] font-medium text-red-400 -mt-3">{cloneError}</p>}

          {editMode ? (
            <>
              <TemplateTaskEditor
                title={editTitle}
                onTitleChange={setEditTitle}
                totalDays={editTotalDays}
                onTotalDaysChange={setEditTotalDays}
                routines={editRoutines}
                onRoutinesChange={setEditRoutines}
                tasks={editTasks}
                onTasksChange={setEditTasks}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloneEdited}
                  disabled={cloneState !== "idle"}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-bold text-black transition-all active:scale-95 disabled:opacity-70"
                  style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)" }}
                >
                  {cloneState === "loading" ? "Ekleniyor..." : cloneState === "success" ? "Eklendi ✓" : "💾 Değişikliklerle Ekle"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={cloneState !== "idle"}
                  className="text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-60"
                >
                  Vazgeç
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Hikaye — formatTemplateStory.js çıktısının minimal render'ı */}
              <div className="flex flex-col gap-4">
                {sections.map((s) => (
                  <div key={s.title}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--text-faint)] mb-1">{s.title}</p>
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">{s.body}</p>
                  </div>
                ))}
              </div>

              {/* Yorumlar */}
              <div className="pt-4 border-t border-[var(--border-default)] flex flex-col gap-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--text-faint)]">Yorumlar ({comments.length})</p>
                {loadingComments ? (
                  <p className="text-[12px] text-[var(--text-faint)]">Yükleniyor...</p>
                ) : comments.length === 0 ? (
                  <p className="text-[12px] text-[var(--text-faint)]">Henüz yorum yok — ilk yorumu sen yaz.</p>
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
                      className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-cyan-500/50"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
