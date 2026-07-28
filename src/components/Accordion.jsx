import { useState } from "react";

// Şık, yumuşak açılır/kapanır panel (grid-rows tekniği ile CSS geçişli).
// GlobalStyles'taki .accordion-body / .accordion-chevron sınıflarını kullanır.
export default function Accordion({ title, icon, accent, defaultOpen = false, children, right }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border overflow-hidden glass" style={{ borderColor: `${accent}33` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        {icon && (
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] shrink-0"
            style={{ background: `${accent}1f` }}
          >
            {icon}
          </span>
        )}
        <span className="flex-1 text-[13.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: accent }}>
          {title}
        </span>
        {right}
        <span className={`accordion-chevron text-[#8695A3] text-[12px] ${open ? "open" : ""}`}>▾</span>
      </button>
      <div className={`accordion-body ${open ? "open" : ""}`}>
        <div className="accordion-inner">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
