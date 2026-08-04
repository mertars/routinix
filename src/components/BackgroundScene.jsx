import { memo, useState, useEffect } from "react";

// Kategoriye göre ambiyans ışığı rengi — plan/görev türüne özgü, kendi başına
// bir renk sistemi (uygulamanın diğer yerlerindeki kategori "accent" rozet
// renklerinden BİLİNÇLİ OLARAK bağımsız — buradaki istek belirli bir "doğa/
// enerji/odak/sakin" ruh hali eşlemesiydi, chip/badge renkleriyle karışmasın).
const GLOW_BY_CATEGORY = {
  vacation: { violet: "#2ED9A3", orange: "#22D3EE" }, // Doğa/Deniz — yeşil + cyan
  fitness: { violet: "#F4406B", orange: "#FB923C" }, // Enerjik — crimson + turuncu
  software: { violet: "#B26BFF", orange: "#6E7BFF" }, // Derin Odak — mor + indigo (varsayılan)
  general: { violet: "#7DA2FF", orange: "#64748B" }, // Sakin — soft mavi + slate
};
const DEFAULT_GLOW = GLOW_BY_CATEGORY.software;

// Atmosferik arka plan — iki temaya özgü katman + her iki temada da ortak
// süzülen glow blob'lar:
//   Koyu tema : çok soluk monokrom antrasit dağ/topoğrafik silüet + sırt
//               çizgileri üzerinde süzülen neon (beyaz/mor) ışık şeridi.
//   Açık tema : aynı topoğrafik kontur çizgilerinin sedef/gümüş, %8-12
//               opaklıktaki versiyonu (dağ dolgusu ve neon şerit koyu temaya
//               özgü olduğundan açık temada gizli kalır).
// Her iki temada: yavaşça süzülen bulanık glow blob'lar — rengi `category`
// prop'una göre değişir (bkz. GLOW_BY_CATEGORY), --glow-violet/--glow-orange
// CSS custom property'leri + @property (GlobalStyles.jsx) sayesinde 0.8s'lik
// yumuşak bir geçişle; plan seçilmemişse/tanınmayan kategoride varsayılan
// mor/indigo'ya döner. Tamamen dekoratif ve etkileşimsiz; sabit (fixed)
// olarak tüm ekranı kaplar, içeriğin arkasında durur.
// prefers-reduced-motion'da hareket durur (renk geçişi buna dahil değil,
// zararsız/statik bir stil değişimi sayılır).
// Tek prop'u `category` (primitif string) — memo, App'in kök state'inde
// alakasız her değişiklikte (ör. yazı yazma) bu ağır SVG'nin yeniden
// hesaplanmasını engeller; yalnızca kategori GERÇEKTEN değişince re-render olur.
function BackgroundScene({ category, suspended = false }) {
  const glow = GLOW_BY_CATEGORY[category] || DEFAULT_GLOW;

  // Sürekli koşan CSS animasyonlarını (ridge-sweep + bg-blob, GlobalStyles.jsx)
  // ÜÇ durumda DURDUR: (1) mobil genişlikte (<768px — küçük/orta segment
  // cihazlarda GPU/pil bütçesi daha kısıtlı), (2) sekme arka plana alındığında
  // (`visibilitychange`), (3) `suspended` prop'u true olduğunda — app.jsx
  // bunu, ÜZERİNDE tam ekran bir panel (Nexus/Pomodoro/Rhythm/TaskDrawer/...)
  // açık olduğunda true yapar. BU ÜÇÜNCÜ KOŞUL KRİTİK: BackgroundScene
  // `z-0`'da SABİT mount edilir ve panel açılınca UNMOUNT OLMAZ — panel onu
  // sadece görsel olarak ÖRTER, animasyonları (feGaussianBlur'lu SVG dash
  // kayması + blur(70px)'lu blob'lar) durdurmaz. Kullanıcı hiçbir zaman
  // GÖRMEDİĞİ bu animasyon, `suspended` eklenmeden önce panel açıkken bile
  // sonsuza dek GPU'yu meşgul etmeye devam ediyordu — ısınmanın asıl kaynağı
  // panelin KENDİ CSS'i değil, ARKADA hâlâ koşan bu katmandı.
  const [animPaused, setAnimPaused] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches || document.hidden;
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setAnimPaused(mq.matches || document.hidden);
    update();
    mq.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      mq.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const paused = animPaused || suspended;

  return (
    <div className={`fixed inset-0 z-0 pointer-events-none overflow-hidden ${paused ? "bg-anim-paused" : ""}`} aria-hidden="true">
      {/* --- Süzülen glow blob'lar — her iki temada, kategoriye duyarlı renk --- */}
      <div
        className="bg-blob bg-blob--violet"
        style={{ width: 520, height: 520, top: "-8%", left: "-10%", "--glow-violet": glow.violet }}
      />
      <div
        className="bg-blob bg-blob--orange"
        style={{ width: 480, height: 480, bottom: "-12%", right: "-8%", "--glow-orange": glow.orange }}
      />

      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dağ dolgusu — antrasit, aşağı doğru zemine karışır (yalnızca koyu tema) */}
          <linearGradient id="bgMountain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#161A22" />
            <stop offset="100%" stopColor="#030304" />
          </linearGradient>
          {/* Üstte hafif sisli mor perde (yalnızca koyu tema) */}
          <radialGradient id="bgHaze" cx="50%" cy="18%" r="70%">
            <stop offset="0%" stopColor="rgba(178,107,255,0.10)" />
            <stop offset="55%" stopColor="rgba(178,107,255,0.03)" />
            <stop offset="100%" stopColor="rgba(11,12,16,0)" />
          </radialGradient>
          {/* Neon ışıltı bulanıklığı */}
          <filter id="bgGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ================= KOYU TEMA KATMANI ================= */}
        <g style={{ opacity: "var(--scene-opacity)" }}>
          {/* Sisli mor perde */}
          <rect x="0" y="0" width="1440" height="800" fill="url(#bgHaze)" />

          {/* Dağ silüet katmanları (uzaktan yakına, opaklık artar) */}
          <path
            d="M0,470 L180,430 L320,485 L470,378 L620,452 L780,360 L940,442 L1100,392 L1260,462 L1440,408 L1440,800 L0,800 Z"
            fill="url(#bgMountain)"
            opacity="0.35"
          />
          <path
            d="M0,600 L150,558 L300,624 L460,520 L640,602 L820,508 L1000,592 L1180,540 L1440,600 L1440,800 L0,800 Z"
            fill="url(#bgMountain)"
            opacity="0.55"
          />
          <path
            d="M0,700 L200,658 L400,722 L600,648 L820,712 L1040,660 L1260,722 L1440,678 L1440,800 L0,800 Z"
            fill="url(#bgMountain)"
            opacity="0.8"
          />

          {/* Topoğrafik ince kontur çizgileri (çok soluk) */}
          <path
            d="M0,510 L180,472 L320,524 L470,420 L620,492 L780,402 L940,482 L1100,432 L1260,500 L1440,450"
            fill="none"
            stroke="#232935"
            strokeWidth="1"
            opacity="0.5"
          />
          <path
            d="M0,648 L150,608 L300,668 L460,566 L640,648 L820,556 L1000,636 L1180,586 L1440,646"
            fill="none"
            stroke="#232935"
            strokeWidth="1"
            opacity="0.45"
          />

          {/* Neon ışık şeritleri: sırt çizgileri boyunca süzülen dash */}
          <path
            className="ridge-sweep ridge-sweep--far"
            d="M0,470 L180,430 L320,485 L470,378 L620,452 L780,360 L940,442 L1100,392 L1260,462 L1440,408"
            fill="none"
            stroke="#B26BFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#bgGlow)"
          />
          <path
            className="ridge-sweep ridge-sweep--mid"
            d="M0,600 L150,558 L300,624 L460,520 L640,602 L820,508 L1000,592 L1180,540 L1440,600"
            fill="none"
            stroke="#EAF2FF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#bgGlow)"
          />
        </g>

        {/* ================= AÇIK TEMA KATMANI ================= */}
        {/* Sedef/gümüş topoğrafik kontur çizgileri — %8-12 opaklık (--topo-opacity) */}
        <g style={{ opacity: "var(--topo-opacity)" }}>
          <path
            d="M0,510 L180,472 L320,524 L470,420 L620,492 L780,402 L940,482 L1100,432 L1260,500 L1440,450"
            fill="none"
            stroke="#94A3A0"
            strokeWidth="1.2"
          />
          <path
            d="M0,600 L150,558 L300,624 L460,520 L640,602 L820,508 L1000,592 L1180,540 L1440,600"
            fill="none"
            stroke="#B7C0B4"
            strokeWidth="1.2"
          />
          <path
            d="M0,700 L200,658 L400,722 L600,648 L820,712 L1040,660 L1260,722 L1440,678"
            fill="none"
            stroke="#94A3A0"
            strokeWidth="1"
          />
        </g>
      </svg>

      <style>{`
        .ridge-sweep {
          stroke-dasharray: 130 1720;   /* kısa ışıklı segment + uzun boşluk */
          opacity: 0.55;
        }
        .ridge-sweep--far {
          stroke-dashoffset: 0;
          animation: ridgeSweep 11s linear infinite;
        }
        .ridge-sweep--mid {
          stroke-dashoffset: 0;
          animation: ridgeSweep 8.5s linear infinite;
          animation-delay: -3s;
          opacity: 0.45;
        }
        @keyframes ridgeSweep {
          to { stroke-dashoffset: -1850; }  /* dasharray toplamı ~ seamless loop */
        }
        @media (prefers-reduced-motion: reduce) {
          .ridge-sweep { animation: none !important; opacity: 0.28; stroke-dasharray: none; }
        }
        /* Mobilde veya sekme arka plandayken (bkz. yukarıdaki useEffect) —
           animasyonu tamamen KALDIRMAK yerine duraklatmak (play-state:paused)
           tercih edildi: sekme öne geldiğinde kaldığı kareden akıcıca devam
           eder, "none" ile sıfırlansaydı her seferinde başa sarardı. */
        .bg-anim-paused .ridge-sweep { animation-play-state: paused !important; }
      `}</style>
    </div>
  );
}
export default memo(BackgroundScene);
