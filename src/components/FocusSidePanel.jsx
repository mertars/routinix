// Duyarlı panel: masaüstünde (md: ≥768px) sol/sağ kenardan açılan yan
// çekmece (Drawer/Sidebar), mobilde ekranın altından yukarı kayan "Bottom
// Sheet"e dönüşür. Konumlandırma + animasyon `.focus-panel` (GlobalStyles.jsx)
// içinde tek bir CSS media query ile yönetilir — burada yalnızca içerik/iskelet var.
// TaskCard.jsx bunu, tek satıra indirgenmiş görev kartının detaylarını
// (açıklama/etiketler/harita) göstermek için kullanır (side="right").
export default function FocusSidePanel({ open, onClose, side = "right", title, icon, children }) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[94] bg-black/40 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div
        className={`focus-panel focus-panel--${side} no-scrollbar`}
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: side === "left" ? "12px 0 40px -20px rgba(0,0,0,0.5)" : "-12px 0 40px -20px rgba(0,0,0,0.5)",
        }}
      >
        <div className="shrink-0 px-4 pt-4 pb-3 border-b flex items-center justify-between gap-2" style={{ borderColor: "var(--modal-border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <h3 className="text-[14px] font-bold text-[var(--text-primary)] truncate">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            style={{ background: "rgba(var(--overlay-rgb),0.06)" }}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-4">{children}</div>
      </div>
    </>
  );
}
