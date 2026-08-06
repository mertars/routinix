import { Calendar, FileText, FileJson } from "lucide-react";

const NEON = { cyan: "#00F3FF", violet: "#8B5CF6" };

const FORMATS = [
  { key: "ics", icon: Calendar, label: "Takvim Dosyası", ext: ".ics", desc: "Google / Apple / Outlook Takvim'e aktarılabilir. Gün 1 bugüne bağlanır, saat notu yoksa 09:00 varsayılır." },
  { key: "pdf", icon: FileText, label: "Şık PDF Çıktısı", ext: ".pdf", desc: "Yazdırmaya hazır, temiz bir plan dökümü." },
  { key: "json", icon: FileJson, label: "JSON / Routinix Şablonu", ext: ".json", desc: "Routinix'e (veya başka bir cihaza) geri içe aktarılabilecek tam yedek." },
];

// Plan Studio & Editor Engine — "Dışa Aktar" formatı seçim modalı.
export default function ExportFormatModal({ open, onPick, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] rounded-3xl overflow-hidden animate-[fadeIn_0.2s_ease]"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: `0 24px 60px -18px rgba(0,0,0,0.75), 0 0 30px -10px ${NEON.cyan}55`,
        }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${NEON.violet}, ${NEON.cyan}, transparent)` }} />
        <div className="p-5">
          <h2 className="text-[16px] font-bold text-[var(--text-primary)] mb-1">Hangi formatta dışa aktarmak istersin?</h2>
          <p className="text-[12px] text-[var(--text-muted)] mb-4">Plan şu anki (henüz kaydedilmemiş olabilecek) haliyle aktarılır.</p>

          <div className="flex flex-col gap-2">
            {FORMATS.map(({ key, icon: Icon, label, ext, desc }) => (
              <button
                key={key}
                onClick={() => onPick(key)}
                className="w-full text-left rounded-2xl border p-3 flex items-start gap-3 transition-colors hover:bg-[rgba(var(--overlay-rgb),0.05)]"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
              >
                <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${NEON.cyan}18`, color: "#0891A8" }}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">{label}</span>
                    <span className="text-[10.5px] text-[var(--text-faint)]" style={{ fontFamily: "ui-monospace, monospace" }}>{ext}</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 rounded-xl py-2.5 text-[12.5px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.05)" }}
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
