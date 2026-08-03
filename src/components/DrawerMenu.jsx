import { memo } from "react";
import { Repeat2, Compass, ListChecks, Users2, Timer, BarChart3, User, FolderOpen, ChevronRight, Trash2, Plus, Target } from "lucide-react";
import { MONO_FONT } from "../constants";

// Nötr Bento kartı (gezinme kareleri + Planlarım/Profil şeritleri) — arka
// plan `--overlay-rgb` token'ı üzerinden (koyu temada beyaz, açık temada
// koyu lacivert baz — bkz. index.css), kenarlık ise BİLİNÇLİ olarak gerçek
// Tailwind `dark:` varyantı: açık temada hafif MOR marka tonu, koyu temada
// nötr beyaz. (@custom-variant dark index.css'te .dark sınıfına bağlı,
// index.html'in anti-flash script'i <html>'e hem .dark hem data-theme
// ekliyor — yani `dark:` sınıfları bu projede GERÇEKTEN çalışıyor.)
const CARD_BG = "rgba(var(--overlay-rgb), 0.05)";
const CARD_BORDER_CLASS = "border border-purple-500/30 dark:border-white/10";

function BentoTile({ icon, label, gradient, glow, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bento-card card-glow group relative flex flex-col items-start justify-between gap-2 rounded-3xl p-3 pb-2.5 text-left ${CARD_BORDER_CLASS}`}
      style={{ background: CARD_BG }}
    >
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${gradient} shadow-lg ${glow}`}>
        {icon}
      </span>
      <span className="text-[11.5px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
    </button>
  );
}

function BentoStrip({ icon, iconGradient, iconGlow, label, trailing, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bento-card card-glow w-full flex items-center gap-3 rounded-3xl px-4 py-2.5 ${CARD_BORDER_CLASS}`}
      style={{ background: CARD_BG }}
    >
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${iconGradient} shadow-lg ${iconGlow} shrink-0`}>
        {icon}
      </span>
      <span className="flex-1 text-[13px] font-bold text-left truncate" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      {trailing}
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
    </button>
  );
}

