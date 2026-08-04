import { useState } from "react";
import { coverById } from "../../data/presetCovers";

// Şablon kapak görseli — GERÇEK fotoğraf (Picsum Photos, `coverId`ye göre
// DETERMİNİSTİK bir "seed" — aynı şablon HER ZAMAN aynı fotoğrafı gösterir,
// sayfa yenilense de). Unsplash'ten elle bir foto ID'si seçmek yerine Picsum
// kullanılır: Picsum'un seed-URL'leri TASARIM GEREĞİ asla 404 vermez (rastgele
// seçilmiş bir foto ID'sinin GERÇEKTEN var olduğunu doğrulayamama sorunu
// tamamen ortadan kalkar). Yine de ağ hatası/engelleme ihtimaline karşı
// `onError` ile presetCovers.js'teki SAF CSS mesh-gradient'e güvenle düşülür
// — kırık görsel ikonu kullanıcıya ASLA görünmez. Yüklenene kadar hafif bir
// iskelet (`animate-pulse`, GPU'ya tek bir opacity animasyonundan fazlasına
// mal olmaz) gösterilir.
export default function CoverPattern({ coverId, className = "", style, children }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const photoUrl = `https://picsum.photos/seed/${encodeURIComponent(coverId || "nexus")}/640/360`;
  const fallback = coverById(coverId);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: errored ? fallback.style : "var(--bg-card)", ...style }}>
      {!errored && (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {!errored && !loaded && <div className="absolute inset-0 animate-pulse bg-white/5" />}
      {children}
    </div>
  );
}
