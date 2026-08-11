import { memo, useState } from "react";
import { Timer, BarChart3, Users2, Menu, X, Play, Pause, Maximize2, LogOut } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useMusic } from "../context/MusicContext";
import { FEATURE_FLAGS } from "../constants";
import RoutinixLogo from "./RoutinixLogo";

// Üst bar mini müzik widget'ı — büyük, ışıltılı MusicSidePanel kapatıldığında
// müziği hızlıca yönetmek için (bkz. GlobalMusicPlayer.jsx, aynı useMusic()
// context'i paylaşırlar). Bir oynatıcı en az BİR KEZ başlatılana kadar
// (spotifyInitialized) HİÇ render edilmez — kullanıcı müzikle hiç
// ilgilenmediyse üst barda gereksiz bir widget görünmez. YouTube Music
// altyapısı kaldırıldığından (bkz. MusicContext.jsx) tint artık HER ZAMAN
// Spotify yeşili — tab'a göre değişen bir ternary'ye gerek kalmadı.
function MiniMusicWidget() {
  const m = useMusic();
  if (!m.hasActivePlayer || m.panelOpen) return null;

  const tint = "#1DB954";

  return (
    <button
      onClick={() => m.openPanel()}
      className="flex items-center gap-1.5 rounded-full pl-1 pr-3 h-9 bg-slate-900/80 border border-emerald-500/30 transition-all hover:border-emerald-500/50"
      title="Müzik panelini aç"
    >
      <span
        onClick={(e) => {
          e.stopPropagation();
          m.togglePlayPause();
        }}
        role="button"
        aria-label={m.isPlaying ? "Duraklat" : "Oynat"}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{ background: `${tint}26`, color: tint }}
      >
        {m.isPlaying ? <Pause className="w-3 h-3" fill="currentColor" /> : <Play className="w-3 h-3" fill="currentColor" />}
      </span>
      <span className="max-w-[120px] truncate text-[11.5px] font-semibold text-emerald-300">
        🎵 {m.nowPlayingLabel}
        {m.isPlaying ? " — Playing" : ""}
      </span>
      <Maximize2 className="w-3 h-3 shrink-0 text-white/30" />
    </button>
  );
}

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

