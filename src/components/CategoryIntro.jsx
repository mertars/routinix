import { useState, useEffect } from "react";
import { Wand2, ArrowRight, Activity, Timer, Compass, TrendingUp } from "lucide-react";
import { CATEGORIES, CATEGORY_KEYS, MIN_GOAL_LENGTH, TEMPLATE_CHIPS } from "../constants";
import { fetchReportHistory } from "../services/rhythmService";
import logger from "../utils/logger";

// "X gün önce" — basit, bağımlılıksız bir göreli zaman biçimlendirici.
function relativeDays(isoDate) {
  if (!isoDate) return "";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "bugün";
  if (days === 1) return "dün";
  return `${days} gün önce`;
}

// Son 7 daily_reports satırından basit bir tamamlama yüzdesi hesaplar —
// UYDURULMUŞ bir skor DEĞİL, gerçek stats.completedTasks/totalTasks
// toplamından türetilir (bkz. api/rhythm-report.js "generate" action'ı,
// bu tabloyu YALNIZCA o dolduruyor). Hiç veri yoksa null döner.
function computeWeeklyScore(reports) {
  let completed = 0;
  let total = 0;
  for (const r of reports || []) {
    completed += Number(r.stats?.completedTasks) || 0;
    total += Number(r.stats?.totalTasks) || 0;
  }
  if (total === 0) return null;
  return Math.round((completed / total) * 100);
}

