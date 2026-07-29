import { useState } from "react";

// Email + şifre ile giriş/kayıt modalı. signIn/signUp fonksiyonları prop olarak
// gelir (useAuth'tan); modal sadece formu ve durumu (mod, hata, yükleniyor)
// yönetir. Başarılı girişte onSuccess çağrılır (üst katman modalı kapatır).
export default function AuthModal({ open, accent, onClose, onSignIn, onSignUp, onGoogle, onSuccess }) {
  const [tab, setTab] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!open) return null;

  const accentColor = accent || "#6E7BFF";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setInfo("");

    if (!email.trim() || !password) {
      setError("Lütfen email ve şifreni gir.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }

    setLoading(true);
    try {
      if (tab === "signin") {
        const { error: err } = await onSignIn(email.trim(), password);
        if (err) {
          setError(err.message || "Giriş başarısız. Bilgilerini kontrol et.");
          return;
        }
        onSuccess?.();
      } else {
        const { data, error: err } = await onSignUp(email.trim(), password);
        if (err) {
          setError(err.message || "Kayıt başarısız. Lütfen tekrar dene.");
          return;
        }
        // E-posta onayı açıksa session hemen gelmez; kullanıcıyı bilgilendir.
        if (data?.session) {
          onSuccess?.();
        } else {
          setInfo("Kayıt oluşturuldu! E-posta adresine gönderilen onay bağlantısına tıkladıktan sonra giriş yapabilirsin.");
          setTab("signin");
        }
      }
    } catch (err) {
      setError(err?.message || "Beklenmedik bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setError("");
    setInfo("");
    setGoogleLoading(true);
    try {
      // Google onay ekranına yönlendirir; dönüşte oturumu onAuthStateChange yakalar.
      const { error: err } = await onGoogle();
      if (err) {
        setError(err.message || "Google ile giriş başlatılamadı.");
        setGoogleLoading(false);
      }
      // Başarılıysa tarayıcı Google'a yönleniyor — burada bir şey yapmaya gerek yok.
    } catch (err) {
      setError(err?.message || "Google ile giriş başlatılamadı.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[360px] rounded-3xl p-6 animate-[fadeIn_0.2s_ease]"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7)",
        }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[18px] font-bold text-[var(--text-primary)]">
              {tab === "signin" ? "Giriş Yap" : "Kayıt Ol"}
            </h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Planlarını kaydetmek için hesabına bağlan.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            style={{ background: "rgba(var(--overlay-rgb),0.05)" }}
          >
            ✕
          </button>
        </div>

        {/* Sekme kontrolü */}
        <div
          className="flex rounded-xl p-1 gap-1 mb-4"
          style={{ background: "rgba(var(--overlay-rgb),0.045)", border: "1px solid rgba(var(--overlay-rgb),0.08)" }}
        >
          {[
            ["signin", "Giriş Yap"],
            ["signup", "Kayıt Ol"],
          ].map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  setError("");
                  setInfo("");
                }}
                className="flex-1 rounded-lg py-2 text-[12.5px] font-semibold transition-all duration-150"
                style={{
                  background: active ? `${accentColor}22` : "transparent",
                  color: active ? accentColor : "var(--text-muted)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Google ile giriş */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3 text-[13.5px] font-semibold transition-colors disabled:opacity-50"
          style={{ background: "#FFFFFF", color: "#1F2328" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
            />
          </svg>
          {googleLoading ? "Yönlendiriliyor..." : "Google ile Devam Et"}
        </button>

        {/* Ayraç */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px" style={{ background: "rgba(var(--overlay-rgb),0.08)" }} />
          <span className="text-[11px] font-medium text-[var(--text-faint)]">veya</span>
          <div className="flex-1 h-px" style={{ background: "rgba(var(--overlay-rgb),0.08)" }} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl border px-4 py-3 bg-transparent outline-none text-[14px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre (en az 6 karakter)"
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-xl border px-4 py-3 bg-transparent outline-none text-[14px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
          />

          {error && (
            <p className="text-[12px] font-medium leading-relaxed" style={{ color: "#F0827A" }}>
              {error}
            </p>
          )}
          {info && (
            <p className="text-[12px] font-medium leading-relaxed" style={{ color: "#6FCF97" }}>
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl py-3 text-[14px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: accentColor, color: "#0A0E13" }}
          >
            {loading ? "Lütfen bekle..." : tab === "signin" ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </form>
      </div>
    </div>
  );
}
