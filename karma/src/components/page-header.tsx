import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex items-end gap-3 px-4 pb-4 pt-[calc(var(--safe-top)+20px)]">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-neon">{eyebrow}</div>}
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-wide text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
