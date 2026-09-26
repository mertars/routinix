"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { useKarma } from "@/lib/store";
import { BottomNav } from "./bottom-nav";
import { LogoMark } from "./logo";
import { Toaster } from "./ui/toast";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useKarma((s) => s.hydrated);
  const hydrate = useKarma((s) => s.hydrate);
  const saveError = useKarma((s) => s.saveError);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto min-h-dvh w-full max-w-5xl">
        {hydrated ? children : null}
      </div>
      <BottomNav />
      <Toaster />
      {saveError && (
        <div role="alert" className="fixed inset-x-4 top-[calc(var(--safe-top)+12px)] z-[70] mx-auto max-w-md rounded-2xl border border-danger/40 bg-pitch-900 px-4 py-3 text-sm text-danger shadow-2xl">
          {saveError}
        </div>
      )}
      <AnimatePresence>
        {!hydrated && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[80] grid place-items-center bg-pitch-950"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            aria-label="Karma yükleniyor"
            role="status"
          >
            <div className="flex flex-col items-center gap-4">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}>
                <LogoMark size={72} />
              </motion.div>
              <span className="font-display text-3xl font-extrabold uppercase tracking-[0.2em]">
                Kar<span className="text-neon">ma</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
