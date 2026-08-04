import { useState, useEffect, useRef } from "react";
import { Share2, Check, Pencil, Sparkles, X, Lock, FileDown, PencilLine } from "lucide-react";
import { categoryOf } from "../constants";
import CoverPattern from "./community/CoverPattern";
import Avatar from "./community/Avatar";
import TemplateTaskEditor from "./community/TemplateTaskEditor";
import { parseStorySections } from "../utils/formatTemplateStory";
import { fetchTemplateByIdOrSlug, incrementTemplateView, cloneTemplateToMyPlans, recordTemplateClone } from "../services/communityService";
import { fetchProfileByAuthUserId } from "../services/profileService";
import { buildTemplateShareMessage } from "../utils/shareLink";
import logger from "../utils/logger";

// Nexus Link Paylaşımı — `/t/:templateId` deep link'inin GERÇEK sayfası.
// app.jsx bu bileşeni normal uygulama kabuğunun YERİNE render eder (bkz.
// app.jsx'teki `sharedTemplateId` kontrolü) — bu SPA'da react-router GİBİ bir
// kütüphane yok, tek bir statik deep-link giriş noktası için bir tane
// eklemek (tüm `stage` durum makinesini yeniden yazmak) orantısız bir
// mimari değişiklik olurdu; bunun yerine `window.location.pathname` TEK
// SEFERLİK ayrıştırılır.
//
// SIFIR KAYIT ENGELİ: `auth.user` yoksa hiçbir login/register ekranı
// GÖSTERMEZ — arka planda sessizce `auth.signInAnonymously()` çağrılır (bkz.
// useAuth.js). Anonim kullanıcının `auth.uid()`'si GERÇEK bir auth.users
// satırıdır, bu yüzden "Aktif Rutinlerime Ekle" tıklandığında oluşturulan
// plans/routines/tasks tamamen normal RLS ile çalışır — ayrı bir kod yolu
// yok. Kullanıcı sonradan "Hesabını Kaydet" derse (AuthModal, isAnonymousUpgrade
// modunda) AYNI auth.uid() kalıcı bir hesaba yükseltilir — hiçbir veri
// taşınmaz/kopyalanmaz çünkü zaten aynı satırlara bağlıdır.
export default function SharedTemplateView({ idOrSlug, auth, onOpenAuth, onDone }) {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("preview"); // "preview" | "edit"
  const [editTitle, setEditTitle] = useState("");
  const [editTotalDays, setEditTotalDays] = useState(7);
  const [editRoutines, setEditRoutines] = useState([]);
  const [editTasks, setEditTasks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const ctaRef = useRef(null);
  // Eklenen plan — dolunca kısa bir başarı ekranı gösterilir, ardından
  // gerçek uygulama kabuğuna (yeni planı doğrudan açarak) geçilir.
  const [successPlan, setSuccessPlan] = useState(null);
  const viewCounted = useRef(false);

  // Anonim oturum — yalnızca hiç oturum yoksa (authReady true olduktan sonra)
  // ve bu deep link'e gelindiğinde tetiklenir; zaten GİRİŞLİ (anonim ya da
  // kalıcı) bir ziyaretçi için tekrar tetiklenmez.
  useEffect(() => {
    if (!auth.authReady || auth.user) return;
    auth.signInAnonymously().then(({ error: err }) => {
      if (err) logger.error("SHARED_TEMPLATE", "Anonim oturum başlatılamadı", { error: err?.message });
    });
  }, [auth.authReady, auth.user, auth]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchTemplateByIdOrSlug(idOrSlug)
      .then((t) => {
        if (cancelled) return;
        setTemplate(t);
        setEditTitle(t.title);
        setEditTotalDays(t.total_days || 7);
        setEditRoutines((t.preview_routines || []).map((r) => ({ content: r.content || "", frequency: r.frequency || "weekly" })));
        setEditTasks(
          (t.template_tasks || []).map((task) => ({
            day_number: task.day_number || 1,
            week_number: task.week_number || 1,
            title: task.title || "",
            detail: task.detail || "",
            duration_min: task.duration_min || null,
            priority: task.priority || null,
          }))
        );
      })
      .catch((err) => {
        logger.error("SHARED_TEMPLATE", "Şablon getirilemedi", { idOrSlug, error: err?.message });
        if (!cancelled) setError("Bu şablon bulunamadı — link kırık ya da şablon kaldırılmış olabilir.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [idOrSlug]);

  // Görüntülenme sayısı — sayfa/şablon başına yalnızca BİR kez. `template.id`
  // (slug DEĞİL) kullanılır — RPC `p_template_id` bir uuid bekler.
  useEffect(() => {
    if (!template?.id || viewCounted.current) return;
    viewCounted.current = true;
    incrementTemplateView(template.id);
  }, [template?.id]);

  // Tarayıcı sekmesi başlığı — GERÇEK kullanıcılar için (sosyal medya
  // kartları için DEĞİL: crawler'lar JS ÇALIŞTIRMAZ, bu satır onlara hiçbir
  // etki etmez — bkz. api/og-template.js + vercel.json, o kısmın GERÇEK
  // çözümü). Kapanışta önceki başlığa döner.
  useEffect(() => {
    if (!template) return;
    const prev = document.title;
    document.title = `${template.title} - Routinix Nexus`;
    return () => {
      document.title = prev;
    };
  }, [template]);

  const handleCopyLink = async () => {
    if (!template) return;
    try {
      await navigator.clipboard.writeText(buildTemplateShareMessage(template));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* pano izni yoksa sessizce yut — kritik olmayan bir kolaylık */
    }
  };

  // Başarı ekranını kısa bir süre GÖSTER, sonra app.jsx'e devret (o da
  // URL'i temizleyip normal uygulamayı yeni planı doğrudan açık şekilde
  // render eder — bkz. app.jsx handleSharedTemplateDone). Kullanıcı
  // "eklendi" bildirimini görmeden aniden başka bir ekrana atlamaz.
  useEffect(() => {
    if (!successPlan) return;
    const id = setTimeout(() => onDone?.(successPlan), 1300);
    return () => clearTimeout(id);
  }, [successPlan, onDone]);

  // "🚀 Planı Ekle ve Çıktısını Çıkar" — HİÇ düzenlemeden, orijinal şablon
  // verisiyle anında klonlar (edit state'inden TAMAMEN bağımsız — kullanıcı
  // daha önce düzenleme moduna girip geri dönmüş olsa bile bu buton her
  // zaman ORİJİNAL/pristine `template`'i kullanır). Ardından sosyal-kanıt
  // olayını (template_clones — bkz. TemplateDetailModal.jsx'teki aynı desen)
  // best-effort kaydeder ve `window.print()`'i HENÜZ önizleme (preview)
  // içeriği ekrandayken tetikler — `successPlan` ekranına geçmeden ÖNCE,
  // aksi halde yazdırma diyaloğu boş bir "✅ eklendi" ekranını yakalardı.
  const handleQuickAdd = async () => {
    if (adding || !auth.user) return;
    setAdding(true);
    setAddError("");
    try {
      const plan = await cloneTemplateToMyPlans(template, auth.user.id);
      const myProfile = await fetchProfileByAuthUserId(auth.user.id);
      if (myProfile) recordTemplateClone(template.id, myProfile.id);
      window.print();
      setSuccessPlan(plan);
    } catch (err) {
      logger.error("SHARED_TEMPLATE", "Plan eklenemedi (hızlı ekle)", { idOrSlug, templateDbId: template?.id, error: err?.message });
      setAddError("Plan eklenemedi, tekrar dener misin?");
    } finally {
      setAdding(false);
    }
  };

  // "💾 Değişikliklerle Planlarıma Ekle" — yalnızca edit modundan çağrılır,
  // kullanıcının DÜZENLEDİĞİ görev/rutin listesiyle bir kopya oluşturur.
  // Orijinal `templates` satırına HİÇ dokunulmaz, yalnızca kendi
  // plans/routines/tasks satırları bu düzenlenmiş veriyle oluşturulur.
  const handleAddEditedToMyPlans = async () => {
    if (adding || !auth.user) return;
    setAdding(true);
    setAddError("");
    try {
      const templateForClone = {
        ...template,
        title: editTitle.trim() || template.title,
        total_days: Number(editTotalDays) || template.total_days,
        preview_routines: editRoutines.filter((r) => r.content.trim()),
        template_tasks: editTasks.filter((t) => t.title.trim()),
      };
      const plan = await cloneTemplateToMyPlans(templateForClone, auth.user.id);
      setSuccessPlan(plan);
    } catch (err) {
      logger.error("SHARED_TEMPLATE", "Plan eklenemedi (düzenlenmiş)", { idOrSlug, templateDbId: template?.id, error: err?.message });
      setAddError("Plan eklenemedi, tekrar dener misin?");
    } finally {
      setAdding(false);
    }
  };

  // Düzenleme moduna GİRMEDEN önceki hale (orijinal şablon değerleri) sıfırlar
  // ve "vazgeç" ile önizlemeye döner — yarım kalan bir düzenleme sessizce
  // kaybolmaz, kullanıcı NEREDEN geldiyse oraya döner.
  const handleCancelEdit = () => {
    setEditTitle(template.title);
    setEditTotalDays(template.total_days || 7);
    setEditRoutines((template.preview_routines || []).map((r) => ({ content: r.content || "", frequency: r.frequency || "weekly" })));
    setEditTasks(
      (template.template_tasks || []).map((task) => ({
        day_number: task.day_number || 1,
        week_number: task.week_number || 1,
        title: task.title || "",
        detail: task.detail || "",
        duration_min: task.duration_min || null,
        priority: task.priority || null,
      }))
    );
    setAddError("");
    setMode("preview");
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#030304] text-slate-400 text-[13px]">Yükleniyor...</div>
    );
  }

  if (error || !template) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-[#030304] text-center px-6">
        <span className="text-[40px]">🔗</span>
        <p className="text-[14px] font-bold text-white">{error || "Şablon bulunamadı"}</p>
        <button onClick={() => onDone?.(null)} className="mt-2 text-[12.5px] font-bold text-cyan-300">
          Routinix'e Git →
        </button>
      </div>
    );
  }

  if (successPlan) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-[#030304] text-center px-6 animate-[fadeIn_0.2s_ease]">
        <span
          className="w-16 h-16 rounded-full flex items-center justify-center text-[28px]"
          style={{ background: "rgba(46,217,163,0.15)", border: "1px solid rgba(46,217,163,0.4)" }}
        >
          ✅
        </span>
        <p className="text-[15px] font-bold text-white">Plan başarıyla kütüphanene eklendi!</p>
        <p className="text-[12px] text-slate-400">Planına yönlendiriliyorsun...</p>
      </div>
    );
  }

  const cat = categoryOf(template.category);
  const sections = parseStorySections(template.story_markdown);
  const author = template.author;

  return (
    <div className="shared-template-print-root fixed inset-0 z-[200] overflow-y-auto bg-[#030304] text-white">
      {/* Yazdırma/PDF desteği — `.no-print` işaretli her şey (üst şerit,
          güvenlik/CTA butonları, kapak fotoğrafı) VE her `<button>` yazdırırken
          tamamen kaldırılır; geriye yalnızca başlık, hikaye bölümleri ve
          rutin listesinden oluşan temiz bir metin taslağı kalır. Zemin/metin
          rengi TÜM alt elemanlarda (Tailwind'in koyu tema sınıflarını ezerek)
          açıkça beyaza/siyaha zorlanır — koyu temanın ekrandaki hali kağıda
          hiç yansımaz. "PDF Çıktısı Alınabilir" etiketi bu yüzden GERÇEK bir
          işlevdir (bkz. handleQuickAdd — plan eklendikten hemen sonra
          `window.print()` tetiklenir). */}
      <style>{`
        @media print {
          button, .no-print { display: none !important; }
          .shared-template-print-root {
            position: static !important;
            overflow: visible !important;
          }
          .shared-template-print-root, .shared-template-print-root * {
            background: #ffffff !important;
            color: #000000 !important;
            border-color: #d4d4d8 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <div
        className="no-print fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: [
            "radial-gradient(circle at 8% -6%, rgba(178,107,255,0.28) 0%, transparent 45%)",
            "radial-gradient(circle at 96% 108%, rgba(34,211,238,0.24) 0%, transparent 45%)",
            "#030304",
          ].join(", "),
        }}
      />

      <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
        <div className="no-print flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-cyan-300">
            <Sparkles className="w-4 h-4" /> Routinix Nexus
          </span>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-cyan-500/40 transition-colors"
          >
            {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            {linkCopied ? "Kopyalandı" : "Linki Kopyala"}
          </button>
        </div>

        {/* Güvenlik/şeffaflık şeridi — bu sayfaya ("şüpheli link" hissini
            kırmak için) hesap açmadan/ödeme yapmadan güvenle gelinebileceğini
            AÇIKÇA belirtir. Yazdırma/PDF butonu (`window.print()`) burada
            GERÇEKTEN çalışır — "PDF Çıktısı Alınabilir" etiketi boş bir
            vaat DEĞİL, aşağıdaki `@media print` bloğu içerik dışındaki her
            şeyi (buton/şerit/kenarlık) yazdırmadan gizler. */}
        <div className="no-print rounded-xl border border-white/10 bg-zinc-900/60 px-3.5 py-2.5 flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-300">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Güvenli Ön İzleme: Bu bir Routinix Nexus şablonudur. Hesap açma veya ödeme gerektirmez.
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-slate-300 hover:border-cyan-500/40 transition-colors"
            >
              <FileDown className="w-3 h-3" /> PDF Çıktısı Alınabilir
            </button>
            <span className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-slate-300">
              <PencilLine className="w-3 h-3" /> Serbestçe Düzenle
            </span>
          </div>
        </div>

        <CoverPattern coverId={template.cover_url} className="no-print w-full h-44 rounded-2xl border border-white/10">
          <span
            className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border"
            style={{ background: "rgba(8,13,26,0.75)", borderColor: `${cat.accent}55`, color: cat.accent }}
          >
            {cat.emoji} {cat.label} · {template.total_days} gün
          </span>
        </CoverPattern>

        <div>
          <h1 className="text-[20px] font-black text-white leading-tight">{template.title}</h1>
          <button className="flex items-center gap-1.5 mt-2 hover:opacity-70 transition-opacity">
            <Avatar src={author?.avatar_url} name={author?.display_name || author?.username} />
            <span className="text-[12.5px] font-semibold text-slate-300">{author?.display_name || author?.username}</span>
          </button>
        </div>

        {mode === "edit" && (
          <p className="no-print flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-cyan-300">
            <Pencil className="w-3.5 h-3.5" /> Düzenleme Modu
          </p>
        )}

        {mode === "preview" ? (
          <div className="flex flex-col gap-4">
            {sections.map((s) => (
              <div key={s.title}>
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-1">{s.title}</p>
                <p className="text-[13px] leading-relaxed text-slate-300 whitespace-pre-line">{s.body}</p>
              </div>
            ))}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-slate-500 mb-2">Rutinler</p>
              <ul className="flex flex-col gap-1.5">
                {(template.preview_routines || []).map((r, i) => (
                  <li key={i} className="text-[12.5px] text-slate-300">
                    • {r.content} <span className="text-slate-500">({r.frequency === "daily" ? "her gün" : "haftada 1"})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
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
        )}

        {addError && <p className="no-print text-[12px] font-medium text-red-400">{addError}</p>}

        {/* İki net yol: (1) hiç değiştirmeden anında ekle, (2) önce düzenle
            sonra ekle. Düzenleme modundayken yalnızca "değişikliklerle ekle"
            + "vazgeç" gösterilir — iki farklı "ekle" butonunun AYNI ANDA
            görünüp kafa karıştırmasını önler. */}
        {mode === "preview" ? (
          <div ref={ctaRef} className="no-print sticky bottom-4 flex flex-col gap-2">
            <button
              onClick={handleQuickAdd}
              disabled={adding || !auth.user}
              className="w-full flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[13.5px] font-bold text-black disabled:opacity-60 transition-transform active:scale-[0.98]"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)", boxShadow: "0 12px 30px -10px rgba(178,107,255,0.5)" }}
            >
              🚀 {adding ? "Ekleniyor..." : "Planı Ekle ve Çıktısını Çıkar"}
            </button>
            <button
              onClick={() => setMode("edit")}
              disabled={adding}
              className="w-full flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-bold text-white border border-white/15 bg-zinc-900/80 backdrop-blur-md disabled:opacity-60 transition-colors hover:border-cyan-500/40"
            >
              <Pencil className="w-4 h-4" /> Planı Düzenle & Öyle Ekle
            </button>
          </div>
        ) : (
          <div ref={ctaRef} className="no-print sticky bottom-4 flex flex-col gap-2">
            <button
              onClick={handleAddEditedToMyPlans}
              disabled={adding || !auth.user}
              className="w-full flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[13.5px] font-bold text-black disabled:opacity-60 transition-transform active:scale-[0.98]"
              style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)", boxShadow: "0 12px 30px -10px rgba(178,107,255,0.5)" }}
            >
              💾 {adding ? "Ekleniyor..." : "Değişikliklerle Planlarıma Ekle"}
            </button>
            <button onClick={handleCancelEdit} disabled={adding} className="w-full text-[11.5px] font-semibold text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-60">
              Vazgeç, önizlemeye dön
            </button>
          </div>
        )}

        {auth.isAnonymous && (
          <button onClick={onOpenAuth} className="no-print text-[11.5px] font-semibold text-slate-400 hover:text-cyan-300 transition-colors text-center">
            İlerlemeni kaybetmemek için hesabını kaydet →
          </button>
        )}

        <button onClick={() => onDone?.(null)} className="no-print flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-3.5 h-3.5" /> Routinix'e devam et
        </button>
      </div>
    </div>
  );
}
