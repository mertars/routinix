"use client";

import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Başlığın yanında sağda gösterilecek aksiyonlar. */
  actions?: ReactNode;
  /** Altta sabit duran alan (ana aksiyon butonları için). */
  footer?: ReactNode;
  children: ReactNode;
  /** Tam ekran (mobilde) sayfa gibi açılır. */
  full?: boolean;
  label?: string;
}

/** Alttan açılan, sürükleyerek kapatılabilen erişilebilir panel. */
export function Sheet({ open, onClose, title, actions, footer, children, full, label }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const t = setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <motion.div
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : label}
            tabIndex={-1}
            className={`relative flex w-full flex-col overflow-hidden rounded-t-[28px] border border-white/8 bg-pitch-900 shadow-2xl outline-none md:max-w-lg md:rounded-[28px] ${
              full ? "h-[96dvh] md:h-[88dvh]" : "max-h-[92dvh]"
            }`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 active:cursor-grabbing"
              onPointerDown={(e) => drag.start(e)}
            >
              <div className="h-1.5 w-11 rounded-full bg-white/20" aria-hidden="true" />
            </div>
            {(title || actions) && (
              <div
                className="flex shrink-0 touch-none items-center gap-2 px-5 pb-3 pt-2"
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest("button,input,a")) return;
                  drag.start(e);
                }}
              >
                <h2 id={titleId} className="min-w-0 flex-1 truncate font-display text-2xl font-bold uppercase tracking-wide">
                  {title}
                </h2>
                {actions}
                <button
                  type="button"
                  onClick={onClose}
                  className="grid size-11 place-items-center rounded-full text-ink-muted hover:bg-white/5 hover:text-ink"
                  aria-label="Kapat"
                >
                  <X className="size-5" />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-white/6 bg-pitch-900/95 px-5 pb-[calc(12px+var(--safe-bottom))] pt-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
