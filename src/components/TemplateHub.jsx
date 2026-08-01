import { useState } from "react";
import { categoryOf, TEMPLATE_LIBRARY, TEMPLATE_CATEGORY_TABS } from "../constants";

// Tek bir şablon kartı: kapak görseli + süre rozeti, başlık/açıklama/tamamlanma
// rozeti, alt kısımda Önizleme (inline accordion) + Şablonu Kullan.
function TemplateCard({ template, previewOpen, onTogglePreview, onUse }) {
  const cat = categoryOf(template.category);

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ borderColor: `${cat.accent}30` }}>
      {/* Kapak görseli + süre rozeti (Unsplash, kırılırsa gradyan zemin kalır) */}
      <div className="relative h-32 md:h-36 shrink-0" style={{ background: `linear-gradient(135deg, ${cat.accent}33, var(--bg-app))` }}>
        <img
          src={template.image}
          alt=""
          loading="lazy"
          onError={(e) => (e.currentTarget.style.display = "none")}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "saturate(0.85) brightness(0.75)" }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(11,12,16,0.85) 100%)" }} />
        <span
          className="absolute top-2 right-2 text-[10.5px] font-bold px-2 py-1 rounded-full"
          style={{ background: "rgba(11,12,16,0.75)", color: "var(--text-primary)", border: "1px solid rgba(var(--overlay-rgb),0.15)" }}
        >
          {template.totalDays} Gün
        </span>
        <span className="absolute bottom-2 left-2.5 text-[20px]">{template.emoji}</span>
      </div>

      {/* Orta kısım */}
      <div className="flex-1 p-3.5 flex flex-col gap-1.5">
        <h3 className="text-[13.5px] font-semibold leading-snug text-slate-900 dark:text-slate-100 text-balance">{template.title}</h3>
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1">{template.description}</p>
        <span
          className="inline-flex self-start items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
          style={{ background: "rgba(46,217,163,0.12)", color: "#7DE9C3" }}
        >
          ✓ Tamamlama Oranı: %{template.completionRate}
        </span>
      </div>

      {/* Önizleme (inline accordion) */}
      <div className={`accordion-body ${previewOpen ? "open" : ""}`}>
        <div className="accordion-inner">
          <div className="px-3.5 pb-3 pt-0 flex flex-col gap-2.5 border-t border-slate-200 dark:border-white/5 mt-0.5 pt-3">
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: cat.accent }}>
                🔁 Örnek Rutinler
              </p>
              <ul className="flex flex-col gap-1">
                {template.previewRoutines.map((r, i) => (
                  <li key={i} className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 leading-relaxed flex gap-1.5">
                    <span className="text-slate-500">·</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: cat.accent }}>
                📅 Gün Akışı
              </p>
              <ul className="flex flex-col gap-1">
                {template.previewDays.map((d, i) => (
                  <li key={i} className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200 leading-relaxed flex gap-1.5">
                    <span className="shrink-0 text-slate-500" style={{ fontFamily: "ui-monospace, monospace" }}>
                      {i + 1}.
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
                {template.totalDays > template.previewDays.length && (
                  <li className="text-[11px] text-slate-500 pl-4">+ {template.totalDays - template.previewDays.length} gün daha…</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Alt aksiyonlar */}
      <div className="p-3.5 pt-2.5 flex gap-2 border-t border-slate-200 dark:border-white/5">
        <button
          onClick={onTogglePreview}
          className="flex-1 rounded-lg py-2 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          style={{ background: "rgba(var(--overlay-rgb),0.05)", border: "1px solid rgba(var(--overlay-rgb),0.08)" }}
        >
          {previewOpen ? "Gizle" : "Önizleme"}
        </button>
        <button
          onClick={onUse}
          className="flex-1 rounded-lg py-2 text-[12px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: cat.accent, color: "#0b0c10" }}
        >
          Şablonu Kullan
        </button>
      </div>
    </div>
  );
}

// "✨ Şablon Keşfet" — tam ekran glassmorphism Template Hub. Kategori
// sekmeleriyle filtrelenen görsel kart grid'i; "Şablonu Kullan" seçilen
// şablonun goal + category + totalDays'ini usePlanStudio.startFromTemplate'e
// aktarıp plan üretim akışını (wizard) anında başlatır.
export default function TemplateHub({ open, onClose, onUseTemplate }) {
  const [tab, setTab] = useState("all");
  const [previewId, setPreviewId] = useState(null);

  if (!open) return null;

  const list = tab === "all" ? TEMPLATE_LIBRARY : TEMPLATE_LIBRARY.filter((t) => t.category === tab);

  const use = (template) => {
    onUseTemplate(template);
    onClose();
  };

  return (
    <div
      className="blur-cap-mobile fixed inset-0 z-[90] flex flex-col animate-[fadeIn_0.2s_ease]"
      style={{ background: "rgba(var(--glass-rgb), var(--alpha-modal))", backdropFilter: "blur(28px) saturate(150%)", WebkitBackdropFilter: "blur(28px) saturate(150%)" }}
    >
      {/* Üst bar */}
      <div className="shrink-0 px-4 md:px-8 pt-5 pb-3 border-b border-slate-200 dark:border-white/8">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between mb-4">
          <h2 className="text-[18px] md:text-[22px] font-bold text-slate-900 dark:text-slate-100">✨ Şablon Keşfet</h2>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.06)" }}
          >
            ✕
          </button>
        </div>

        {/* Kategori sekmeleri */}
        <div className="max-w-6xl mx-auto w-full edge-fade-x flex gap-2 overflow-x-auto no-scrollbar">
          {TEMPLATE_CATEGORY_TABS.map((t) => {
            const active = tab === t.key;
            const accent = t.key === "all" ? "#B26BFF" : categoryOf(t.key).accent;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors"
                style={{
                  background: active ? `${accent}22` : "rgba(var(--overlay-rgb),0.05)",
                  color: active ? accent : "var(--text-muted)",
                  border: `1px solid ${active ? accent + "55" : "rgba(var(--overlay-rgb),0.08)"}`,
                }}
              >
                <span>{t.emoji}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kart grid'i */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              previewOpen={previewId === template.id}
              onTogglePreview={() => setPreviewId(previewId === template.id ? null : template.id)}
              onUse={() => use(template)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
