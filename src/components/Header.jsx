import { Timer } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// ☀️/🌙 Animasyonlu tema değiştirici — güneş/ay ikonu kayarak/dönerek geçiş yapar.
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggleTheme}
      aria-label="Tema Değiştir"
      title={isDark ? "Aydınlık temaya geç" : "Karanlık temaya geç"}
      className="relative w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0 transition-colors"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    >
      <span
        className="absolute text-[15px] transition-all duration-300 ease-out"
        style={{ transform: isDark ? "translateY(0) rotate(0deg)" : "translateY(-22px) rotate(90deg)", opacity: isDark ? 1 : 0 }}
      >
        🌙
      </span>
      <span
        className="absolute text-[15px] transition-all duration-300 ease-out"
        style={{ transform: isDark ? "translateY(22px) rotate(-90deg)" : "translateY(0) rotate(0deg)", opacity: isDark ? 0 : 1 }}
      >
        ☀️
      </span>
    </button>
  );
}

export default function Header({
  modeAccent,
  modeAccentSoft,
  user,
  todayActive,
  onTodayClick,
  routinesActive,
  onRoutinesClick,
  hubActive,
  onHubClick,
  plansActive,
  onPlansClick,
  pomodoroActive,
  onPomodoroClick,
  onAuthClick,
  onSignOut,
  onMenuToggle,
  onLogoClick,
}) {
  return (
    // Kroma (arka plan/blur/alt çizgi) TAM GENİŞLİKTE — geniş masaüstü
    // ekranlarda içerik max-w-7xl'de ortalanırken kroma dar kalırsa, kenarlarda
    // arkadaki mor glow blob'u (BackgroundScene) sol üst köşede "sivri" bir
    // çıkıntı gibi dışarı sızıyordu. İçerik satırı (<header>) ayrı, yalnızca O
    // max-w-7xl'de ortalanır.
    <div
      className="sticky top-0 z-20 backdrop-blur-md"
      style={{ background: "rgba(var(--glass-rgb), var(--alpha-chrome))", borderBottom: "1px solid var(--border-header)" }}
    >
      <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3.5 max-w-7xl mx-auto w-full">
        {/* Logo + marka yazısı: Ana Sayfa'ya döner, basılınca hafifçe küçülür */}
        <button
          onClick={onLogoClick}
          aria-label="Ana Sayfa'ya dön"
          className="flex items-center gap-2.5 transition-transform duration-150 active:scale-95"
        >
          {/* Geometrik çerçeveli "R" logosu */}
          <div
            className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(178,107,255,0.22), rgba(244,64,107,0.18))",
              border: "1px solid rgba(178,107,255,0.45)",
              boxShadow: "0 0 14px -4px rgba(178,107,255,0.6)",
            }}
          >
            <span
              className="text-[17px] font-black leading-none"
              style={{
                background: "linear-gradient(135deg, #C99CFF, #FF6E92)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              R
            </span>
          </div>
          <span className="font-bold tracking-tight text-[16px] text-[var(--text-primary)]">Routinix</span>
        </button>

        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Aksiyon butonları — mobilde hamburger menü (Hızlı Erişim) arkasında,
              masaüstünde navbar'da yatay sıralı. */}
          <div className="hidden md:flex items-center gap-2">
            {/* Şablon Keşfet — herkese açık (oturum gerektirmez, sadece "Kullan" gerektirir) */}
            <button
              onClick={onHubClick}
              className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
              style={{
                background: hubActive ? "rgba(240,179,126,0.20)" : "rgba(240,179,126,0.10)",
                color: "var(--amber-accent)",
                border: "1px solid rgba(240,179,126,0.40)",
                boxShadow: hubActive ? "0 0 16px -4px rgba(240,179,126,0.7)" : "0 0 10px -5px rgba(240,179,126,0.6)",
              }}
            >
              <span className="text-[13px] leading-none">✨</span>
              Şablon Keşfet
            </button>

            {/* Bugünün Görevleri + Rutinler + Planlarım (oturum açıkken) */}
            {user && (
              <>
                <button
                  onClick={onTodayClick}
                  className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
                  style={{
                    background: todayActive ? "rgba(178,107,255,0.20)" : "rgba(178,107,255,0.10)",
                    color: "#C99CFF",
                    border: "1px solid rgba(178,107,255,0.40)",
                    boxShadow: todayActive ? "0 0 16px -4px rgba(178,107,255,0.7)" : "0 0 10px -5px rgba(178,107,255,0.6)",
                  }}
                >
                  <span className="text-[13px] leading-none">⚡</span>
                  Bugünün Görevleri
                </button>
                <button
                  onClick={onRoutinesClick}
                  className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
                  style={{
                    background: routinesActive ? "rgba(46,217,163,0.18)" : "rgba(46,217,163,0.09)",
                    color: "#7DE9C3",
                    border: "1px solid rgba(46,217,163,0.38)",
                    boxShadow: routinesActive ? "0 0 16px -4px rgba(46,217,163,0.65)" : "0 0 10px -5px rgba(46,217,163,0.55)",
                  }}
                >
                  <span className="text-[13px] leading-none">🔁</span>
                  Rutinler
                </button>
                <button
                  onClick={onPlansClick}
                  className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
                  style={{
                    background: plansActive ? "rgba(143,160,255,0.20)" : "rgba(143,160,255,0.10)",
                    color: "#8FA0FF",
                    border: "1px solid rgba(143,160,255,0.40)",
                    boxShadow: plansActive ? "0 0 16px -4px rgba(143,160,255,0.7)" : "0 0 10px -5px rgba(143,160,255,0.6)",
                  }}
                >
                  <span className="text-[13px] leading-none">📂</span>
                  Planlarım
                </button>
              </>
            )}

            {/* Pomodoro & Focus Studio — herkese açık (Şablon Keşfet gibi, oturum gerektirmez) */}
            <button
              onClick={onPomodoroClick}
              className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
              style={{
                background: pomodoroActive ? "rgba(251,113,133,0.20)" : "rgba(251,113,133,0.10)",
                color: "#FB7185",
                border: "1px solid rgba(251,113,133,0.40)",
                boxShadow: pomodoroActive ? "0 0 16px -4px rgba(251,113,133,0.7)" : "0 0 10px -5px rgba(251,113,133,0.6)",
              }}
            >
              <Timer className="w-[13px] h-[13px]" strokeWidth={2.25} />
              Pomodoro
            </button>
          </div>

          {user ? (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              title={user.email}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: modeAccentSoft, color: modeAccent }}
              >
                {(user.email || "?").charAt(0).toUpperCase()}
              </span>
              Çıkış
            </button>
          ) : (
            <button
              onClick={onAuthClick}
              className="rounded-lg px-3 h-9 text-[12.5px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: modeAccent, color: "#0A0E13" }}
            >
              Giriş Yap
            </button>
          )}
          <ThemeToggle />

          <button
            onClick={onMenuToggle}
            aria-label="Menü"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <span className="text-xl leading-none">☰</span>
          </button>
        </div>
      </header>
      {/* Header altından taşan mor/kırmızı neon aura şeridi */}
      <div className="neon-strip" />
    </div>
  );
}
