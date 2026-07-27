export default function Header({ modeAccent, modeAccentSoft, user, onAuthClick, onSignOut, onMenuToggle }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 backdrop-blur-md bg-[#0A0E13]/85 border-b border-[#1E2731]">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: modeAccentSoft, color: modeAccent }}
        >
          AI
        </div>
        <span className="font-semibold tracking-tight text-[15px] text-[#ECF2F4]">AI PlanStudio</span>
      </div>

      <div className="flex items-center gap-2">
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
            Çıkış Yap
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
  );
}
