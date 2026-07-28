export default function Header({
  modeAccent,
  modeAccentSoft,
  user,
  todayActive,
  onTodayClick,
  routinesActive,
  onRoutinesClick,
  onAuthClick,
  onSignOut,
  onMenuToggle,
}) {
  return (
    <div className="sticky top-0 z-20">
      <header className="flex items-center justify-between gap-3 px-4 md:px-6 py-3.5 backdrop-blur-md bg-[#0b0c10]/85 border-b border-[#1E2731] max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
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
          <span className="font-bold tracking-tight text-[16px] text-[#ECF2F4]">Routinix</span>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Bugünün Görevleri + Rutinler — iki müstakil mor neon buton (oturum açıkken) */}
          {user && (
            <>
              <button
                onClick={onTodayClick}
                className="flex items-center gap-1.5 rounded-lg px-2.5 md:px-3 h-9 text-[12px] font-semibold transition-all"
                style={{
                  background: todayActive ? "rgba(178,107,255,0.20)" : "rgba(178,107,255,0.10)",
                  color: "#C99CFF",
                  border: "1px solid rgba(178,107,255,0.40)",
                  boxShadow: todayActive ? "0 0 16px -4px rgba(178,107,255,0.7)" : "0 0 10px -5px rgba(178,107,255,0.6)",
                }}
              >
                <span className="text-[13px] leading-none">⚡</span>
                <span className="hidden md:inline">Bugünün Görevleri</span>
                <span className="md:hidden">Bugün</span>
              </button>
              <button
                onClick={onRoutinesClick}
                className="flex items-center gap-1.5 rounded-lg px-2.5 md:px-3 h-9 text-[12px] font-semibold transition-all"
                style={{
                  background: routinesActive ? "rgba(46,217,163,0.18)" : "rgba(46,217,163,0.09)",
                  color: "#7DE9C3",
                  border: "1px solid rgba(46,217,163,0.38)",
                  boxShadow: routinesActive ? "0 0 16px -4px rgba(46,217,163,0.65)" : "0 0 10px -5px rgba(46,217,163,0.55)",
                }}
              >
                <span className="text-[13px] leading-none">🔁</span>
                <span className="hidden md:inline">Rutinler</span>
              </button>
            </>
          )}
          {user ? (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-[12px] font-semibold text-[#C5D0D8] hover:text-[#ECF2F4] transition-colors"
              style={{ background: "#161D25", border: "1px solid #232C36" }}
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
          <button
            onClick={onMenuToggle}
            aria-label="Menü"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8695A3] hover:text-[#ECF2F4] hover:bg-[#161D25] transition-colors"
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
