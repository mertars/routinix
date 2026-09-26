import { POSITION_COLORS, POSITION_LABELS } from "@/lib/constants";
import type { Avatar, Position } from "@/lib/types";

export function PlayerAvatar({ avatar, size = 40, className = "", ring }: { avatar: Avatar; size?: number; className?: string; ring?: string }) {
  const style = { width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined };
  if (avatar.type === "photo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar.dataUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={style}
        draggable={false}
      />
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-white/8 leading-none ${className}`}
      style={{ ...style, fontSize: size * 0.56 }}
      aria-hidden="true"
    >
      {avatar.value}
    </span>
  );
}

export function PositionBadge({ position, size = "md", variant = "solid", title }: { position: Position | "YDK"; size?: "sm" | "md"; variant?: "solid" | "outline"; title?: string }) {
  const color = position === "YDK" ? "#6b7f74" : POSITION_COLORS[position];
  const label = position === "YDK" ? "Yedek" : POSITION_LABELS[position];
  return (
    <span
      title={title ?? label}
      className={`inline-flex items-center justify-center rounded-md border font-display font-bold uppercase tracking-wide text-ink ${
        size === "sm" ? "h-5 min-w-8 px-1 text-[11px]" : "h-6 min-w-10 px-1.5 text-[13px]"
      }`}
      style={{
        background: variant === "solid" ? `${color}33` : "transparent",
        borderColor: `${color}${variant === "solid" ? "88" : "cc"}`,
      }}
    >
      <span className="sr-only">{label} </span>
      <span aria-hidden="true">{position}</span>
    </span>
  );
}

export function RatingPill({ value, className = "" }: { value: number; className?: string }) {
  const tone =
    value >= 85 ? "bg-neon text-on-neon" : value >= 75 ? "bg-[#e9c55a] text-[#211703]" : value >= 65 ? "bg-[#c9d3da] text-[#111a21]" : "bg-[#c98a55] text-[#1f1107]";
  return (
    <span className={`inline-grid h-7 min-w-9 place-items-center rounded-lg px-1.5 font-display text-lg font-extrabold tabular ${tone} ${className}`}>
      {value}
    </span>
  );
}
