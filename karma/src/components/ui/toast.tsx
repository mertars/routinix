"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { create } from "zustand";

type ToastKind = "success" | "info" | "error";
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }));
let counter = 0;

export function toast(message: string, kind: ToastKind = "success") {
  const id = ++counter;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, message, kind }] }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), 2600);
}

const ICONS = { success: CircleCheck, info: Info, error: TriangleAlert };
const COLORS = { success: "text-neon", info: "text-info", error: "text-danger" };

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+12px)] z-[60] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {items.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="glass flex max-w-sm items-center gap-2.5 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium shadow-2xl"
            >
              <Icon className={`size-5 shrink-0 ${COLORS[t.kind]}`} aria-hidden="true" />
              {t.message}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