// Giriş ekranı: kategori (persona) seçimi + hedef, "Planlarım" listesi ve
// yükleme/hata durumları. "Devam Et" ile dinamik onboarding sihirbazına geçilir.
// Masaüstünde (lg+) ana akışın yanında gerçek veriye dayalı bir yan panel
// (Aktif Plan Özeti / Haftalık Ritim Skoru / Hızlı Kısayollar) gösterilir —
// mobilde bu panel tamamen gizlenir (dikey alan zaten kısıtlı).
export default function CategoryIntro({
  stage,
  category,
  goal,
  goalTooShort,
  canStart,
  savedPlans,
  onCategoryChange,
  onGoalChange,
  onStart,
  onOpenSavedPlan,
  errorMsg,
  onBackToIntro,
  onOpenManualBuilder,
  userId,
  onOpenRhythm,
  onOpenPomodoro,
  onOpenHub,
}) {
  const mode = CATEGORIES[category] || CATEGORIES.general;
  const [pulse, setPulse] = useState(false);

  // Haftalık Ritim Skoru — yalnızca masaüstü yan panelde gösterilir ama
  // sorgu viewport'tan bağımsız (kullanıcı pencereyi büyütürse anında
  // hazır olsun diye) — tek, hafif bir sorgu (limit 7), yalnızca oturum
  // açık gerçek kullanıcılarda çalışır.
  const [weeklyScore, setWeeklyScore] = useState(undefined); // undefined = yükleniyor, null = veri yok
  useEffect(() => {
    if (!userId) {
      setWeeklyScore(null);
      return;
    }
    let cancelled = false;
    fetchReportHistory(userId, { limit: 7 })
      .then((reports) => !cancelled && setWeeklyScore(computeWeeklyScore(reports)))
      .catch((err) => {
        logger.error("CATEGORY_INTRO", "Haftalık ritim skoru getirilemedi", { error: err?.message });
        if (!cancelled) setWeeklyScore(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Şablon çipi: kategori + hedefi doldurur, kısa bir parıltı animasyonu tetikler.
  const applyTemplate = (chip) => {
    onCategoryChange(chip.category);
    onGoalChange(chip.goal);
    setPulse(false);
    requestAnimationFrame(() => setPulse(true));
    setTimeout(() => setPulse(false), 650);
  };

  if (stage === "loading") {
    return (
      <div className="flex flex-col items-center text-center gap-6 pt-24 animate-[fadeIn_0.3s_ease]">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 opacity-20" style={{ borderColor: mode.accent }} />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent motion-safe:animate-spin"
            style={{ borderTopColor: mode.accent, animationDuration: "0.9s" }}
          />
          <span className="text-2xl">{mode.emoji}</span>
        </div>
        <div>
          <h2 className="text-[16.5px] font-bold tracking-tight mb-1.5 text-[var(--text-primary)]">Routinix odağını yapılandırıyor...</h2>
          <p className="text-[12.5px] text-[var(--text-faint)]">Sana özel performans çerçeven hazırlanıyor, biraz sürebilir.</p>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex flex-col items-center text-center gap-5 pt-20 animate-[fadeIn_0.4s_ease]">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "rgba(240,150,80,0.12)" }}>
          🤔
        </div>
        <div>
          <h2 className="text-[19px] font-bold text-[var(--text-primary)] mb-2 text-balance">Bir şeyler ters gitti</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-[300px] leading-relaxed mx-auto">{errorMsg}</p>
        </div>
        <button
          onClick={onBackToIntro}
          className="mt-2 rounded-2xl px-6 py-3 text-[14.5px] font-semibold"
          style={{ background: mode.accent, color: "#0A0E13" }}
        >
          Geri Dön
        </button>
      </div>
    );
  }

  const latestPlan = savedPlans[0] || null; // fetchUserPlans created_at DESC sıralı geliyor.
  const latestPlanCat = latestPlan ? CATEGORIES[latestPlan.mode] || CATEGORIES.general : null;

  // stage === "intro" — mobilde tek ekrana kilitli (justify-between), md'den
  // serbest. lg+'da ana akış + gerçek-veri yan panel iki sütuna ayrılır;
  // bu satır boşluğu (max-w-7xl zaten app.jsx'te uygulanıyor) DOLDURUR.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] lg:gap-10 lg:items-start animate-[fadeIn_0.35s_ease]">
      <div className="flex flex-col h-full md:h-auto md:gap-8 min-w-0">
        {/* ÜST GRUP: kayıtlı planlar (kompakt strip) + hero başlık */}
        <div className="shrink-0 flex flex-col gap-4 md:gap-6">
          {savedPlans.length > 0 && (
            <div className="edge-fade-x -mx-4 md:-mx-6 px-4 md:px-6 flex gap-2 overflow-x-auto no-scrollbar lg:hidden">
              {savedPlans.map((p) => {
                const cat = CATEGORIES[p.mode] || CATEGORIES.general;
                return (
                  <button
                    key={p.id}
                    onClick={() => onOpenSavedPlan(p.id)}
                    className="glass shrink-0 flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 hover:border-slate-300 dark:hover:border-white/20 transition-colors card-glow"
                  >
                    <span className="text-[13px]">{cat.emoji}</span>
                    <span className="text-[11.5px] font-medium text-[var(--text-secondary)] max-w-[130px] truncate">{p.title || "Plan"}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <h1 className="text-2xl md:text-5xl font-bold leading-[1.12] tracking-tight text-balance">
              <span
                style={{
                  background: "var(--hero-gradient)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Hedefini tanımla, disiplinini yapılandıralım.
              </span>
            </h1>
            <p className="mt-2 md:mt-3 text-sm md:text-lg text-[var(--text-muted)] leading-relaxed md:max-w-2xl">
              Önce odak alanını seç, sonra hedefini net bir şekilde yaz.
            </p>
          </div>
        </div>

        {/* ORTA GRUP: 4'lü odak kartları — mobilde dikey alanı doldurur.
            `relative` sarmalayıcı, merkezdeki "Kendi Planını Hazırla" butonunu
            2x2 ızgaranın TAM kesişim noktasına (top-1/2 left-1/2 + translate)
            konumlandırmak için gerekli — 4 kartın da eşit boyutta/simetrik
            olduğu bu grid'de o nokta görsel olarak gerçekten "ortadır". */}
        <div className="flex-1 min-h-0 flex items-center md:flex-none md:block py-3 md:py-0">
          <div className="relative w-full grid grid-cols-2 gap-2.5 md:gap-5">
            {CATEGORY_KEYS.map((key) => {
              const c = CATEGORIES[key];
              const active = key === category;
              return (
                <button
                  key={key}
                  onClick={() => onCategoryChange(key)}
                  // İçerik hem dikey hem yatay TAM ORTALANMIŞ — ikon/başlık/alt
                  // açıklama kartın merkezinde. Aktif-durum noktası bu yüzden
                  // metinle çakışmayan bir köşede (sağ üst) kalabilir.
                  className="category-card group relative flex flex-col items-center justify-center gap-1.5 md:gap-3 rounded-2xl p-3.5 md:p-6 text-center transition-all duration-200 card-glow"
                  style={{
                    borderColor: active ? c.accent : undefined,
                    background: active ? `${c.accent}1f` : undefined,
                    boxShadow: active ? `0 0 0 2px ${c.accent}, 0 10px 40px -18px ${c.accent}` : undefined,
                  }}
                >
                  <span className="text-2xl md:text-3xl">{c.emoji}</span>
                  <span className="text-sm md:text-lg font-semibold leading-snug text-[var(--text-primary)]">{c.label}</span>
                  <span className="text-[11px] md:text-sm text-[var(--text-muted)] leading-snug line-clamp-2 md:line-clamp-none">
                    {c.tagline}
                  </span>
                  {active && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: c.accent, boxShadow: `0 0 8px ${c.accent}` }} />
                  )}
                </button>
              );
            })}

            {/* Merkez neon floating buton — "Kendi Planını Hazırla". Manuel
                plan akışı AI ÇAĞIRMAZ (Gemini maliyeti yok), bu yüzden 4
                AI-persona kartından BİLEREK görsel olarak ayrışan, kendine
                özel bir mor-magenta→camgöbeği gradyanı taşır (mevcut AI Koç
                tetikleyicisiyle AYNI "gradyan + dış parıltı" dili, ama farklı
                renk kimliği — "bu AI persona'larından biri DEĞİL" sinyali). */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="group/manual relative flex items-center justify-center">
                <button
                  onClick={onOpenManualBuilder}
                  aria-label="Kendi Planını Hazırla"
                  className="relative w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #FF007F, #B026FF 55%, #00F3FF)",
                    boxShadow: "0 8px 28px -8px rgba(255,0,127,0.65), 0 0 22px -6px rgba(0,243,255,0.55)",
                  }}
                >
                  {/* Hover'da neon pulse halkası — AiCoachWidget tetikleyicisindeki
                      "canlı durum noktası" ping deseniyle AYNI teknik. */}
                  <span className="absolute inset-0 rounded-full motion-safe:group-hover/manual:animate-ping opacity-0 group-hover/manual:opacity-60" style={{ background: "#FF007F" }} />
                  <Wand2 className="relative w-4 h-4 md:w-5 md:h-5 text-white drop-shadow-sm" strokeWidth={2.25} />
                </button>

                {/* Tooltip/label — yalnızca hover'da (masaüstü), AI Koç
                    tetikleyicisiyle AYNI opacity/translate geçiş deseni. */}
                <div
                  className="absolute top-full mt-2 pointer-events-none opacity-0 translate-y-1 group-hover/manual:opacity-100 group-hover/manual:translate-y-0 transition-all duration-200 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold hidden md:block"
                  style={{
                    background: "rgba(var(--glass-rgb), var(--alpha-modal))",
                    backdropFilter: "blur(16px) saturate(160%)",
                    WebkitBackdropFilter: "blur(16px) saturate(160%)",
                    border: "1px solid var(--modal-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  ✨ Kendi Planını Hazırla
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ALT GRUP: şablon çipleri + hedef giriş çubuğu + Başla */}
        <div className="shrink-0 pt-2 md:pt-0">
          {/* Akıllı şablon çipleri — yatay kaydırılabilir */}
          <div className="edge-fade-x -mx-4 md:-mx-6 px-4 md:px-6 mb-2.5 flex gap-2 overflow-x-auto no-scrollbar">
            {TEMPLATE_CHIPS.map((chip) => {
              const c = CATEGORIES[chip.category] || CATEGORIES.general;
              return (
                <button
                  key={chip.label}
                  onClick={() => applyTemplate(chip)}
                  className="glass shrink-0 flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors card-glow"
                  style={{ borderColor: `${c.accent}33` }}
                >
                  <span className="text-[12px]">{chip.emoji}</span>
                  {chip.label}
                </button>
              );
            })}
          </div>

          <label className="block text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-[var(--text-faint)] mb-1.5 md:mb-2">
            Hedefin
          </label>
          <div
            className={`input-glow glass flex items-center gap-2 rounded-2xl p-2 md:p-2.5 ${pulse ? "chip-fill-pulse" : ""}`}
            style={{ borderColor: goalTooShort ? "var(--amber-accent)" : "rgba(var(--overlay-rgb),0.10)" }}
          >
            <input
              type="text"
              value={goal}
              onChange={(e) => onGoalChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canStart && onStart()}
              placeholder="Örn: 3 ayda full-stack geliştirici ol..."
              className="flex-1 min-w-0 bg-transparent outline-none text-sm md:text-base text-[var(--text-primary)] placeholder:text-[var(--placeholder)] px-2.5"
            />
            <button
              onClick={onStart}
              disabled={!canStart}
              className="shrink-0 rounded-xl px-5 md:px-7 py-2.5 md:py-3 text-sm md:text-base font-semibold transition-all duration-200 disabled:opacity-40"
              style={{ background: canStart ? mode.accent : "var(--disabled-bg)", color: canStart ? "#0b0c10" : "var(--text-faint)" }}
            >
              Başla
            </button>
          </div>
          {goalTooShort && (
            <p className="mt-1.5 text-[11px] font-medium" style={{ color: "var(--amber-accent)" }}>
              Hedefini biraz daha açık yaz — en az {MIN_GOAL_LENGTH} karakter gerekli.
            </p>
          )}
        </div>
      </div>

      {/* YAN PANEL — yalnızca lg+ (masaüstü). Mobilde dikey alan zaten
          kısıtlı ve bu widget'lar "Hedefini tanımla" akışının birincil
          amacına ikincil olduğundan tamamen gizlenir, DOM'a hiç eklenmez
          (yalnızca CSS ile gizlemek yerine — gereksiz sorgu/render yok). */}
      <div className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-8">
        {/* Aktif Plan Özeti — gerçek veri: en son oluşturulan/güncellenen
            kayıtlı plan (fetchUserPlans zaten created_at DESC döner).
            Uydurma bir "ilerleme" yüzdesi GÖSTERİLMEZ — bu ekranın
            savedPlans'ı yalnızca plans.* taşır, görev tamamlama verisi
            içermez; burada YALNIZCA gerçekten bilinen alanlar gösterilir. */}
        <div className="glass rounded-2xl p-4 card-glow">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)] mb-3">Aktif Plan Özeti</p>
          {latestPlan ? (
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{latestPlanCat.emoji}</span>
                <span className="text-[13.5px] font-bold text-[var(--text-primary)] truncate">{latestPlan.title || "Plan"}</span>
              </div>
              <p className="text-[11.5px] text-[var(--text-muted)] mb-3">
                {latestPlanCat.label} · {latestPlan.total_days ? `${latestPlan.total_days} gün` : "süre belirsiz"} · {relativeDays(latestPlan.created_at)}
              </p>
              <button
                onClick={() => onOpenSavedPlan(latestPlan.id)}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12.5px] font-semibold transition-colors"
                style={{ background: latestPlanCat.accentSoft, color: latestPlanCat.accent }}
              >
                Devam Et <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <p className="text-[12px] text-[var(--text-faint)] leading-relaxed">Henüz kayıtlı bir planın yok — ilk planını aşağıdan başlat.</p>
          )}
        </div>

        {/* Haftalık Ritim Skoru — son 7 daily_reports'un GERÇEK
            completedTasks/totalTasks toplamından. Veri yoksa (yeni
            kullanıcı, ya da Ritim modülü hiç kullanılmamış) dürüst bir
            boş-durum gösterilir — sıfır ya da rastgele bir sayı UYDURULMAZ. */}
        <div className="glass rounded-2xl p-4 card-glow">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">Haftalık Ritim Skoru</p>
          </div>
          {weeklyScore === undefined ? (
            <div className="h-10 rounded-lg animate-pulse" style={{ background: "var(--disabled-bg)" }} />
          ) : weeklyScore === null ? (
            <p className="text-[12px] text-[var(--text-faint)] leading-relaxed">
              Son 7 günde veri yok — "Günü Tamamla" ile ritim raporun burada belirmeye başlar.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-1.5 mb-2">
                <span className="text-[28px] font-bold leading-none" style={{ color: mode.accent, fontFamily: "ui-monospace, monospace" }}>
                  %{weeklyScore}
                </span>
                <span className="text-[11px] text-[var(--text-faint)] mb-0.5">son 7 gün</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--disabled-bg)" }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${weeklyScore}%`, background: mode.accent }} />
              </div>
            </>
          )}
        </div>

        {/* Hızlı Kısayollar — mevcut, çalışan uygulama bölümlerine gerçek
            navigasyon (app.jsx'teki toggleRhythm/togglePomodoro/toggleHub) —
            dekoratif değil. */}
        <div className="glass rounded-2xl p-2 card-glow">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)] px-2 pt-2 pb-2.5">Hızlı Kısayollar</p>
          <div className="flex flex-col gap-0.5">
            {[
              { icon: Activity, label: "Ritim & İçgörüler", onClick: onOpenRhythm },
              { icon: Timer, label: "Pomodoro", onClick: onOpenPomodoro },
              { icon: Compass, label: "Şablon Keşfet", onClick: onOpenHub },
            ].map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={!onClick}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(var(--overlay-rgb),0.05)] transition-colors disabled:opacity-40"
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
