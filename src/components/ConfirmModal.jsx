// Genel amaçlı onay modalı — başlık, mesaj ve iki aksiyon (onayla/vazgeç).
// danger=true olduğunda onay butonu kırmızımsı (çıkış/silme gibi geri
// alınamaz işlemler için) olur.
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const confirmBg = danger ? "#F0827A" : "#6E7BFF";

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center px-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[340px] rounded-3xl p-6 animate-[fadeIn_0.2s_ease]"
        style={{
          background: "rgba(15,20,27,0.92)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)",
        }}
      >
        <h2 className="text-[16.5px] font-bold text-[#ECF2F4] mb-2 text-balance">{title}</h2>
        {message && <p className="text-[13px] text-[#8695A3] leading-relaxed mb-5">{message}</p>}
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold border transition-colors"
            style={{ borderColor: "#232C36", color: "#C5D0D8" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: confirmBg, color: "#0A0E13" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
