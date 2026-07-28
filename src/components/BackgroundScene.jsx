// Atmosferik arka plan: çok soluk, monokrom antrasit dağ/topoğrafik silüet
// katmanları + sırt çizgileri üzerinde yumuşakça süzülen neon (beyaz/mor) ışık
// şeridi. Tamamen dekoratif ve etkileşimsiz; sabit (fixed) olarak tüm ekranı
// kaplar ve içeriğin arkasında durur. prefers-reduced-motion'da hareket durur.
export default function BackgroundScene() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dağ dolgusu — antrasit, aşağı doğru zemine karışır */}
          <linearGradient id="bgMountain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#161A22" />
            <stop offset="100%" stopColor="#0b0c10" />
          </linearGradient>
          {/* Üstte hafif sisli mor perde */}
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

        {/* Sisli mor perde */}
        <rect x="0" y="0" width="1440" height="800" fill="url(#bgHaze)" />

        {/* --- Dağ silüet katmanları (uzaktan yakına, opaklık artar) --- */}
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

        {/* --- Topoğrafik ince kontur çizgileri (çok soluk) --- */}
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

        {/* --- Neon ışık şeritleri: sırt çizgileri boyunca süzülen dash --- */}
        {/* Uzak sırt: mor */}
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
        {/* Orta sırt: neon beyaz */}
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
      `}</style>
    </div>
  );
}