// "Top Bar Neon Trigger & Top-Down Glass Sheet" — Header.jsx'in tam
// ortasındaki nabız gibi atan ok tetikleyiciden (bkz. Header.jsx
// MenuTrigger) aşağı doğru süzülerek açılır (bkz. GlobalStyles.jsx
// .top-sheet). Kapatma AYNI tetikleyiciye tekrar dokunarak (ok ↔ X
// morph'u) YA DA arka plana dokunarak olur.
//
// TEMA: sheet zemini + kartlar TAMAMEN tema token'ları / gerçek `dark:`
// varyantlarıyla kurulur — hiçbir yerde hardcoded `bg-black`/`text-white`
// yok. Yalnızca 2 "hero-tier" aksiyon kartı (Plan Ekle, Planları Yönet)
// BİLİNÇLİ olarak katı/opak canlı gradyan taşır (temaya göre DEĞİL) — açık
// temada yarı saydam bir renk katmanı solup üzerindeki beyaz metnin
// kontrastını çökertirdi; katı bir renk bloğu bunu temaya bakılmaksızın
// kökten çözer.
//
// Not: eski "Günün İlerlemesi" hero'su BİLİNÇLİ olarak kaldırıldı — hem bu
// menüde hem MobileActionDeck.jsx'te aynı veriyi göstermek gereksiz
// tekrardı; onun yerini burada, istenen "Hedef Odak Kutusu" aldı (gerçek
// `planGoal` — plans.summary; uydurma bir "günlük not" özelliği DEĞİL).
// Gezinme grid'i + Planlarım şeridi bilerek KORUNDU (kullanıcı yeni içerik
// listesinde yer vermese de, mobilde bunlara başka bir erişim yolu yok —
// sessizce kaldırmak gerçek bir işlev kaybı olurdu).
function DrawerMenu({
  open,
  onClose,
  accent,
  user,
  planGoal,
  savedPlansCount,
  onNewPlan,
  onDeletePlan,
  onOpenHub,
  onOpenTasks,
  onOpenRoutines,
  onOpenPlans,
  onOpenRhythm,
  onOpenCommunity,
  onOpenPomodoro,
  onOpenProfile,
}) {
  if (!open) return null;

  const go = (fn) => () => {
    fn?.();
    onClose?.();
  };

  const bentoTiles = [
    { key: "routines", icon: <Repeat2 className="w-4 h-4" strokeWidth={2.5} />, label: "Rutinlerim", gradient: "from-emerald-400 to-teal-600", glow: "shadow-emerald-500/30", onClick: onOpenRoutines, always: false },
    { key: "hub", icon: <Compass className="w-4 h-4" strokeWidth={2.5} />, label: "Keşfet / Şablonlar", gradient: "from-amber-400 to-orange-600", glow: "shadow-orange-500/30", onClick: onOpenHub, always: true },
    { key: "tasks", icon: <ListChecks className="w-4 h-4" strokeWidth={2.5} />, label: "Görevler", gradient: "from-cyan-400 to-blue-600", glow: "shadow-blue-500/30", onClick: onOpenTasks, always: false },
    { key: "community", icon: <Users2 className="w-4 h-4" strokeWidth={2.5} />, label: "Routinix Nexus", gradient: "from-purple-500 to-indigo-600", glow: "shadow-purple-500/30", onClick: onOpenCommunity, always: true },
    { key: "rhythm", icon: <BarChart3 className="w-4 h-4" strokeWidth={2.5} />, label: "Ritim & Gün Sonu", gradient: "from-violet-500 to-purple-700", glow: "shadow-violet-500/30", onClick: onOpenRhythm, always: false },
    { key: "pomodoro", icon: <Timer className="w-4 h-4" strokeWidth={2.5} />, label: "Pomodoro & Focus", gradient: "from-pink-500 to-rose-600", glow: "shadow-pink-500/30", onClick: onOpenPomodoro, always: true },
  ].filter((t) => t.always || user);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="top-sheet blur-cap-mobile z-50 flex flex-col backdrop-blur-2xl bg-white/90 dark:bg-[#0c0d12]/90 border-b border-purple-500/20 shadow-2xl no-scrollbar">
        <div className="neon-strip" />

        <div className="max-w-2xl mx-auto w-full flex-1 overflow-y-auto no-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-[calc(env(safe-area-inset-top)+14px)] flex flex-col gap-2.5">
          {/* Hedef Odak Kutusu — gerçek plan hedefi, neon yan ışıltılı cam kutu */}
          <div
            className="rounded-2xl p-3.5 backdrop-blur-md"
            style={{
              background: "rgba(var(--overlay-rgb),0.045)",
              boxShadow: "-6px 0 18px -6px rgba(178,107,255,0.4), 6px 0 18px -6px rgba(34,211,238,0.35), 0 0 0 1px rgba(178,107,255,0.3)",
            }}
          >
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-faint)" }}>
              <Target className="w-3 h-3" /> Bugünkü Odak Noktan
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed line-clamp-2" style={{ color: "var(--text-primary)" }}>
              {planGoal || "Henüz bir hedef belirlenmedi — yeni bir plan başlat."}
            </p>
          </div>

          {/* Büyük aksiyon kartları — katı/opak, temadan bağımsız kontrast */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={go(onNewPlan)}
              className="bento-card card-glow flex flex-col items-start justify-between gap-3 rounded-3xl p-5 text-left"
              style={{ background: accent, border: "1px solid rgba(255,255,255,0.25)" }}
            >
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(10,14,19,0.16)", color: "#0A0E13" }}>
                <Plus className="w-5 h-5" strokeWidth={2.75} />
              </span>
              <span className="text-[14.5px] font-black leading-tight" style={{ color: "#0A0E13" }}>
                Plan Ekle
              </span>
            </button>
            <button
              onClick={go(onDeletePlan)}
              disabled={!savedPlansCount}
              className="bento-card card-glow flex flex-col items-start justify-between gap-3 rounded-3xl p-5 text-left text-white disabled:opacity-40 disabled:pointer-events-none"
              style={{ background: "linear-gradient(135deg, #FB7185 0%, #E11D48 100%)", border: "1px solid rgba(255,255,255,0.2)" }}
            >
              <span className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/20">
                <Trash2 className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <span className="text-[14.5px] font-black leading-tight">Planları Yönet</span>
            </button>
          </div>

          {/* Bento grid — kare gezinme kartları (korundu, bkz. dosya başı notu) */}
          <div className="grid grid-cols-2 gap-2">
            {bentoTiles.map((t) => (
              <BentoTile key={t.key} icon={t.icon} label={t.label} gradient={t.gradient} glow={t.glow} onClick={go(t.onClick)} />
            ))}
          </div>

          {/* Planlarım — birden fazla kayıtlı plan arasında GEÇİŞ (DeletePlanModal
              yalnızca SİLME içindir, ikisi farklı ihtiyaç). */}
          {user && savedPlansCount > 0 && (
            <BentoStrip
              icon={<FolderOpen className="w-4 h-4" strokeWidth={2.5} />}
              iconGradient="from-slate-400 to-slate-600"
              iconGlow="shadow-slate-500/30"
              label="Planlarım"
              onClick={go(onOpenPlans)}
            />
          )}

          {/* Nexus Profil — doğrudan kendi Nexus profiline açılır */}
          {user && (
            <BentoStrip
              icon={<User className="w-4 h-4" strokeWidth={2.5} />}
              iconGradient="from-sky-400 to-indigo-600"
              iconGlow="shadow-indigo-500/30"
              label="Nexus Profilim"
              trailing={
                <span className="text-[10.5px] font-semibold shrink-0 truncate max-w-[70px]" style={{ color: "var(--text-muted)", fontFamily: MONO_FONT }}>
                  {savedPlansCount} plan
                </span>
              }
              onClick={go(onOpenProfile)}
            />
          )}
        </div>
      </div>
    </>
  );
}
export default memo(DrawerMenu);
