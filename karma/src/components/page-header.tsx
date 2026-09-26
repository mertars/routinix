import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { EMBEDDED_IN_ROUTINIX } from "@/lib/base-path";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex items-end gap-3 px-4 pb-4 pt-[calc(var(--safe-top)+20px)]">
      <div className="min-w-0 flex-1">
        {(eyebrow || EMBEDDED_IN_ROUTINIX) && (
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-neon">
            {EMBEDDED_IN_ROUTINIX && (
              // Routinix içinden açıldığında geri dönüş yolu (iOS ana ekran uygulamasında geri tuşu yok).
              <a
                href="/"
                className="-my-2 -ml-1 inline-flex min-h-11 items-center gap-1 rounded-full px-1 normal-case tracking-normal text-ink-muted hover:text-ink"
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> Routinix
                <span className="ml-1 text-ink-faint" aria-hidden="true">
                  ·
                </span>
              </a>
            )}
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-none tracking-wide text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
