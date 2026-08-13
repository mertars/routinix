import { LogOut, UserPlus, TriangleAlert } from "lucide-react";

// Misafir Modu Çıkış Uyarısı — ConfirmModal.jsx İLE AYNI glass modal deseni,
// ama misafir oturumunun GERÇEK riskini (veri kalıcı silinir, geri alınamaz)
// TEK bir "Evet/Vazgeç" ikilisine sıkıştırmak yerine 3 net aksiyona ayırır.
// Önerilen/güvenli yol (hesap oluştur) EN BELİRGİN buton; geri alınamaz yol
// (verileri sil) BİLEREK en altta, küçük/metin-ağırlıklı — yanlışlıkla
// tıklanma riskini azaltır (App Store/Google Play "hesap sil" akışlarındaki
// AYNI ilke: yıkıcı aksiyon asla en kolay erişilen buton olmamalı).
export default function GuestExitModal({ open, onCancel, onCreateAccount, onConfirmExit }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center px-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="blur-cap-mobile relative w-full max-w-[360px] rounded-3xl p-6 animate-[fadeIn_0.2s_ease]"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <TriangleAlert className="w-5 h-5 shrink-0" style={{ color: "#F0827A" }} strokeWidth={2.25} />
          <h2 className="text-[16.5px] font-bold text-[var(--text-primary)] text-balance">Dikkat: Misafir Modundan Çıkış</h2>
        </div>
        <p className="text-[13px] text-[var(--text-muted)] leading-relaxed mb-5">
          Misafir modundan çıktığınızda oluşturduğunuz veriler kalıcı olarak silinecektir ve geri alınamaz. Verilerinizi
          korumak için çıkış yapmadan önce bir hesap oluşturmanız önerilir.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={onCreateAccount}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13.5px] font-bold transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(90deg, #22D3EE, #B26BFF)", color: "#0A0E13" }}
          >
            <UserPlus className="w-4 h-4" strokeWidth={2.25} /> Hesap Oluştur / Giriş Yap
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-xl py-2.5 text-[13.5px] font-semibold border transition-colors"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            İptal
          </button>
          <button
            onClick={onConfirmExit}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold transition-colors"
            style={{ color: "#F0827A" }}
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={2.25} /> Verilerimi Sil ve Çık
          </button>
        </div>
      </div>
    </div>
  );
}
