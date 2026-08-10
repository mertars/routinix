import { useState, useRef } from "react";
import { X, Check, ChevronLeft } from "lucide-react";
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
  HeaderMenuDemo,
} from "./onboarding/microDemos";
import SamplePdfModal from "./onboarding/SamplePdfModal";

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
    badge: "1 / 11 · Giriş & Senkronizasyon",
    title: "Gücünü Hesabınla Birleştir",
    description:
      "1. Sağ üstteki \"Giriş Yap\" butonuna tıkla ➔ 2. Email/şifreni gir ya da Google ile devam et ➔ 3. Artık tüm planların, rutinlerin ve ilerlemen otomatik olarak bulutta saklanır, her cihazında seni bekler.",
    accent: "#00C2D6",
    Demo: SyncDemo,
    subSteps: null,
  },
  {
    key: "command-center",
    badge: "2 / 11 · Komuta Merkezi",
    title: "4 Uzman Kadrosu, Tek Cümlelik Hedef",
    description:
      "1. Üstteki 4 karttan (Yazılım/Fitness/Seyahat/Öğrenme) sana uygun uzmanı seç ➔ 2. Alttaki kutuya hedefini tek cümleyle yaz ➔ 3. \"Başla\" butonuna bas, birkaç yönlendirme sorusunu cevapla ➔ 4. Sana özel plan otomatik kurulsun. Yapay zeka olmadan kendi planını kurmak istersen ortadaki mor-pembe dairesel tuşa bas.",
    accent: "#B26BFF",
    Demo: CommandCenterDemo,
    subSteps: [
      { key: "categories", label: "1. Uzmanı Seç" },
      { key: "goal", label: "2. Hedefini Yaz" },
      { key: "questions", label: "3. Soruları Cevapla" },
      { key: "manual", label: "Ya da: Manuel Plan" },
    ],
  },
  {
    key: "task-modules",
    badge: "3 / 11 · Modüler Görev Kartları",
    title: "Her Alan Kendi Diline Göre Konuşur",
    description:
      "Yukarıdaki 4 sekmeye tıkla, aynı görev kartının kategoriye göre nasıl şekil değiştirdiğini gör: yazılımda 🍅 pomodoro sayacı, fitness'ta öncelik rozeti, seyahatte 🏷️ bütçe ve 📍 konum, öğrenmede 🎯 hedef metrik alanı belirir.",
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
    badge: "4 / 11 · Plan Panosu & İnce Ayar",
    title: "Planın Üzerinde %100 Hakimiyet",
    description:
      "1. Üstteki gün/hafta sekmelerine tıkla, aralarında anında geçiş yap ➔ 2. \"Tane Tane Düzenle\" sekmesinde bir görev başlığına dokun, yerinde düzenle ➔ 3. \"Tikle & Rutin\" sekmesinde kare kutuya tıklayarak görevi tamamlanmış işaretle, altındaki rutin kartını takip et.",
    accent: "#8B5CF6",
    Demo: PlanBoardDemo,
    subSteps: [
      { key: "pills", label: "1. Gün/Hafta Geçişi" },
      { key: "edit", label: "2. Tane Tane Düzenle" },
      { key: "check", label: "3. Tikle & Rutin" },
    ],
  },
  {
    key: "pdf",
    badge: "5 / 11 · PDF Çıktı Motoru",
    title: "Planların Sanat Eseri Gibi Elinde",
    description:
      "1. \"PDF İndir\" butonuna bas ➔ 2. Planın matbaa kalitesinde, A4 formatında bir belgeye dönüşsün ➔ 3. Nasıl göründüğünü merak ediyorsan aşağıdaki \"Örnek Belgeyi Canlı Önizle\" bağlantısına tıkla — gerçek çıktının birebir aynısını burada görebilirsin.",
    accent: "#F0B37E",
    Demo: PdfDemo,
    subSteps: null,
  },
  {
    key: "studio",
    badge: "6 / 11 · Studio Builder",
    title: "Dosyalarını Planına, Planını Takvimine Bağla",
    description:
      "1. \"İçe/Dışa Aktar\" sekmesinde bir format seç (.ics/JSON/PDF/Yükle) — planını takvimine bağla ya da yedekle ➔ 2. \"Kopyala-Yapıştır\" sekmesinde bir günün görevlerini seçip başka bir güne anında çoğalt ➔ 3. \"Parametre Ekle\" sekmesinde her görevin süre/bütçe/konum gibi alanlarını istediğin gibi aç ya da kapat.",
    accent: "#00C2FF",
    Demo: StudioOrchestrationDemo,
    subSteps: [
      { key: "io", label: "1. İçe/Dışa Aktar" },
      { key: "clipboard", label: "2. Kopyala-Yapıştır" },
      { key: "params", label: "3. Parametre Ekle" },
    ],
  },
  {
    key: "overview",
    badge: "7 / 11 · Panoramik Kontrol Paneli",
    title: "Odağını Asla Kaybetme",
    description:
      "\"Görevler ve Planlar\" panelini açtığında rutinlerinin, aktif görevlerinin ve tüm planlarının ilerleme yüzdesini tek bakışta görürsün — hangi alanın geride kaldığını anında fark edersin.",
    accent: "#8FA0FF",
    Demo: OverviewDemo,
    subSteps: null,
  },
  {
    key: "pomodoro",
    badge: "8 / 11 · Pomodoro & Derin Odak",
    title: "Müziğini Bağla, Odağa Geç",
    description:
      "1. \"Süre & Görev\" sekmesinde çalışma süreni ayarla, bağlı görevi seç ➔ 2. Duraklat/Başlat'ın yanındaki Spotify tuşuyla müziğini başlat ➔ 3. \"Odak Modu\" sekmesine geç — gereksiz kontroller gözden kaybolsun, geriye yalnızca sayaç kalsın.",
    accent: "#FB7185",
    Demo: PomodoroDemo,
    subSteps: [
      { key: "timer", label: "1. Süre & Görev" },
      { key: "music", label: "2. Müzik" },
      { key: "focus", label: "3. Odak Modu" },
    ],
  },
  {
    key: "nexus",
    badge: "9 / 11 · Nexus Sosyal Ekosistem",
    title: "Toplulukla Keşfet, Haftanı Kutla",
    description:
      "1. \"Keşfet & Beğen\" sekmesinde topluluğun paylaştığı planları incele, kalp ikonuyla beğen ➔ 2. \"Filtrele & Ara\" ile aradığın kategoriye/kelimeye anında ulaş ➔ 3. \"Haftalık Wrapped\" sekmesinde bu haftaki tamamlama oranını Instagram Story formatında gör ve paylaş.",
    accent: "#22D3EE",
    Demo: NexusDemo,
    subSteps: [
      { key: "explore", label: "1. Keşfet & Beğen" },
      { key: "filter", label: "2. Filtrele & Ara" },
      { key: "wrapped", label: "3. Haftalık Wrapped" },
    ],
  },
  {
    key: "share",
    badge: "10 / 11 · Canlı Paylaşım",
    title: "Hesap Açma Şartı Yok",
    description:
      "1. Bir planı Nexus'ta şablon olarak paylaştığında sana özel bir link üretilir ➔ 2. \"Kopyala\" butonuna bas, linki arkadaşınla paylaş ➔ 3. Arkadaşın hiç hesap açmadan, misafir olarak planı anında görüntüleyebilir.",
    accent: "#2ED9A3",
    Demo: ShareDemo,
    subSteps: null,
  },
  {
    key: "guide-access",
    badge: "11 / 11 · Rehbere Her An Erişim",
    title: "❓ İstediğin Zaman Tekrar Aç!",
    description:
      "Sağ üst menüdeki ❓ (Rehber) ikonuna dilediğin zaman basarak bu öğretici ekranlara yeniden ulaşabilirsin. Hemen yanındaki 🎯 (Hızlı Öğretici) ikonu ise belirli bir özelliği seçmene ve doğrudan o arayüz elemanının üzerinde ok+açıklamayla gösterilmesine yarar.",
    accent: "#F0827A",
    Demo: HeaderMenuDemo,
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
  const [showPdfPreview, setShowPdfPreview] = useState(false);
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

        <div className="p-5 sm:p-6 max-h-[85vh] overflow-y-auto no-scrollbar" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* key ile hem adım hem alt-adım değişince YENİDEN MOUNT edilir —
              tour-step-in CSS animasyonu (yay-fizikli, cubic-bezier(0.34,
              1.56,0.64,1)) bu sayede her geçişte baştan oynar, ekstra JS
              animasyon state'i gerekmeden. --tour-dir yönü taşır. */}
          <div key={`${step}-${activeSub}`} className="tour-step-in" style={{ "--tour-dir": direction }}>
            <DemoFrame accent={current.accent}>
              <Demo accent={current.accent} sub={activeSub} onPreview={current.key === "pdf" ? () => setShowPdfPreview(true) : undefined} />
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

          {/* Alt navigasyon — Sol: Geri + Turu Atla · Orta: adım noktaları (tıklanabilir) · Sağ: İlerle/Keşfet */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 shrink-0">
              {step > 0 && (
                <button onClick={goPrev} className="flex items-center gap-1 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" /> Geri
                </button>
              )}
              {!isLast && (
                <button onClick={finish} className="text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  Turu Atla
                </button>
              )}
            </div>

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

      {/* 2. cam katman — Adım 5'teki "Örnek Belgeyi Canlı Önizle" ile açılır,
          "Kapat"a basınca tura kaldığı yerden (aynı step/activeSub state'i
          KORUNARAK — bu bileşen unmount OLMUYOR) devam eder. */}
      {showPdfPreview && <SamplePdfModal onClose={() => setShowPdfPreview(false)} />}
    </div>
  );
}
