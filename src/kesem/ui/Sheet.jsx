import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Alt sayfa (bottom sheet). Telefonda ekranın altından yükselir; tablette
// ortalanmış kart. Özellikler:
//  • Geri tuşu (Android/PWA kaydırma jesti) en üstteki sayfayı kapatır —
//    history'ye bir giriş eklenir, kapanınca geri alınır.
//  • Tutamaç/başlık bölgesinden aşağı sürükleyerek kapatma.
//  • Esc ile kapatma, odak sayfaya alınır.
// İç içe sayfalarda (ör. ekleme sayfasının üstünde kategori düzenleyici) geri
// tuşu SADECE en üstteki sayfayı kapatmalı → tek, paylaşılan popstate dinleyici.
const sheetStack = [];
let sheetSeq = 0;
const pops = { ignore: 0, bound: false };
function ensurePopListener() {
  if (pops.bound) return;
  pops.bound = true;
  window.addEventListener("popstate", () => {
    if (pops.ignore > 0) {
      pops.ignore--;
      return;
    }
    const top = sheetStack[sheetStack.length - 1];
    if (top) {
      top.popped = true;
      top.close();
    }
  });
}

export default function Sheet({ open, onClose, title, children, footer, tall = false, size = "md", labelledBy }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = { id: ++sheetSeq, close: () => closeRef.current?.(), popped: false };
    sheetStack.push(token);
    ensurePopListener();
    window.history.pushState({ kesemSheet: token.id, depth: window.history.state?.depth ?? 0 }, "");
    const prevFocus = document.activeElement;
    const onKey = (e) => {
      if (sheetStack[sheetStack.length - 1] !== token) return;
      if (e.key === "Escape") return closeRef.current?.();
      if (e.key !== "Tab" || !ref.current) return;
      // odak tuzağı: Tab sayfanın içinde döner
      const f = [...ref.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    // Klavye: görsel görünüm alanına göre katman yüksekliği (iOS'ta klavye alanı örtmesin) + odaktaki alanı göster
    const vv = window.visualViewport;
    const rootEl = document.querySelector(".kesem-root");
    const applyVV = () => {
      if (!vv || !rootEl) return;
      rootEl.style.setProperty("--k-vvh", `${vv.height}px`);
      rootEl.style.setProperty("--k-vvt", `${vv.offsetTop}px`);
    };
    const onFocusIn = (e) => {
      const el = e.target;
      if (ref.current?.contains(el) && /^(INPUT|TEXTAREA)$/.test(el.tagName)) setTimeout(() => el.scrollIntoView?.({ block: "center", behavior: "smooth" }), 320);
    };
    applyVV();
    vv?.addEventListener("resize", applyVV);
    vv?.addEventListener("scroll", applyVV);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onKey);
    ref.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      vv?.removeEventListener("resize", applyVV);
      vv?.removeEventListener("scroll", applyVV);
      const i = sheetStack.indexOf(token);
      if (i >= 0) sheetStack.splice(i, 1);
      if (!sheetStack.length && rootEl) { rootEl.style.removeProperty("--k-vvh"); rootEl.style.removeProperty("--k-vvt"); }
      // odağı sayfayı açan öğeye geri ver
      if (prevFocus && document.contains(prevFocus) && prevFocus.focus) setTimeout(() => prevFocus.focus({ preventScroll: true }), 0);
      // Kendi eklediğimiz geçmiş girişini sessizce geri al (geri tuşuyla
      // kapandıysa zaten geri gidilmiştir).
      // Ertelenir + yalnızca giriş hâlâ BİZİMSE geri alınır (React StrictMode'un
      // dev'deki çift efekt çalıştırması geçmişi bozmasın).
      if (!token.popped) {
        setTimeout(() => {
          if (window.history.state?.kesemSheet === token.id) {
            pops.ignore++;
            window.history.back();
          }
        }, 0);
      }
    };
  }, [open]);

  // Aşağı sürükle-kapat
  const drag = useRef(null);
  const onDown = useCallback((e) => {
    if (e.target.closest("button, input, textarea, a")) return;
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);
  const onMove = useCallback((e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    if (ref.current) ref.current.style.transform = `translateY(${dy}px)`;
  }, []);
  const onUp = useCallback(() => {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (ref.current) ref.current.style.transform = "";
    if (dy > 110) closeRef.current?.();
  }, []);

  if (!open) return null;
  // Portal: iç içe sayfalar (ör. filtre içindeki tutar tuş takımı) bir üst sayfanın kırpma/kapsama
  // bağlamına girmesin; hep modül kökünün üstüne çizilir (React ağacı ve olaylar aynı kalır).
  const host = document.querySelector(".kesem-root") || document.body;
  return createPortal(
    <div className="k-sheet-layer">
      <div className="k-scrim" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-labelledby={labelledBy}
        className={`k-sheet k-sheet-${size} ${tall ? "k-sheet-tall" : ""}`}
      >
        <div className="k-sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="k-grabber" />
          <div className="k-sheet-title-row">
            <h2 className="k-sheet-title">{title}</h2>
            <button type="button" className="k-icon-btn" onClick={onClose} aria-label="Kapat">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="k-sheet-body">{children}</div>
        {footer}
      </div>
    </div>,
    host
  );
}
