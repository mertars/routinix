"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "md" | "lg" | "icon" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-neon text-on-neon font-semibold shadow-glow hover:bg-neon-strong active:bg-neon-deep disabled:bg-pitch-600 disabled:text-ink-faint disabled:shadow-none",
  secondary: "bg-pitch-700 text-ink hover:bg-pitch-600 active:bg-pitch-750 border border-white/5",
  outline: "border border-neon/40 text-neon hover:bg-neon/10 active:bg-neon/15",
  ghost: "text-ink-soft hover:bg-white/5 active:bg-white/10",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-3 text-sm rounded-xl gap-1.5",
  md: "min-h-11 px-4 text-[15px] rounded-2xl gap-2",
  lg: "min-h-14 px-6 text-base rounded-2xl gap-2.5",
  icon: "size-11 rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex select-none items-center justify-center font-medium transition-[background,transform,color] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
});
