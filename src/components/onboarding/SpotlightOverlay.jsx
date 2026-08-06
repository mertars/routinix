import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Gerçek bir DOM elemanının (data-tour-id="{targetId}" taşıyan) etrafına
// karartılmış bir "spot" (kesik) + ok + açıklama balonu yerleştiren
// yeniden kullanılabilir motor. React Portal ile document.body'ye
// taşınır — Header.jsx'in KENDİSİ `backdrop-blur` taşıyan bir sticky
// kapsayıcı (bu, `position:fixed` torunlar için YENİ bir containing block
// oluşturur, bkz. CSS filter/backdrop-filter spesifikasyonu) — portal
// OLMADAN bu overlay Header'ın kutusuna hapsolur, gerçek viewport'a göre
// DEĞİL o kutuya göre "fixed" konumlanırdı (ManualPlanBuilder'ın PDF
// önizlemesinde ÇÖZÜLEN AYNI sınıf hata).
//
// Hedef DOM'da yoksa (ör. mobilde gizli bir masaüstü-only nav düğmesi,
// ya da kullanıcı henüz o ekrana gitmemiş) SESSİZCE BOŞ EKRAN göstermek
// yerine dürüst bir "bu özellik şu an görünmüyor" mesajı gösterir.
export default function SpotlightOverlay({ targetId, title, description, accent, onDone, notFoundMessage }) {
  const [rect, setRect] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const findRect = () => {
      const el = document.querySelector(`[data-tour-id="${targetId}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // width/height === 0 → display:none (ör. mobilde `hidden md:flex` bir
      // masaüstü navbar düğmesi) — element DOM'da var ama GÖRÜNMÜYOR, aynı
      // şekilde "bulunamadı" sayılır.
      if (r.width === 0 || r.height === 0) return null;
      return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom };
    };

    // Hedef ekrana YENİ bir navigasyonla geliyor olabilir (ör. "AI Uzmanları"
    // önce ana sayfaya döner, kart animasyonu biter) — İLK denemede
    // bulunamazsa HEMEN "bulunamadı" göstermek yerine birkaç kez, kısa
    // aralıklarla sessizce dener; yalnızca SON deneme de başarısız olursa
    // dürüst hata mesajına düşer. Bu, "önce kısa bir hata parlaması, sonra
    // doğru içerik" gibi rahatsız edici bir yanıp-sönmeyi önler.
    const RETRY_DELAYS = [0, 150, 300, 450, 700];
    let attempt = 0;
    const tryFind = () => {
      if (cancelled) return;
      const r = findRect();
      if (r) {
        setNotFound(false);
        setRect(r);
        return;
      }
      attempt += 1;
      if (attempt >= RETRY_DELAYS.length) {
        setNotFound(true);
        return;
      }
      retryTimer = setTimeout(tryFind, RETRY_DELAYS[attempt]);
    };
    tryFind();

    // Bulunduktan SONRA konum değişirse (resize/scroll) çerçeveyi anlık takip et.
    const remeasure = () => {
      const r = findRect();
      if (r) setRect(r);
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [targetId]);

  if (notFound) {
    return createPortal(
      <div className="fixed inset-0 z-[170] flex items-center justify-center px-6 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onDone}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-w-[320px] rounded-2xl p-5 text-center"
          style={{ background: "rgba(var(--glass-rgb),var(--alpha-modal))", border: "1px solid var(--modal-border)" }}
        >
          <p className="text-[13px] font-semibold mb-4 leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {notFoundMessage || "Bu özellik şu an ekranında görünmüyor."}
          </p>
          <button onClick={onDone} className="rounded-xl px-4 py-2 text-[12.5px] font-bold text-white" style={{ background: accent }}>
            Tamam
          </button>
        </div>
      </div>,
      document.body
    );
  }

  if (!rect) return null; // ölçülüyor, henüz gösterme (yanlışlıkla tüm ekranı karartmasın)

  const pad = 8;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const holeStyle = {
    position: "fixed",
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: 14,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.8)",
    border: `2px solid ${accent}`,
    outline: `2px solid ${accent}55`,
    outlineOffset: 3,
    pointerEvents: "none",
    zIndex: 171,
    transition: "top 0.35s cubic-bezier(0.34,1.56,0.64,1), left 0.35s cubic-bezier(0.34,1.56,0.64,1), width 0.35s ease, height 0.35s ease",
  };

  const TOOLTIP_W = 280;
  const placeAbove = viewportH - (rect.bottom + pad) < 170 && rect.top > 170;
  const tooltipTop = placeAbove ? rect.top - pad - 12 : rect.bottom + pad + 12;
  const tooltipLeft = clamp(rect.left, 16, viewportW - TOOLTIP_W - 16);
  const arrowLeft = clamp(rect.left + rect.width / 2 - tooltipLeft, 20, TOOLTIP_W - 20);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[169]" onClick={onDone} aria-hidden="true" />
      <div style={holeStyle} aria-hidden="true" />
      <div
        role="tooltip"
        className="fixed animate-[fadeIn_0.25s_ease]"
        style={{
          zIndex: 172,
          width: TOOLTIP_W,
          top: placeAbove ? undefined : tooltipTop,
          bottom: placeAbove ? viewportH - tooltipTop : undefined,
          left: tooltipLeft,
        }}
      >
        <div
          className="relative rounded-2xl p-4"
          style={{
            background: "rgba(var(--glass-rgb), var(--alpha-modal))",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: `1px solid ${accent}55`,
            boxShadow: `0 20px 50px -16px rgba(0,0,0,0.6), 0 0 24px -8px ${accent}`,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: arrowLeft - 7,
              [placeAbove ? "bottom" : "top"]: -7,
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              ...(placeAbove ? { borderTop: `7px solid ${accent}` } : { borderBottom: `7px solid ${accent}` }),
            }}
          />
          <h3 className="text-[13px] font-bold mb-1.5" style={{ color: accent }}>
            {title}
          </h3>
          <p className="text-[12px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
          <button onClick={onDone} className="w-full rounded-lg py-2 text-[12px] font-bold text-white transition-transform active:scale-95" style={{ background: accent }}>
            Anladım
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
