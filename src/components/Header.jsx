import { memo } from "react";
import { Timer, BarChart3, Users2, Menu, X, HelpCircle, Target } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import SpotlightMenu from "./onboarding/SpotlightMenu";

// Standart hamburger tetikleyici — her ekran boyutunda görünür (mobil/
// masaüstü ayrımı YOK, klasik/tutarlı davranış). Açıkken ikon ≡'den X'e
// döner. Bilerek sade: efekt/glow/animasyon yok.
function MenuTrigger({ open, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
      aria-expanded={open}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
      style={{ color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    >
      {open ? <X className="w-[18px] h-[18px]" /> : <Menu className="w-[18px] h-[18px]" />}
    </button>
  );
}

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

// ❓ Rehber — OnboardingTour'u istediği zaman yeniden açar (bkz.
// OnboardingTour.jsx). Tur ilk ziyarette otomatik açılır ve bir daha
// KENDİLİĞİNDEN gösterilmez; bu buton onu manuel geri getirmenin TEK yolu.
function TourTrigger({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Nasıl Kullanılır / Rehber"
      title="Nasıl Kullanılır / Rehber"
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
      style={{ color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    >
      <HelpCircle className="w-[18px] h-[18px]" strokeWidth={2} />
    </button>
  );
}

// 🎯 Hızlı Öğretici — Spotlight Interactive Guide Engine'in giriş kapısı
// (bkz. onboarding/SpotlightMenu.jsx). ❓ Rehber'den (tam ekran, adım adım
// tur) BİLEREK AYRI: bu buton belirli bir özelliği SEÇİP doğrudan o gerçek
// arayüz elemanının üzerinde karartma+ok ile gösterir, tur baştan sona
// izletmez. `relative` sarmalayıcı ZORUNLU — açılır menü buna göre konumlanır.
function SpotlightTrigger({ open, onToggle, onClose, onNavigateIntro }) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-label="Hızlı Öğretici"
        title="Hızlı Öğretici"
        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
        style={open ? { color: "#F0B37E", background: "rgba(240,179,126,0.14)", border: "1px solid rgba(240,179,126,0.4)" } : { color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
      >
        <Target className="w-[18px] h-[18px]" strokeWidth={2} />
      </button>
      <SpotlightMenu open={open} onClose={onClose} onNavigateIntro={onNavigateIntro} />
    </div>
  );
}

// App'in kök state'inde (usePlanStudio) çoğu değişiklik (ör. "goal" alanına
// her tuş vuruşu) Header'ın props'larını ETKİLEMEZ — App.jsx'teki tüm
// callback'ler useCallback ile sarılı olduğundan, memo bu durumlarda Header'ın
// tamamen gereksiz yere yeniden render olmasını (ikon/buton ağacının tekrar
// hesaplanmasını) engeller.
function Header({
  modeAccent,
  modeAccentSoft,
  user,
  tasksActive,
  onTasksClick,
  routinesActive,
  onRoutinesClick,
  hubActive,
  onHubClick,
  plansActive,
  onPlansClick,
  rhythmActive,
  onRhythmClick,
  communityActive,
  onCommunityClick,
  pomodoroActive,
  onPomodoroClick,
  onAuthClick,
  onSignOut,
  onLogoClick,
  onTourClick,
  spotlightOpen,
  onSpotlightToggle,
  onSpotlightClose,
  onNavigateIntro,
  menuOpen,
  onMenuToggle,
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

            {/* Görevler ve Planlar + Rutinler + Planlarım (oturum açıkken) */}
            {user && (
              <>
                <button
                  data-tour-id="tour-header-tasks"
                  onClick={onTasksClick}
                  className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
                  style={{
                    background: tasksActive ? "rgba(0,242,254,0.20)" : "rgba(0,242,254,0.10)",
                    color: "#00F2FE",
                    border: "1px solid rgba(0,242,254,0.40)",
                    boxShadow: tasksActive ? "0 0 16px -4px rgba(0,242,254,0.7)" : "0 0 10px -5px rgba(0,242,254,0.6)",
                  }}
                >
                  <span className="text-[13px] leading-none">📋</span>
                  Görevler ve Planlar
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
                <button
                  onClick={onRhythmClick}
                  className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
                  style={{
                    background: rhythmActive ? "rgba(167,139,250,0.20)" : "rgba(167,139,250,0.10)",
                    color: "#A78BFA",
                    border: "1px solid rgba(167,139,250,0.40)",
                    boxShadow: rhythmActive ? "0 0 16px -4px rgba(167,139,250,0.7)" : "0 0 10px -5px rgba(167,139,250,0.6)",
                  }}
                >
                  <BarChart3 className="w-[13px] h-[13px]" strokeWidth={2.25} />
                  Ritim & Gün Sonu
                </button>
              </>
            )}

            {/* Routinix Nexus — Şablon Keşfet gibi herkese açık (göz atmak oturum
                gerektirmez, paylaşım/beğeni/takip modül içinde kendi hafif
                kullanıcı-adı akışıyla istenir). Cyan aksan — modülün kendi
                mor/cyan neon-glass kimliğiyle eşleşir. */}
            <button
              data-tour-id="tour-header-nexus"
              onClick={onCommunityClick}
              className="flex items-center gap-1.5 rounded-lg px-3 h-9 text-[12px] font-semibold transition-all"
              style={{
                background: communityActive ? "rgba(34,211,238,0.22)" : "rgba(34,211,238,0.12)",
                color: "#67E8F9",
                border: "1px solid rgba(34,211,238,0.40)",
                boxShadow: communityActive ? "0 0 16px -4px rgba(34,211,238,0.6)" : "0 0 10px -5px rgba(34,211,238,0.5)",
              }}
            >
              <Users2 className="w-[13px] h-[13px]" strokeWidth={2.25} />
              Nexus
            </button>

            {/* Pomodoro & Focus Studio — herkese açık (Şablon Keşfet gibi, oturum gerektirmez) */}
            <button
              data-tour-id="tour-header-pomodoro"
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
          <TourTrigger onClick={onTourClick} />
          <SpotlightTrigger open={spotlightOpen} onToggle={onSpotlightToggle} onClose={onSpotlightClose} onNavigateIntro={onNavigateIntro} />
          <ThemeToggle />
          <MenuTrigger open={menuOpen} onToggle={onMenuToggle} />
        </div>
      </header>
      {/* Header altından taşan mor/kırmızı neon aura şeridi */}
      <div className="neon-strip" />
    </div>
  );
}
export default memo(Header);
