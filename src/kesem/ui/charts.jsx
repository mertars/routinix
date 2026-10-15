import { useId, useMemo, useRef, useState } from "react";
import { Amt } from "./Amt";
import { formatMoney, formatMoneyText } from "../model/money";

// Hafif, kendi SVG grafikleri (kütüphane yok). Renkler yalnızca tema jetonlarından (CSS değişkeni).

// ---- Halka (kategori dağılımı) ----
// slices: [{ id, label, value, color(anahtar | "accent"), share }]
export function Donut({ slices, total, size = 156, stroke = 20, selected, onSelect, centerLabel = "Toplam" }) {
  const r = (size - stroke - 8) / 2; // seçili dilim kalınlaşınca (stroke+5) taşmasın
  const c = 2 * Math.PI * r;
  const GAP = slices.length > 1 ? 2.5 : 0;
  let acc = 0;
  const sel = slices.find((s) => s.id === selected) || null;
  const colorOf = (s) => (s.color === "accent" ? "var(--k-accent)" : `var(--kc-${s.color})`);
  return (
    <div className="k-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Kategori dağılımı. ${slices.map((s) => `${s.label} yüzde ${Math.round(s.share * 100)}`).join(", ")}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="k-donut-track" />
        {slices.map((s) => {
          const len = Math.max(0, s.share * c - GAP);
          const off = -acc * c;
          acc += s.share;
          const active = sel?.id === s.id;
          return (
            <circle
              key={s.id}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={colorOf(s)} strokeWidth={active ? stroke + 5 : stroke} strokeLinecap="butt"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={off}
              opacity={sel && !active ? 0.35 : 1}
              style={{ cursor: onSelect ? "pointer" : "default", transition: "opacity .2s, stroke-width .2s" }}
              onClick={() => onSelect?.(active ? null : s.id)}
            />
          );
        })}
      </svg>
      <div className="k-donut-center">
        <span className="k-cap">{sel ? sel.label : centerLabel}</span>
        <b className="k-num md"><Amt>{formatMoney(sel ? sel.value : total, "TRY", { hideZeroDecimals: true })}</Amt></b>
        {sel && <span className="k-cap">%{Math.round(sel.share * 100)}</span>}
      </div>
    </div>
  );
}

// ---- Çizgi (trend) ----
// points: [{ label, value }]
export function LineChart({ points, height = 150, ariaLabel = "Harcama trendi" }) {
  const W = 320;
  const PAD = { l: 6, r: 6, t: 14, b: 22 };
  const uid = useId();
  const [hi, setHi] = useState(null);
  const ref = useRef(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const xs = (i) => PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (n - 1));
  const ys = (v) => PAD.t + (1 - v / max) * (height - PAD.t - PAD.b);
  const path = useMemo(() => points.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(p.value).toFixed(1)}`).join(" "), [points, height]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = `${path} L${xs(n - 1).toFixed(1)} ${height - PAD.b} L${xs(0).toFixed(1)} ${height - PAD.b} Z`;
  const pick = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(xs(i) - x) < Math.abs(xs(best) - x)) best = i;
    setHi(best);
  };
  const p = hi != null ? points[hi] : null;
  const labelIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <div className="k-line" style={{ height }}>
      {p && (
        <div className="k-tip" style={{ left: `${Math.min(86, Math.max(14, (xs(hi) / W) * 100))}%` }} role="status">
          <span className="k-cap">{p.label}</span>
          <b><Amt>{formatMoney(p.value, "TRY", { hideZeroDecimals: true })}</Amt></b>
        </div>
      )}
      <svg ref={ref} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={ariaLabel}
        onPointerDown={pick} onPointerMove={(e) => e.buttons || e.pointerType === "mouse" ? pick(e) : null} onPointerLeave={(e) => e.pointerType === "mouse" && setHi(null)}>
        <line x1={PAD.l} x2={W - PAD.r} y1={height - PAD.b} y2={height - PAD.b} className="k-grid-line" />
        <line x1={PAD.l} x2={W - PAD.r} y1={ys(max / 2)} y2={ys(max / 2)} className="k-grid-line dash" />
        <path d={area} className="k-line-area" />
        <path d={path} className="k-line-path" fill="none" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hi != null && <line x1={xs(hi)} x2={xs(hi)} y1={PAD.t} y2={height - PAD.b} className="k-guide" vectorEffect="non-scaling-stroke" />}
        {points.map((pt, i) => (i === hi || (hi == null && i === n - 1) ? <circle key={i} cx={xs(i)} cy={ys(pt.value)} r="4.5" className="k-dot-mark" vectorEffect="non-scaling-stroke" /> : null))}
        {labelIdx.map((i) => <text key={i} x={xs(i)} y={height - 5} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="k-axis">{points[i].label}</text>)}
        <rect id={uid} x="0" y="0" width={W} height={height} fill="transparent" />
      </svg>
      <table className="k-sr"><caption>{ariaLabel}</caption><tbody>{points.map((pt) => <tr key={pt.label + pt.from}><th>{pt.label}</th><td>{formatMoneyText(pt.value)}</td></tr>)}</tbody></table>
    </div>
  );
}

// ---- Isı haritası (gün × 3 saatlik dilim) ----
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const DAYS_LONG = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const COLS = ["00", "03", "06", "09", "12", "15", "18", "21"];
export function Heatmap({ cells, max }) {
  const [sel, setSel] = useState(null);
  const level = (v) => (v <= 0 || max <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)));
  const range = (b) => `${String(b * 3).padStart(2, "0")}:00–${String(b * 3 + 3).padStart(2, "0")}:00`;
  return (
    <div className="k-heat">
      <div className="k-heat-grid" role="grid" aria-label="Gün ve saate göre harcama ısı haritası">
        <span />
        {COLS.map((c) => <b key={c} className="k-heat-col">{c}</b>)}
        {cells.map((row, d) => (
          <div key={d} className="k-heat-row" role="row">
            <b className="k-heat-day">{DAYS[d]}</b>
            {row.map((c) => (
              <button key={c.bucket} type="button" role="gridcell" className={`k-heat-cell l${level(c.value)} ${sel && sel.dow === c.dow && sel.bucket === c.bucket ? "sel" : ""}`}
                onClick={() => setSel(sel && sel.dow === c.dow && sel.bucket === c.bucket ? null : c)} aria-label={`${DAYS_LONG[c.dow]} ${range(c.bucket)}: ${c.count} harcama, ${formatMoneyText(c.value)}`} />
            ))}
          </div>
        ))}
      </div>
      <p className="k-heat-note" role="status">
        {sel ? <><b>{DAYS_LONG[sel.dow]} {range(sel.bucket)}</b> · {sel.count} harcama · <Amt>{formatMoney(sel.value, "TRY", { hideZeroDecimals: true })}</Amt></> : "Bir kareye dokun: o gün ve saat dilimindeki harcamayı gör."}
      </p>
    </div>
  );
}
