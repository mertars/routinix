// Stratejik Başarı Kartı — "Planı Oluştur"a basılıp AI planı kaydedildiğinde
// PlanBoard'un ÜZERİNDE açılan overlay (bkz. usePlanStudio.finalizeAndGenerate).
// Ekrana direkt takvim düşmek YERİNE, önce planın NEDEN böyle kurgulandığını
// (deterministik analiz cümlesi, bkz. utils/smartWidgets.buildStrategicAnalysis)
// ve Akıllı Widget Enjektörü'nün hangi widget'ları otomatik eklediğini
// (rozet listesi) özetler. "Anladım, Planı Başlat" ile kapanır — PlanBoard
// zaten mount olmuş durumda, yalnızca bu overlay kalkar.
export default function PlanGeneratedSummaryModal({ open, summary, planTitle, accent = "#6E7BFF", onClose }) {
  if (!open || !summary) return null;

  const { analysisText, widgetBadges = [] } = summary;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="blur-cap-mobile relative w-full max-w-[420px] rounded-3xl p-6 md:p-7 animate-[fadeIn_0.25s_ease] flex flex-col gap-5"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(28px) saturate(170%)",
          WebkitBackdropFilter: "blur(28px) saturate(170%)",
          border: `1px solid ${accent}44`,
          boxShadow: `0 32px 70px -24px rgba(0,0,0,0.75), 0 0 40px -12px ${accent}55`,
        }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-[26px]"
            style={{ background: `${accent}1F`, boxShadow: `0 0 24px -6px ${accent}` }}
          >
            🎯
          </div>
          <div>
            <h2 className="text-[18px] font-bold tracking-tight text-[var(--text-primary)] text-balance">Stratejin Hazır</h2>
            {planTitle && <p className="mt-1 text-[12px] font-medium text-[var(--text-faint)] truncate max-w-[300px]">{planTitle}</p>}
          </div>
        </div>

        {/* AI analiz cümlesi */}
        <p
          className="text-[13.5px] leading-relaxed text-[var(--text-secondary)] rounded-2xl px-4 py-3.5"
          style={{ background: `${accent}14`, borderLeft: `3px solid ${accent}` }}
        >
          {analysisText}
        </p>

        {/* Eklenecek Otomatik Widget'lar Özeti */}
        {widgetBadges.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#06B6D4" }}>
              ✨ Otomatik Eklenen Widget'lar
            </p>
            <div className="flex flex-wrap gap-1.5">
              {widgetBadges.map(({ type, label, icon: Icon }) => (
                <span
                  key={type}
                  className="flex items-center gap-1.5 rounded-full pl-2.5 pr-3 h-8 text-[11.5px] font-semibold"
                  style={{ background: "rgba(16,185,129,0.14)", color: "#10B981", border: "1px solid rgba(16,185,129,0.35)" }}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full rounded-2xl py-3.5 text-[14.5px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: accent, color: "#0A0E13" }}
        >
          Anladım, Planı Başlat
        </button>
      </div>
    </div>
  );
}
