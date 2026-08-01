import { useState } from "react";

// "Kaç günlük planı dışa aktarmak istersin?" — aralık seçimi, ardından yazdır.
// onExport(dayCount) çağrılır (Infinity = tüm plan). Üst katman printRange'i set
// edip window.print() tetikler.
export default function PrintModal({ open, accent, maxDays, onExport, onClose }) {
  const [choice, setChoice] = useState("all"); // "all" | "3" | "custom"
  const [customVal, setCustomVal] = useState("7");

  if (!open) return null;

  const handleExport = () => {
    let days = Infinity;
    if (choice === "3") days = 3;
    else if (choice === "custom") days = Math.max(1, parseInt(customVal, 10) || 1);
    onExport(days);
  };

  const options = [
    { key: "all", label: "Tüm Plan", desc: maxDays ? `${maxDays} yüklü gün` : "Yüklü tüm günler" },
    { key: "3", label: "İlk 3 Gün", desc: "Hızlı özet" },
    { key: "custom", label: "Özel Gün Sayısı", desc: "Sen belirle" },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="blur-cap-mobile relative w-full max-w-[360px] rounded-3xl overflow-hidden animate-[fadeIn_0.2s_ease]"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: "0 24px 60px -18px rgba(0,0,0,0.75)",
        }}
      >
        <div className="neon-strip" />
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-[16.5px] font-bold text-[var(--text-primary)] text-balance">Kaç günlük planı dışa aktarmak istersin?</h2>
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              style={{ background: "rgba(var(--overlay-rgb),0.05)" }}
            >
              ✕
            </button>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mb-4">Çıktı temiz beyaz, baskıya uygun bir şablonda hazırlanır.</p>

          <div className="flex flex-col gap-2.5 mb-5">
            {options.map((o) => {
              const active = choice === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setChoice(o.key)}
                  className="w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-colors"
                  style={{ borderColor: active ? accent : "var(--border-default)", background: active ? `${accent}1a` : "var(--bg-card)" }}
                >
                  <span
                    className="w-[18px] h-[18px] rounded-full border flex items-center justify-center text-[10px] shrink-0"
                    style={{ borderColor: active ? accent : "var(--border-strong)", background: active ? accent : "transparent", color: "#0b0c10" }}
                  >
                    {active ? "✓" : ""}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-[var(--text-primary)]">{o.label}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{o.desc}</div>
                  </div>
                  {o.key === "custom" && active && (
                    <input
                      type="number"
                      min={1}
                      value={customVal}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setCustomVal(e.target.value)}
                      className="w-16 shrink-0 rounded-lg border px-2 py-1.5 bg-transparent outline-none text-[13px] text-center text-[var(--text-primary)]"
                      style={{ borderColor: "var(--border-default)", background: "var(--bg-input)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleExport}
            className="w-full rounded-xl py-3 text-[14px] font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
            style={{ background: accent, color: "#0b0c10" }}
          >
            🖨️ PDF İndir / Yazdır
          </button>
        </div>
      </div>
    </div>
  );
}
