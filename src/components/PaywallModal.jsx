import { useState } from "react";
import { X, Sparkles, FolderKanban, MessageCircleMore } from "lucide-react";
import { PLAN_LIMIT } from "../services/entitlementsService";

// Paylaşılan Paywall — hem plan limiti (3) hem AI Koç mesaj limiti (15)
// AYNI modalı, yalnızca `reason`a göre farklı ikon/başlık/açıklamayla
// kullanır. AuthModal.jsx İLE AYNI backdrop/glass deseni (bkz. o dosyanın
// dosya başı yorumu) — uygulamada zaten kurulu bir konvansiyon, yeni bir
// stil sistemi İCAT EDİLMEDİ.
//
// DÜRÜSTLÜK NOTU: bu projede henüz GERÇEK bir ödeme entegrasyonu (Stripe
// vb.) YOK (bkz. api/_lib/entitlements.js dosya başı yorumu — user_entitlements.
// is_premium yalnızca service_role ile, yani şu an yalnızca elle/ileride bir
// webhook ile açılabilir). Bu yüzden CTA butonu sahte bir "ödeme al" akışı
// SİMÜLE ETMEZ — tıklanınca yalnızca ilgi kaydını yerel olarak onaylayan bir
// geri bildirim gösterir. Gerçek checkout bağlanınca bu buton onunla
// değiştirilecek.
// `trialLimit`: AI Koç mesaj hakkı sabit bir client sabiti OLARAK
// TEKRARLANMAZ — sunucudan (api/coach-action.js "status" aksiyonu,
// AiCoachWidget.jsx zaten bunu state'inde tutuyor) gelen GERÇEK değer prop
// olarak geçilir; sunucu değeri değişirse (bkz. api/_lib/quota.js
// TRIAL_LIMIT) burada AYRICA güncellenmesi gereken ikinci bir yer OLMASIN.
const REASON_COPY = (trialLimit) => ({
  plans: {
    icon: FolderKanban,
    title: "Ücretsiz plan limitine ulaştın",
    body: `Ücretsiz hesaplar en fazla ${PLAN_LIMIT} plan oluşturabilir (AI ile üretilen, elle hazırlanan ve şablondan kopyalanan planların tümü dahil). Sınırsız plan için Pro'ya geç.`,
  },
  ai_messages: {
    icon: MessageCircleMore,
    title: "AI Koç deneme hakkın doldu",
    body: `${trialLimit} ücretsiz AI Koç mesajını kullandın. Sınırsız koçluk için Pro'ya geç.`,
  },
});

export default function PaywallModal({ open, reason = "plans", trialLimit = 15, accent, onClose }) {
  const [interested, setInterested] = useState(false);
  if (!open) return null;

  const copy = REASON_COPY(trialLimit)[reason] || REASON_COPY(trialLimit).plans;
  const Icon = copy.icon;
  const accentColor = accent || "#B026FF";

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="blur-cap-mobile relative w-full max-w-[380px] rounded-3xl p-6 text-center animate-[fadeIn_0.2s_ease]"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Kapat"
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-4 h-4" strokeWidth={2.25} />
        </button>

        <div
          className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(255,0,127,0.18), rgba(176,38,255,0.18), rgba(0,243,255,0.18))", border: `1px solid ${accentColor}55` }}
        >
          <Icon className="w-6 h-6" style={{ color: accentColor }} strokeWidth={2.25} />
        </div>

        <h3 className="text-[16px] font-bold text-[var(--text-primary)] mb-2 text-balance">{copy.title}</h3>
        <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed mb-5">{copy.body}</p>

        {interested ? (
          <div
            className="w-full rounded-xl py-2.5 text-[12.5px] font-semibold flex items-center justify-center gap-1.5"
            style={{ background: "rgba(46,217,163,0.14)", color: "#2ED9A3", border: "1px solid rgba(46,217,163,0.35)" }}
          >
            ✓ Kaydedildi — Pro açılınca ilk sana haber vereceğiz
          </div>
        ) : (
          <button
            onClick={() => setInterested(true)}
            className="w-full rounded-xl py-2.5 text-[12.5px] font-bold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(90deg, #FF007F, #B026FF, #00F3FF)", color: "#0b0c10" }}
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />
            Pro Çok Yakında — Beni Haberdar Et
          </button>
        )}

        <button onClick={onClose} className="mt-3 text-[11.5px] font-semibold text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors">
          Şimdi değil
        </button>
      </div>
    </div>
  );
}
