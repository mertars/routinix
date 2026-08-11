// Routinix marka amblemi — yuvarlatılmış kare rozet içinde "R" monogramı,
// kenarlarında SÜREKLİ dönen tek bir neon ışık huzmesi (conic-gradient
// "kuyruklu yıldız" deseni + Tailwind'in `animate-spin` keyframe'i).
// Uygulamanın zaten kurulu neon üçlüsünü (#FF007F pembe → #B026FF mor →
// #00F3FF cyan — "Kendi Planını Hazırla" değnek butonuyla AYNI gradient,
// bkz. CategoryIntro.jsx) kullanır; yeni bir renk paleti İCAT EDİLMEDİ,
// mevcut marka kimliği pekiştirildi.
//
// Teknik: dıştaki halka katmanı kendi boyutunun 2 katı (`inset:-50%`) bir
// conic-gradient'i döndürür; İÇTEKİ koyu yüz (borderWidth kadar içeri
// inset'li) bunun üstüne biner ve yalnızca ince bir kenar şeridini açıkta
// bırakır — ışık o şeritte "geçiyormuş" gibi görünür. `motion-safe:` ön eki
// `prefers-reduced-motion: reduce` kullanıcılarında animasyonu otomatik
// durdurur (Tailwind yerleşik davranışı, bkz. CategoryIntro.jsx'teki AYNI
// desen).
//
// `round`: uygulama İÇİNDE (Header.jsx) her zaman `false` — app'in genel
// "yuvarlatılmış kare" tasarım dili (kartlar/butonlar) ile tutarlı kalır.
// `true` YALNIZCA profil fotoğrafı export'ları için — sosyal medya
// platformları (X/Discord/TikTok vb.) avatarları daireye kırptığından,
// köşeleri kırpılınca çarpıklaşan kare yerine baştan tam daire üretilir.
export default function RoutinixLogo({ size = 36, animated = true, round = false, className = "" }) {
  const radius = round ? "50%" : `${size * 0.28}px`;
  const borderWidth = Math.max(1.5, size * 0.06);
  const innerRadius = round ? "50%" : `${Math.max(0, size * 0.28 - borderWidth)}px`;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: `${size}px`, height: `${size}px` }}>
      {/* Ambiyans parıltısı — statik screenshot/profil fotoğrafı olarak
          kullanıldığında bile rozetin "neon" hissi vermesi için. */}
      <div
        className="absolute inset-0"
        style={{ borderRadius: radius, boxShadow: "0 0 18px -4px rgba(255,0,127,0.45), 0 0 24px -6px rgba(0,243,255,0.4)" }}
      />

      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: radius }}>
        <div
          data-testid="logo-sweep"
          className={animated ? "absolute motion-safe:animate-spin" : "absolute"}
          style={{
            inset: "-50%",
            background:
              "conic-gradient(from 0deg, transparent 0deg, #FF007F 35deg, #B026FF 95deg, #00F3FF 155deg, transparent 205deg, transparent 360deg)",
            animationDuration: "3s",
          }}
        />
      </div>

      <div
        className="absolute flex items-center justify-center"
        style={{ inset: `${borderWidth}px`, borderRadius: innerRadius, background: "#0A0B0F" }}
      >
        <span
          className="font-black leading-none select-none"
          style={{
            fontSize: `${size * 0.5}px`,
            background: "linear-gradient(135deg, #FF6E92, #C99CFF 55%, #7DE8FF)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          R
        </span>
      </div>
    </div>
  );
}
