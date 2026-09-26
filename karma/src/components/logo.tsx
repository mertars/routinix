// Karma logosu: iki yarım daireden oluşan, dengeyi simgeleyen top.
// Tamamen özgün çizim.

import { useId } from "react";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6bffaa" />
          <stop offset="1" stopColor="#19b862" />
        </linearGradient>
      </defs>
      <path d="M30 6a26 26 0 0 0 0 52z" fill={`url(#${id})`} />
      <path d="M34 6a26 26 0 0 1 0 52z" fill="#e8f3ec" />
      <path d="M22 22l6 4-2 7h-7l-2-6z" fill="#03140a" opacity=".85" />
      <path d="M42 31l6-3 4 5-3 6-6-1z" fill="#03140a" opacity=".75" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={28} />
      <span className="font-display text-2xl font-extrabold uppercase tracking-wide">
        Kar<span className="text-neon">ma</span>
      </span>
    </span>
  );
}
