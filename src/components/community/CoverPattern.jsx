import { useState } from "react";
import { coverById } from "../../data/presetCovers";
import { stockCoverById, isStockCoverId } from "../../data/stockCovers";

// Şablon kapak görseli — GERÇEK fotoğraf. İki kaynak yan yana yaşar:
//   - "stock-*" id'ler → temalı LoremFlickr fotoğrafı (bkz. data/stockCovers.js
//     — Fitness/Beslenme/Minimalist/Aesthetic/Çalışma&Disiplin galerisi).
//   - "mono-*" id'ler (GERİYE DÖNÜK UYUMLULUK — halihazırda veritabanında
//     seed edilmiş eski şablonlar) → eski Picsum-seed fotoğrafı.
// Hangisi olursa olsun, ağ hatası/engelleme ihtimaline karşı `onError` ile
// SAF CSS bir zemine (stok kapağın kendi tema rengi ya da presetCovers.js'in
// mesh-gradient'i) güvenle düşülür — kırık görsel ikonu kullanıcıya ASLA
// görünmez. Yüklenene kadar hafif bir iskelet (`animate-pulse`, GPU'ya tek
// bir opacity animasyonundan fazlasına mal olmaz) gösterilir.
export default function CoverPattern({ coverId, className = "", style, children }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const stock = isStockCoverId(coverId) ? stockCoverById(coverId) : null;
  const photoUrl = stock ? stock.url : `https://picsum.photos/seed/${encodeURIComponent(coverId || "nexus")}/640/360`;
  const fallbackBg = stock ? stock.fallbackBg : coverById(coverId).style;

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: errored ? fallbackBg : "var(--bg-card)", ...style }}>
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