// 📋🗓️🔄 Birleşik Görev Yönetimi — üç ayrı "Görevler ve Planlar" / "Planlarım" /
// "Rutinler" düğmesi TEK, ikon-only bir düğmede toplandı (masaüstü üst bar
// kalabalığını/taşmasını azaltmak için). Tıklanınca 3 seçenekli bir
// Glassmorphism dropdown açar; her seçenek MEVCUT toggle fonksiyonlarını
// (onTasksClick/onPlansClick/onRoutinesClick — app.jsx'teki closeAllPanels
// dahil TÜM davranış) BİREBİR çağırır — yalnızca giriş noktası birleşti,
// sayfa/yönlendirme mantığında hiçbir şey değişmedi.
function TaskManagementDropdown({ tasksActive, onTasksClick, plansActive, onPlansClick, routinesActive, onRoutinesClick }) {
  const [open, setOpen] = useState(false);
  const anyActive = tasksActive || plansActive || routinesActive;
  const items = [
    { key: "tasks", icon: "📋", label: "Görevlerim", active: tasksActive, onClick: onTasksClick },
    { key: "plans", icon: "🗓️", label: "Planlarım", active: plansActive, onClick: onPlansClick },
    { key: "routines", icon: "🔄", label: "Rutinlerim", active: routinesActive, onClick: onRoutinesClick },
  ];
  return (
    <div className="relative">
      <button
        data-tour-id="tour-header-tasks"
        onClick={() => setOpen((v) => !v)}
        aria-label="Görevler, Planlar ve Rutinler"
        title="Görevler, Planlar ve Rutinler"
        className="flex items-center gap-1 rounded-lg px-2.5 h-9 transition-all"
        style={{
          background: anyActive ? "rgba(0,242,254,0.18)" : "rgba(0,242,254,0.10)",
          border: "1px solid rgba(0,242,254,0.40)",
          boxShadow: anyActive ? "0 0 14px -4px rgba(0,242,254,0.65)" : "0 0 10px -5px rgba(0,242,254,0.5)",
        }}
      >
        <span className="text-[13px] leading-none">📋</span>
        <span className="text-[13px] leading-none">🗓️</span>
        <span className="text-[13px] leading-none">🔄</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-[96] w-52 rounded-2xl p-1.5 glass" style={{ boxShadow: "0 20px 50px -16px rgba(0,0,0,0.4)" }}>
            {items.map((it) => (
              <button
                key={it.key}
                onClick={() => {
                  it.onClick();
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-semibold flex items-center gap-2.5 transition-colors"
                style={it.active ? { background: "rgba(0,242,254,0.14)", color: "#00C2D6" } : { color: "var(--text-secondary)" }}
              >
                <span className="text-[14px]">{it.icon}</span> {it.label}
              </button>
            ))}
          </div>
        </>
      )}
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
      style={{
        background: "rgba(var(--glass-rgb), var(--alpha-chrome))",
        borderBottom: "1px solid var(--border-header)",
        // iOS Safe Area / PWA (viewport-fit=cover) durumunda çentik/durum
        // çubuğu Header'ın üzerine biniyordu. `env(safe-area-inset-top)`
        // BİLEREK bir alt-sınır (ör. max(12px, ...)) İLE SARILMADI: normal
        // tarayıcıda ve masaüstünde bu değer 0px'dir, dolayısıyla mevcut
        // görünüme HİÇ dokunmaz — yalnızca gerçek bir çentik/PWA tam ekran
        // bağlamında (env() > 0) devreye girer.
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <header className="flex flex-nowrap items-center justify-between gap-2 px-4 md:px-6 h-14 max-w-7xl mx-auto w-full">
        {/* Logo + marka yazısı: Ana Sayfa'ya döner, basılınca hafifçe küçülür */}
        <button
          onClick={onLogoClick}
          aria-label="Ana Sayfa'ya dön"
          className="flex items-center gap-2.5 transition-transform duration-150 active:scale-95"
        >
          <RoutinixLogo size={36} />
          <span className="font-bold tracking-tight text-[16px] text-[var(--text-primary)]">Routinix</span>
        </button>

        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Aksiyon butonları — mobilde hamburger menü (Hızlı Erişim) arkasında,
              masaüstünde navbar'da yatay sıralı. */}
          <div className="hidden md:flex items-center gap-2 min-w-0">
            {/* Şablon Keşfet — FEATURE_FLAGS.SHOW_TEMPLATES=false iken gizli
                (bkz. constants.js) — kod SİLİNMEDİ, yalnızca üst bar
                kalabalığını azaltmak için görünürlükten çıkarıldı. */}
            {FEATURE_FLAGS.SHOW_TEMPLATES && (
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
            )}

            {/* Görevlerim/Planlarım/Rutinlerim — TEK birleşik ikon-only
                dropdown'da (bkz. TaskManagementDropdown) + Ritim & Gün Sonu
                (oturum açıkken) */}
            {user && (
              <>
                <TaskManagementDropdown
                  tasksActive={tasksActive}
                  onTasksClick={onTasksClick}
                  plansActive={plansActive}
                  onPlansClick={onPlansClick}
                  routinesActive={routinesActive}
                  onRoutinesClick={onRoutinesClick}
                />
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

            <MiniMusicWidget />
          </div>

          {user ? (
            // Mobilde İKON-ONLY (bildirilen hata: "kaybolan Çıkış Yap butonu"
            // — R logosu + marka adı solda, TaskManagementDropdown/Ritim/
            // Nexus/Pomodoro grubu `hidden md:flex` olsa da bu buton + tema
            // + hamburger dar ekranlarda sıkışıp taşabiliyordu). sm: ve
            // üzerinde eski avatar+"Çıkış" metni geri döner.
            <button
              onClick={onSignOut}
              aria-label="Çıkış Yap"
              className="flex items-center gap-1.5 rounded-lg px-2.5 sm:px-2.5 w-9 sm:w-auto h-9 justify-center text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
              title={user.email}
            >
              <span
                className="hidden sm:flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: modeAccentSoft, color: modeAccent }}
              >
                {(user.email || "?").charAt(0).toUpperCase()}
              </span>
              <LogOut className="w-4 h-4 sm:hidden" strokeWidth={2.25} />
              <span className="hidden sm:inline">Çıkış</span>
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
          <MenuTrigger open={menuOpen} onToggle={onMenuToggle} />
        </div>
      </header>
      {/* Header altından taşan mor/kırmızı neon aura şeridi */}
      <div className="neon-strip" />
    </div>
  );
}
export default memo(Header);
