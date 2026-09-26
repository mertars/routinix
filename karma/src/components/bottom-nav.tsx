"use client";

import { motion } from "framer-motion";
import { CalendarDays, Settings, Shuffle, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/oyuncular", label: "Oyuncular", icon: Users },
  { href: "/kadro", label: "Kadro Kur", icon: Shuffle },
  { href: "/maclar", label: "Maçlar", icon: CalendarDays },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/paylas")) return null;
  return (
    <nav
      aria-label="Ana menü"
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-white/8 pb-[var(--safe-bottom)]"
    >
      <ul className="mx-auto grid h-[var(--nav-height)] max-w-xl grid-cols-4 px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold tracking-wide transition-colors ${
                  active ? "text-neon" : "text-ink-muted hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-x-3 top-1.5 h-9 rounded-full bg-neon/12"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className="relative size-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                <span className="relative">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
