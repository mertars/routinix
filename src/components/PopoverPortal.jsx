import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

// Bir tetikleyici elemanın (anchorRef) hemen altına konumlanan, document.body'ye
// PORTALLANMIŞ popover kabuğu (backdrop + konumlanmış içerik).
//
// NEDEN GEREKLİ (canlı tarayıcıda YAKALANAN gerçek bir hata): `position:
// fixed` bir backdrop + `position: absolute` bir popover'ı, DOM'da normal
// şekilde (portal olmadan) TaskCard'ın İÇİNDE render etmek görünüşte
// çalışıyor GİBİ görünür ama ÇALIŞMAZ — TaskCard'ın kök kapsayıcısı
// `.card-glow` sınıfı `contain: layout style` taşır (GlobalStyles.jsx,
// mobil FPS optimizasyonu için BİLEREK eklenmiş) ve bu, İÇİNDEKİ `absolute`
// popover'ı YEREL bir stacking context'e HAPSEDER; oysa `fixed` backdrop bu
// hapsi (tarayıcıya göre) ATLAYIP kök stacking context'te kalır ve z-index
// SIRASI TERSİNE döner — backdrop, z-index'i DAHA DÜŞÜK olsa bile popover'ın
// ÜSTÜNDE boyanır (elementFromPoint ile doğrulandı: popover içeriği DOM'da
// doğru stille var ama tıklama/paint backdrop'a gidiyor, popover görünmez VE
// tıklanamaz kalıyordu). document.body'ye PORTALLAMAK bu ata zincirinden
// tamamen kaçar, sorunu kökten çözer.
const VIEWPORT_MARGIN = 8;

export default function PopoverPortal({ anchorRef, open, onClose, children, className, style }) {
  const [pos, setPos] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    // İlk geçiş: yalnızca tetikleyicinin altına hizala — popover'ın kendi
    // GERÇEK genişliği/yüksekliği henüz bilinmiyor (aşağıdaki layout efekti
    // ölçüp gerekirse düzeltecek).
    setPos({ top: rect.bottom + 6, left: rect.left });
  }, [open, anchorRef]);

  // İkinci geçiş — canlı testte YAKALANAN gerçek bir hata: dar (mobil)
  // ekranlarda, tetikleyici sağ kenara yakınsa popover EKRANIN DIŞINA
  // taşıyordu (bkz. buton konumuna göre sabit `left: rect.left`). Popover
  // DOM'a girip GERÇEK boyutu ölçülebilir hale gelince, sağ/alt kenardan
  // taşma varsa konum kırpılır — Tailwind class'ları (w-[300px] vb.)
  // render'dan ÖNCE bilinmediği için bu iki-geçişli ölçüm gerekli.
  useLayoutEffect(() => {
    if (!pos || !contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    let { top, left } = pos;
    const maxLeft = window.innerWidth - rect.width - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - rect.height - VIEWPORT_MARGIN;
    if (left > maxLeft) left = Math.max(VIEWPORT_MARGIN, maxLeft);
    if (top > maxTop) top = Math.max(VIEWPORT_MARGIN, maxTop);
    if (left !== pos.left || top !== pos.top) setPos({ top, left });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos?.top, pos?.left]);

  if (!open || !pos) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200]" onClick={onClose} />
      <div ref={contentRef} className={className} style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 201, ...style }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </>,
    document.body
  );
}
