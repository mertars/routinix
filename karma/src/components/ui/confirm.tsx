"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Sheet } from "./sheet";

interface ConfirmProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmSheet({ open, title, description, confirmLabel = "Onayla", destructive, onConfirm, onClose, children }: ConfirmProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {description && <p className="text-[15px] leading-relaxed text-ink-soft">{description}</p>}
      {children}
      <div className="mt-6 grid grid-cols-2 gap-3 pb-[var(--safe-bottom)]">
        <Button onClick={onClose} size="lg">
          Vazgeç
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          size="lg"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
