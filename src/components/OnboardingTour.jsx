import { useState, useRef } from "react";
import { X, Check } from "lucide-react";
import { ONBOARDING_STORAGE_KEY } from "../constants";
import logger from "../utils/logger";
import {
  SyncDemo,
  CommandCenterDemo,
  TaskModulesDemo,
  PlanBoardDemo,
  PdfDemo,
  StudioOrchestrationDemo,
  OverviewDemo,
  PomodoroDemo,
  NexusDemo,
  ShareDemo,
} from "./onboarding/microDemos";

// İlk kez gelen kullanıcıya gösterilen 10 adımlı, %100 canlı-kodlanmış
// (SIFIR PNG/JPG) mikro-UI vitrini. localStorage'da BİR KEZ görüldü
// işaretlenir, sonrasında yalnızca Header'daki ❓ Rehber butonuyla manuel
// açılır (bkz. app.jsx). Anahtar constants.js'te YAŞAR — app.jsx'in "ilk
// ziyaret mi?" kontrolü ile buradaki "gördü" yazma işlemi ASLA birbirinden
// farklı bir string'e sapamaz.
function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch (err) {
    // Gizli/özel tarama modu ya da quota dolu olabilir — routineCheckin.js'teki
    // AYNI dürüstlük ilkesi: bu SESSİZCE yutulur, tur bir daha kapanamaz hale
    // gelmez, yalnızca "bir daha gösterme" tercihi kalıcı olmayabilir.
    logger.warn("ONBOARDING", "localStorage'a yazılamadı", { error: err?.message });
  }
}

