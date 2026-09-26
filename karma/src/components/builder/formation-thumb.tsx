import { POSITION_COLORS } from "@/lib/constants";
import type { Formation } from "@/lib/types";

/** Dizilişin küçük saha önizlemesi (kale altta). */
export function FormationThumb({ formation, className = "" }: { formation: Formation; className?: string }) {
  return (
    <svg viewBox="0 0 60 64" className={className} aria-hidden="true">
      <rect x="1" y="1" width="58" height="62" rx="5" fill="#0f3b24" stroke="rgb(232 243 236 / .25)" />
      <line x1="1" y1="1.5" x2="59" y2="1.5" stroke="rgb(232 243 236 / .35)" />
      <rect x="17" y="52" width="26" height="11" fill="none" stroke="rgb(232 243 236 / .25)" />
      {formation.slots.map((s) => (
        <circle key={s.id} cx={4 + (s.x / 100) * 52} cy={60 - (s.y / 100) * 54} r="3.6" fill={POSITION_COLORS[s.position]} stroke="#0f3b24" strokeWidth="1.2" />
      ))}
    </svg>
  );
}
