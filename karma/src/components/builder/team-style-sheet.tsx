"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { TEAM_COLORS } from "@/lib/constants";
import type { TeamStyle } from "@/lib/types";
import { Button } from "../ui/button";
import { Sheet } from "../ui/sheet";

interface TeamStyleSheetProps {
  open: boolean;
  onClose: () => void;
  styles: [TeamStyle, TeamStyle];
  team: 0 | 1;
  onSave: (styles: [TeamStyle, TeamStyle]) => void;
}

/** Takım adı ve rengi düzenleme. */
export function TeamStyleSheet({ open, onClose, styles, team, onSave }: TeamStyleSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Takımı düzenle">
      {open && <Body styles={styles} team={team} onSave={onSave} onClose={onClose} />}
    </Sheet>
  );
}

function Body({ styles, team, onSave, onClose }: Omit<TeamStyleSheetProps, "open">) {
  const [name, setName] = useState(styles[team].name);
  const [color, setColor] = useState(styles[team].color);
  const otherColor = styles[team === 0 ? 1 : 0].color;
  const save = () => {
    const next: [TeamStyle, TeamStyle] = [{ ...styles[0] }, { ...styles[1] }];
    next[team] = { name: name.trim() || styles[team].name, color };
    onSave(next);
    onClose();
  };
  return (
    <div className="flex flex-col gap-5 pb-[var(--safe-bottom)]">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Takım adı</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          className="h-12 w-full rounded-2xl border border-white/10 bg-pitch-800 px-4 text-[16px] outline-none focus:border-neon"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </label>
      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Renk</span>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Takım rengi">
          {TEAM_COLORS.map((c) => {
            const taken = c.value === otherColor;
            const active = c.value === color;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={taken}
                onClick={() => setColor(c.value)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border text-[11px] font-semibold disabled:opacity-30 ${
                  active ? "border-neon bg-neon/10 text-ink" : "border-white/10 bg-pitch-800 text-ink-muted"
                }`}
              >
                <span className="grid size-6 place-items-center rounded-full border border-white/20" style={{ background: c.value }}>
                  {active && <Check className="size-4" style={{ color: c.value === "#1f2a24" ? "#fff" : "#07120c" }} aria-hidden="true" />}
                </span>
                {c.label}
                {taken && <span className="sr-only"> (diğer takımda)</span>}
              </button>
            );
          })}
        </div>
      </div>
      <Button variant="primary" size="lg" onClick={save}>
        Kaydet
      </Button>
    </div>
  );
}