// Her adımın accent'i BİLEREK uygulamanın KENDİ, zaten var olan renk
// kimliğinden seçildi (Header.jsx'teki nav çipi renkleriyle AYNI) — turun
// kendi rastgele paleti YOK, uygulamanın gerçek görsel dilini konuşuyor.
// Adım 2/3'ün mikro demoları KENDİ İÇİNDE gerçek kategori renklerini
// (constants.js CATEGORIES) kullanır, buradaki accent yalnızca çerçeve/
// sekme/başlık rengidir.
const STEPS = [
  {
    key: "sync",
    badge: "1 / 10 · Giriş & Senkronizasyon",
    title: "Gücünü Hesabınla Birleştir",
    description: "Sağ üstteki \"Giriş Yap\" ile profilini oluştur; tüm planların, rutinlerin ve ilerlemen her cihazında anında eşleşsin.",
    accent: "#00C2D6",
    Demo: SyncDemo,
    subSteps: null,
  },
  {
    key: "command-center",
    badge: "2 / 10 · Komuta Merkezi",
    title: "4 Uzman Kadrosu, Tek Cümlelik Hedef",
    description: "Seni anlayan 4 uzman persona eşliğinde hedefini yaz, sana özel plan anında hazırlansın. Dilersen ortadaki dairesel tuşla kendi planını tamamen elle de kurabilirsin.",
    accent: "#B26BFF",
    Demo: CommandCenterDemo,
    subSteps: [
      { key: "categories", label: "4 Uzman" },
      { key: "goal", label: "Tek Cümleyle Başla" },
      { key: "questions", label: "Yönlendirme" },
      { key: "manual", label: "Manuel Plan" },
    ],
  },
  {
    key: "task-modules",
    badge: "3 / 10 · Modüler Görev Kartları",
    title: "Her Alan Kendi Diline Göre Konuşur",
    description: "Aynı görev kartı, seçtiğin uzmana göre kendi rengine ve alanlarına bürünür — yazılımda pomodoro/süre, fitness'ta öncelik, seyahatte bütçe/konum, öğrenmede hedef metrik.",
    accent: "#6E7BFF",
    Demo: TaskModulesDemo,
    subSteps: [
      { key: "software", label: "🧑‍💻 Yazılım" },
      { key: "fitness", label: "💪 Fitness" },
      { key: "vacation", label: "🌴 Seyahat" },
      { key: "general", label: "🎓 Öğrenme" },
    ],
  },
  {
    key: "plan-board",
    badge: "4 / 10 · Plan Panosu & İnce Ayar",
    title: "Planın Üzerinde %100 Hakimiyet",
    description: "Günler ve haftalar arasında anında geçiş yap, görev başlıklarını yerinde düzenle, tikle ve günün rutin kartını takip et.",
    accent: "#8B5CF6",
    Demo: PlanBoardDemo,
    subSteps: [
      { key: "pills", label: "Gün/Hafta Geçişi" },
      { key: "edit", label: "Tane Tane Düzenle" },
      { key: "check", label: "Tikle & Rutin" },
    ],
  },
  {
    key: "pdf",
    badge: "5 / 10 · PDF Çıktı Motoru",
    title: "Planların Sanat Eseri Gibi Elinde",
    description: "Tek tıkla, çevrimdışı da okunabilecek şık, matbaa kalitesinde bir PDF çıktısı al.",
    accent: "#F0B37E",
    Demo: PdfDemo,
    subSteps: null,
  },
  {
    key: "studio",
    badge: "6 / 10 · Studio Builder",
    title: "Dosyalarını Planına, Planını Takvimine Bağla",
    description: ".ics ile Google/Apple Takvim'e aktar, JSON/PDF ile yedekle ya da dışarıdan dosya yükle. Görev paketlerini kopyala, istediğin güne yapıştır; her görevin süre/bütçe/konum gibi alanlarını istediğin gibi aç-kapa.",
    accent: "#00C2FF",
    Demo: StudioOrchestrationDemo,
    subSteps: [
      { key: "io", label: "İçe/Dışa Aktar" },
      { key: "clipboard", label: "Kopyala-Yapıştır" },
      { key: "params", label: "Parametre Ekle" },
    ],
  },
  {
    key: "overview",
    badge: "7 / 10 · Panoramik Kontrol Paneli",
    title: "Odağını Asla Kaybetme",
    description: "Rutinlerini, aktif görevlerini ve tüm planlarını tek bir panelden, ilerleme çubuklarıyla takip et.",
    accent: "#8FA0FF",
    Demo: OverviewDemo,
    subSteps: null,
  },
  {
    key: "pomodoro",
    badge: "8 / 10 · Pomodoro & Derin Odak",
    title: "Müziğini Bağla, Odağa Geç",
    description: "Süreni ayarla, görevini seç; Spotify ya da YouTube Music ile çalış. Odak Modu'nda gereksiz kontroller gözden kaybolsun, geriye yalnızca sayaç kalsın.",
    accent: "#FB7185",
    Demo: PomodoroDemo,
    subSteps: [
      { key: "timer", label: "Süre & Görev" },
      { key: "music", label: "Müzik" },
      { key: "focus", label: "Odak Modu" },
    ],
  },
  {
    key: "nexus",
    badge: "9 / 10 · Nexus Sosyal Ekosistem",
    title: "Toplulukla Keşfet, Haftanı Kutla",
    description: "Topluluğun şablonlarını incele, beğen, kendi planlarına ekle. Haftalık gelişimini Instagram Wrapped tarzı bir hikaye kartıyla paylaş.",
    accent: "#22D3EE",
    Demo: NexusDemo,
    subSteps: [
      { key: "explore", label: "Keşfet & Beğen" },
      { key: "filter", label: "Filtrele & Ara" },
      { key: "wrapped", label: "Haftalık Wrapped" },
    ],
  },
  {
    key: "share",
    badge: "10 / 10 · Canlı Paylaşım",
    title: "Hesap Açma Şartı Yok",
    description: "Planını canlı bir linkle paylaş; arkadaşların hiç hesap açmadan, misafir olarak anında görüntülesin.",
    accent: "#2ED9A3",
    Demo: ShareDemo,
    subSteps: null,
  },
];

