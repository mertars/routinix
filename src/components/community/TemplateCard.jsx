import { memo } from "react";
import { Heart, Copy, MessageCircle, BadgeCheck } from "lucide-react";
import { categoryOf } from "../../constants";
import CoverPattern from "./CoverPattern";
import Avatar from "./Avatar";

function focusHoursLabel(minutes) {
  if (!minutes) return "0 dk";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
}

// Routinix Nexus şablon kartı — PERFORMANS ÖNCELİKLİ: `backdrop-blur` /
// `box-shadow` / transform HİÇBİRİ yok (bir grid'de aynı anda düzinelerce
// kartta çalışan backdrop-filter + sürekli transform, MacBook fanını
// açtıracak kadar GPU/CPU maliyetliydi). Zemin TAMAMEN OPAK (`bg-[var(--bg-card)]`
// — yarı saydam/alpha-blend bir arka plan bile, altında ne olursa olsun her
// karede yeniden compositing gerektirir; opak zemin tek seferlik bir paint).
// Hover'da TEK etki: border rengi (`transition-colors duration-150`) — ne
// scale/translate ne de shadow. React.memo: `stats`/`author` gibi prop'lar
// CommunityHub'da referans-stabil kaldığı sürece, arama/filtre alakasız bir
// state değiştiğinde grid'deki kartlar yeniden render OLMAZ.
function TemplateCardImpl({ template, onOpen, onOpenAuthor }) {
  const cat = categoryOf(template.category);
  const author = template.author;
  const stats = template.stats || { like_count: 0, clone_count: 0, comment_count: 0 };
  const routineCount = template.preview_routines?.length || 0;
  const focusMin = (template.template_tasks || []).reduce((n, t) => n + (t.duration_min || 0), 0);

  return (
    <button
      onClick={() => onOpen(template)}
      // content-visibility: liste 50+ şablona çıkarsa ekran dışındaki kartların
      // layout/paint maliyetini tarayıcı atlar — scroll performansı için ucuz
      // bir güvence, bugün 16 şablonla da zararsız.
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 400px" }}
      className="group text-left rounded-2xl overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-cyan-500/40 transition-colors duration-150 flex flex-col"
    >
      {/* Kapak — gerçek fotoğraf (bkz. CoverPattern.jsx), sabit yükseklik (kart
          genişliğine göre ORANTISIZ büyümesin diye aspect-ratio değil h-40) */}
      <CoverPattern coverId={template.cover_url} className="w-full h-40 shrink-0">
        {/* Kategori + bot rozeti AYNI flex-wrap şeridinde (iki AYRI absolute
            span DEĞİL): dar kartlarda (grid min genişliği 280px) kategori
            etiketi uzun olduğunda (ör. "Yazılım & Mühendislik") iki rozet
            aynı satırda üst üste binip birbirini kırpıyordu — flex-wrap
            sığmayanı otomatik alt satıra düşürüyor, kırpma/çakışma olmuyor. */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start gap-1.5">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border whitespace-nowrap"
            style={{ background: "rgba(8,13,26,0.75)", borderColor: `${cat.accent}55`, color: cat.accent }}
          >
            {cat.emoji} {cat.label}
          </span>
          {/* Bot/AI tarafından üretilmiş deneme şablonu belirteci — eskiden
              yazar adının yanındaki küçük BadgeCheck ikonu "onaylı hesap" gibi
              okunuyordu (yanlış sinyal); bu, kartın kendisinde net ve
              kaçırılamayacak bir "bu test içeriği" uyarısı. */}
          {author?.is_bot && (
            <span
              className="text-[9px] font-bold uppercase tracking-[0.02em] px-2.5 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap"
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
        </div>
        {(routineCount > 0 || focusMin > 0) && (
          <span className="absolute bottom-2.5 right-2.5 text-[9.5px] font-bold px-2 py-0.5 rounded-full border border-white/15 bg-black/75 text-slate-200">
            ⚡ {routineCount} Rutin • ⏱️ {focusHoursLabel(focusMin)} Odak
          </span>
        )}
      </CoverPattern>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--text-primary)] leading-snug line-clamp-2">{template.title}</h3>
          <p className="text-[12px] text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">{template.story_impact}</p>
        </div>

        {template.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {template.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--border-default)] text-[var(--text-secondary)]">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-[var(--border-default)] flex items-center justify-between gap-2">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onOpenAuthor?.(author);
            }}
            className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition-opacity"
          >
            <Avatar src={author?.avatar_url} name={author?.display_name || author?.username} />
            <span className="text-[11.5px] font-semibold text-[var(--text-secondary)] truncate">{author?.display_name || author?.username}</span>
            {author?.is_bot && <BadgeCheck className="w-3 h-3 shrink-0 text-cyan-400" aria-label="Onaylı" />}
          </span>

          <div className="flex items-center gap-2.5 shrink-0 text-[var(--text-faint)]">
            <span className="flex items-center gap-1 text-[11px] font-semibold">
              <Heart className="w-3.5 h-3.5" /> {stats.like_count}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold">
              <Copy className="w-3.5 h-3.5" /> {stats.clone_count}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold">
              <MessageCircle className="w-3.5 h-3.5" /> {stats.comment_count}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
const TemplateCard = memo(TemplateCardImpl);
export default TemplateCard;

// Arama sonucu boşsa gösterilen boş durum — sakin bir "başka bir şey dene" hissi.
export function TemplateEmptyState({ message = "Bu kritere uyan bir şablon bulunamadı." }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-4 py-20 text-center">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" className="text-[var(--border-strong)]" />
        <path d="M22 26h20M22 32h14M22 38h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[var(--border-strong)]" />
      </svg>
      <p className="text-[13px] font-medium text-[var(--text-muted)] max-w-[280px]">{message}</p>
    </div>
  );
}
