"use client";

import { motion } from "framer-motion";
import { useState } from "react";

interface RadarDatum {
  key: string;
  label: string;
  value: number;
}

interface RadarChartProps {
  data: RadarDatum[];
  /** Grafiğin ne gösterdiği (erişilebilir ad). */
  title: string;
  size?: number;
  max?: number;
}

/**
 * Tek seriden oluşan örümcek ağı grafiği. Değerler köşelerde metin
 * renginde yazılır; seri rengi yalnızca işaretlerde kullanılır.
 */
export function RadarChart({ data, title, size = 280, max = 99 }: RadarChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 48;
  const n = data.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => {
    const r = (Math.max(0, Math.min(max, v)) / max) * radius;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };
  const ring = (f: number) =>
    data.map((_, i) => point(i, max * f)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const poly = data.map((d, i) => point(i, d.value)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <figure className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        style={{ maxWidth: size }}
        role="img"
        aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
      >
        {/* Izgara: saç teli kalınlığında, geri planda */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={ring(f)} fill="none" stroke="rgb(255 255 255 / 0.09)" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const [x, y] = point(i, max);
          return <line key={d.key} x1={cx} y1={cy} x2={x} y2={y} stroke="rgb(255 255 255 / 0.09)" strokeWidth={1} />;
        })}

        <motion.polygon
          points={poly}
          fill="rgb(62 240 138 / 0.14)"
          stroke="var(--color-neon)"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 20 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {data.map((d, i) => {
          const [x, y] = point(i, d.value);
          const [ox, oy] = point(i, max);
          const cos = Math.cos(angle(i));
          const sin = Math.sin(angle(i));
          const active = hover === d.key;
          // Etiket bloğu (ad + değer) her zaman köşenin dışında durur.
          let anchor: "start" | "middle" | "end" = "middle";
          let lx = ox;
          let labelY: number;
          let valueY: number;
          if (sin < -0.6) {
            labelY = oy - 30;
            valueY = oy - 11;
          } else if (sin > 0.6) {
            labelY = oy + 20;
            valueY = oy + 39;
          } else {
            anchor = cos > 0 ? "start" : "end";
            lx = ox + (cos > 0 ? 10 : -10);
            labelY = oy - 4;
            valueY = oy + 15;
          }
          return (
            <g key={d.key} onPointerEnter={() => setHover(d.key)} onPointerLeave={() => setHover(null)}>
              {/* Geniş vuruş alanı */}
              <circle cx={x} cy={y} r={16} fill="transparent" />
              <circle cx={x} cy={y} r={active ? 6 : 4.5} fill="var(--color-neon)" stroke="var(--color-pitch-850)" strokeWidth={2} />
              <text x={lx} y={labelY} textAnchor={anchor} className="fill-ink-muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}>
                {d.label}
              </text>
              <text
                x={lx}
                y={valueY}
                textAnchor={anchor}
                className="fill-ink"
                style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display)" }}
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}