// Mikro demo çerçevesi — TÜM adımlarda ortak, temaya duyarlı cam+glow kutusu.
// İçindeki gerçek demo bileşeni HİÇBİR görsel dosyası içermez, tamamen canlı
// React/Tailwind ile çizilir.
function DemoFrame({ accent, children }) {
  return (
    <div
      className="relative h-44 sm:h-48 rounded-2xl overflow-hidden flex items-center justify-center shrink-0"
      style={{ background: `linear-gradient(135deg, ${accent}1c, ${accent}08)`, border: `1px solid ${accent}30` }}
    >
      <div className="absolute -inset-6 opacity-50 pointer-events-none" style={{ background: `radial-gradient(60% 60% at 50% 32%, ${accent}30, transparent 70%)`, filter: "blur(24px)" }} />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

export default function OnboardingTour({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [activeSub, setActiveSub] = useState(() => STEPS[0].subSteps?.[0]?.key ?? null);
  const touchStartXRef = useRef(null);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Demo = current.Demo;

  const finish = () => {
    markOnboardingSeen();
    onClose();
  };

  const goToStep = (i) => {
    if (i === step) return;
    setDirection(i > step ? 1 : -1);
    setStep(i);
    setActiveSub(STEPS[i].subSteps?.[0]?.key ?? null);
  };
  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    goToStep(Math.min(STEPS.length - 1, step + 1));
  };
  const goPrev = () => {
    if (step === 0) return;
    goToStep(Math.max(0, step - 1));
  };

  // Kaydırma (swipe) desteği — sol'a kaydır: ileri, sağ'a kaydır: geri.
  const SWIPE_THRESHOLD = 40;
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartXRef.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (delta < -SWIPE_THRESHOLD) goNext();
    else if (delta > SWIPE_THRESHOLD) goPrev();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 sm:px-6" onClick={finish}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[500px] rounded-3xl overflow-hidden animate-[popIn_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: `0 30px 70px -20px rgba(0,0,0,0.6), 0 0 40px -14px ${current.accent}55`,
        }}
      >
        <div className="h-[2px] transition-colors duration-500" style={{ background: `linear-gradient(90deg, transparent, ${current.accent}, transparent)` }} />

        <button
          onClick={finish}
          aria-label="Kapat"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          style={{ background: "rgba(var(--overlay-rgb),0.08)" }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* key ile hem adım hem alt-adım değişince YENİDEN MOUNT edilir —
              tour-step-in CSS animasyonu (yay-fizikli, cubic-bezier(0.34,
              1.56,0.64,1)) bu sayede her geçişte baştan oynar, ekstra JS
              animasyon state'i gerekmeden. --tour-dir yönü taşır. */}
          <div key={`${step}-${activeSub}`} className="tour-step-in" style={{ "--tour-dir": direction }}>
            <DemoFrame accent={current.accent}>
              <Demo accent={current.accent} sub={activeSub} />
            </DemoFrame>

            {current.subSteps && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                {current.subSteps.map((s) => {
                  const active = activeSub === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveSub(s.key)}
                      className="rounded-full px-2.5 py-1.5 text-[10.5px] font-bold transition-all duration-300"
                      style={active ? { background: `${current.accent}22`, color: current.accent, boxShadow: `0 0 10px -3px ${current.accent}` } : { background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-faint)" }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4">
              <span className="inline-block text-[10.5px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full" style={{ background: `${current.accent}1A`, color: current.accent }}>
                {current.badge}
              </span>
              <h2 className="mt-2.5 text-[16.5px] sm:text-[17px] font-bold text-[var(--text-primary)] leading-snug text-balance">{current.title}</h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{current.description}</p>
            </div>
          </div>

          {/* Alt navigasyon — Sol: Turu Atla · Orta: adım noktaları (tıklanabilir) · Sağ: İlerle/Keşfet */}
          <div className="mt-5 flex items-center justify-between gap-3">
            {!isLast ? (
              <button onClick={finish} className="shrink-0 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                Turu Atla
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-1 flex-wrap justify-center" role="tablist" aria-label="Tur adımları">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={i === step}
                  aria-label={`${i + 1}. adıma git`}
                  onClick={() => goToStep(i)}
                  className="h-[7px] rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? 22 : 7,
                    background: i === step ? current.accent : "rgba(var(--overlay-rgb),0.18)",
                    boxShadow: i === step ? `0 0 8px -2px ${current.accent}` : "none",
                  }}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 h-10 text-[13px] font-bold text-white transition-transform active:scale-95"
              style={{ background: current.accent, boxShadow: `0 8px 22px -8px ${current.accent}AA` }}
            >
              {isLast ? (
                <>
                  Routinix'i Keşfet <Check className="w-4 h-4" strokeWidth={2.5} />
                </>
              ) : (
                "İlerle"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
