import { useState, useRef } from "react";
import { X, Sparkles, LayoutGrid, ClipboardPaste, CalendarClock, Check } from "lucide-react";
import { ONBOARDING_STORAGE_KEY } from "../constants";
import logger from "../utils/logger";

// İlk kez gelen kullanıcıya gösterilen tanıtım turu — localStorage'da BİR KEZ
// görüldü işaretlenir, sonrasında yalnızca Header'daki ❓ Rehber butonuyla
// manuel açılır (bkz. app.jsx). Anahtar constants.js'te YAŞAR (bkz. o
// dosyadaki yorum) — app.jsx'in "ilk ziyaret mi?" kontrolü ile buradaki
// "gördü" yazma işlemi ASLA birbirinden farklı bir string'e sapamaz.
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

const ACCENT = "#10B981"; // emerald-500 — turun kendine özel, 4 kategori
// persona renginden BİLEREK bağımsız kimliği (ManualPlanBuilder'ın kendi
// violet/cyan kimliğiyle AYNI ilke).

const STEPS = [
  {
    key: "planning",
    badge: "1. Adım",
    title: "Akıllı Planlama Motoru",
    description: "Hedefini yaz, birkaç soruya cevap ver — yapay zeka senin için günlere ve rutinlere bölünmüş, kişiselleştirilmiş bir plan kursun.",
    icon: Sparkles,
  },
  {
    key: "studio",
    badge: "2. Adım",
    title: "Studio Builder & Düzenleme",
    description: "AI'lı ya da tamamen elle kurduğun her planı aynı stüdyoda aç; günlerini, görevlerini ve bütçeni istediğin gibi düzenle.",
    icon: LayoutGrid,
  },
  {
    key: "clipboard",
    badge: "3. Adım",
    title: "Çoklu Pano & Rutin Yönetimi",
    description: "Görevleri seç, panoya kopyala, istediğin güne yapıştır. Rutinlerini de \"Her Gün\" / \"Hafta İçi\" sıklığıyla ayrı kartlarda yönet.",
    icon: ClipboardPaste,
  },
  {
    key: "sync",
    badge: "4. Adım",
    title: "Takvim & Dosya Senkronizasyonu",
    description: "Planını .ics ile Google/Apple Takvim'e aktar, şık bir PDF olarak indir ya da Markdown/JSON/CSV ile içe-dışa aktar.",
    icon: CalendarClock,
  },
];

// Her adımın üst görsel alanı — GERÇEK bir ekran görüntüsü/mockup YERİNE
// (elimizde böyle bir statik görsel yok, sahte bir tane üretmek yerine
// dürüst bir alternatif tercih edildi) uygulamanın KENDİ cam+neon dilini
// konuşan, temaya duyarlı, sıfır ek görsel ağırlığı olan bir simge paneli.
function StepVisual({ Icon }) {
  return (
    <div
      className="relative h-40 sm:h-44 rounded-2xl overflow-hidden flex items-center justify-center shrink-0"
      style={{ background: `linear-gradient(135deg, ${ACCENT}22, ${ACCENT}08)`, border: `1px solid ${ACCENT}30` }}
    >
      <div className="absolute -inset-6 opacity-60" style={{ background: `radial-gradient(60% 60% at 50% 40%, ${ACCENT}33, transparent 70%)`, filter: "blur(22px)" }} />
      <div
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: `${ACCENT}1F`, border: `1px solid ${ACCENT}55`, boxShadow: `0 0 26px -6px ${ACCENT}88` }}
      >
        <Icon className="w-7 h-7" style={{ color: ACCENT }} strokeWidth={2.25} />
      </div>
    </div>
  );
}

export default function OnboardingTour({ open, onClose }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchStartXRef = useRef(null);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = () => {
    markOnboardingSeen();
    onClose();
  };
  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setDirection(1);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const goPrev = () => {
    if (step === 0) return;
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  };
  const goToStep = (i) => {
    if (i === step) return;
    setDirection(i > step ? 1 : -1);
    setStep(i);
  };

  // Kaydırma (swipe) desteği — sol'a kaydır: ileri, sağ'a kaydır: geri.
  // Rubber-band fizik GEREKMEZ (BottomSheet'teki gibi kapatma jesti değil,
  // basit adım geçişi) — eşik tabanlı, sade bir dedektör yeterli.
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
        className="relative w-full max-w-[440px] rounded-3xl overflow-hidden animate-[popIn_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: `0 30px 70px -20px rgba(0,0,0,0.6), 0 0 40px -14px ${ACCENT}55`,
        }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />

        <button
          onClick={finish}
          aria-label="Kapat"
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          style={{ background: "rgba(var(--overlay-rgb),0.08)" }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* key={step} kasıtlı: React bu alt ağacı adım değişince YENİDEN
              MOUNT eder, bu da aşağıdaki tour-step-in CSS animasyonunun her
              adımda baştan oynamasını sağlar (ekstra JS animasyon state'i
              gerekmeden) — --tour-dir, yönü (ileri/geri) taşır. */}
          <div key={step} className="tour-step-in" style={{ "--tour-dir": direction }}>
            <StepVisual Icon={current.icon} />

            <div className="mt-4">
              <span
                className="inline-block text-[10.5px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
                style={{ background: `${ACCENT}1A`, color: ACCENT }}
              >
                {current.badge}
              </span>
              <h2 className="mt-2.5 text-[17px] font-bold text-[var(--text-primary)] leading-snug text-balance">{current.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{current.description}</p>
            </div>
          </div>

          {/* Alt navigasyon — Sol: Turu Atla · Orta: sayfa noktaları (tıklanabilir) · Sağ: İlerle/Keşfet */}
          <div className="mt-6 flex items-center justify-between gap-3">
            {!isLast ? (
              <button onClick={finish} className="text-[12.5px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                Turu Atla
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-1.5" role="tablist" aria-label="Tur adımları">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={i === step}
                  aria-label={`${i + 1}. adıma git`}
                  onClick={() => goToStep(i)}
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? 32 : 8,
                    background: i === step ? ACCENT : "rgba(var(--overlay-rgb),0.18)",
                    boxShadow: i === step ? `0 0 10px -2px ${ACCENT}` : "none",
                  }}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              className="flex items-center gap-1.5 rounded-xl px-4 h-10 text-[13px] font-bold text-white transition-transform active:scale-95"
              style={{ background: ACCENT, boxShadow: `0 8px 22px -8px ${ACCENT}AA` }}
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
