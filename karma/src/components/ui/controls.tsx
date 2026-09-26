"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useId, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Segmented control (tek seçimli)
// ---------------------------------------------------------------------------

interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; ariaLabel?: string }[];
  label: string;
  size?: "md" | "sm";
  className?: string;
}

export function Segmented<T extends string | number>({ value, onChange, options, label, size = "md", className = "" }: SegmentedProps<T>) {
  const layoutId = useId();
  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-2xl bg-pitch-800 p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`relative flex flex-1 items-center justify-center rounded-xl px-2 font-semibold transition-colors ${
              size === "sm" ? "min-h-10 text-sm" : "min-h-11 text-[15px]"
            } ${active ? "text-on-neon" : "text-ink-muted hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-neon"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anahtar (switch)
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function Toggle({ checked, onChange, label, description, className = "" }: ToggleProps) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={description ? `${id}-d` : undefined}
      onClick={() => onChange(!checked)}
      className={`flex min-h-12 w-full items-center gap-3 text-left ${className}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {description && (
          <span id={`${id}-d`} className="mt-0.5 block text-[13px] leading-snug text-ink-muted">
            {description}
          </span>
        )}
      </span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-neon" : "bg-pitch-600"
        }`}
        aria-hidden="true"
      >
        <motion.span
          className="absolute size-5 rounded-full bg-white shadow"
          animate={{ x: checked ? 24 : 4 }}
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
        />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Özellik kaydırıcısı: slider + sayı girişi
// ---------------------------------------------------------------------------

interface AttributeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hint?: ReactNode;
  emphasis?: boolean;
  color?: string;
}

export function attrColor(v: number): string {
  if (v >= 85) return "#3ef08a";
  if (v >= 75) return "#a6f04a";
  if (v >= 65) return "#ffd23f";
  if (v >= 50) return "#ff9f43";
  return "#ff5d6c";
}

export function AttributeSlider({ label, value, onChange, min = 1, max = 99, hint, emphasis, color }: AttributeSliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const track = color ?? attrColor(value);
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v))));
  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className={`min-w-0 flex-1 truncate ${emphasis ? "text-[15px] font-semibold text-ink" : "text-sm text-ink-soft"}`}>
          {label}
          {hint && <span className="ml-1.5 text-xs text-ink-faint">{hint}</span>}
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`${label} azalt`}
            onClick={() => set(value - 1)}
            className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5 active:bg-white/10"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={value}
            aria-label={`${label} değeri`}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(n)) set(n);
            }}
            onFocus={(e) => e.target.select()}
            className="tabular h-10 w-12 rounded-lg border border-white/10 bg-pitch-800 text-center font-display text-xl font-bold text-ink outline-none focus:border-neon"
            style={{ color: track }}
          />
          <button
            type="button"
            aria-label={`${label} artır`}
            onClick={() => set(value + 1)}
            className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-white/5 active:bg-white/10"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="karma-range -mt-1 block"
        style={{ ["--fill" as string]: `${pct}%`, ["--track" as string]: track }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Basit sayaç (skor girişi vb.)
// ---------------------------------------------------------------------------

export function Stepper({ value, onChange, label, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} azalt`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid size-11 place-items-center rounded-xl bg-pitch-700 text-ink active:scale-95"
      >
        <Minus className="size-5" />
      </button>
      <output className="tabular w-12 text-center font-display text-4xl font-extrabold" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        aria-label={`${label} artır`}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid size-11 place-items-center rounded-xl bg-pitch-700 text-ink active:scale-95"
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bölüm kartı
// ---------------------------------------------------------------------------

export function Section({ title, subtitle, action, children, className = "" }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`surface rounded-3xl p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {title && <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({ active, onClick, children, ariaLabel, color }: { active?: boolean; onClick?: () => void; children: ReactNode; ariaLabel?: string; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
        active ? "border-transparent bg-neon text-on-neon" : "border-white/10 bg-pitch-800 text-ink-soft hover:border-white/20"
      }`}
      style={active && color ? { background: color } : undefined}
    >
      {children}
    </button>
  );
}
