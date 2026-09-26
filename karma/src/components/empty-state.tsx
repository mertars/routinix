"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Boş durum illüstrasyonu: yukarıdan bakılan mini saha ve havada süzülen kartlar. */
function PitchIllustration() {
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-56" aria-hidden="true">
      <defs>
        <linearGradient id="es-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12472b" />
          <stop offset="1" stopColor="#0b2c1b" />
        </linearGradient>
      </defs>
      <g transform="translate(20 38) skewX(-12)">
        <rect width="200" height="100" rx="10" fill="url(#es-grass)" stroke="#3ef08a" strokeOpacity=".35" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 50} width="25" height="100" fill="#fff" opacity=".03" />
        ))}
        <line x1="100" y1="0" x2="100" y2="100" stroke="#e8f3ec" strokeOpacity=".4" />
        <circle cx="100" cy="50" r="16" fill="none" stroke="#e8f3ec" strokeOpacity=".4" />
        <rect x="0" y="30" width="18" height="40" fill="none" stroke="#e8f3ec" strokeOpacity=".4" />
        <rect x="182" y="30" width="18" height="40" fill="none" stroke="#e8f3ec" strokeOpacity=".4" />
      </g>
      <g className="animate-float">
        <rect x="52" y="6" width="34" height="46" rx="6" fill="#d9ab3c" />
        <rect x="58" y="12" width="12" height="8" rx="2" fill="#211703" opacity=".7" />
        <rect x="58" y="38" width="22" height="3" rx="1.5" fill="#211703" opacity=".5" />
      </g>
      <g className="animate-float" style={{ animationDelay: "-1.3s" }}>
        <rect x="154" y="2" width="34" height="46" rx="6" fill="#aeb9c2" />
        <rect x="160" y="8" width="12" height="8" rx="2" fill="#111a21" opacity=".7" />
        <rect x="160" y="34" width="22" height="3" rx="1.5" fill="#111a21" opacity=".5" />
      </g>
      <g className="animate-float" style={{ animationDelay: "-2.4s" }}>
        <circle cx="120" cy="30" r="11" fill="#e8f3ec" />
        <path d="M120 22l6 4-2 7h-8l-2-7z" fill="#050d09" opacity=".8" />
      </g>
    </svg>
  );
}

export function EmptyState({ title, description, children }: { title: string; description: ReactNode; children?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 flex flex-col items-center rounded-[32px] border border-dashed border-white/12 bg-white/[0.02] px-6 py-10 text-center"
    >
      <PitchIllustration />
      <h2 className="mt-4 font-display text-2xl font-bold uppercase tracking-wide">{title}</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">{description}</p>
      {children && <div className="mt-6 flex w-full max-w-xs flex-col gap-3">{children}</div>}
    </motion.div>
  );
}
