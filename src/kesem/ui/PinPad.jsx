import { Delete } from "lucide-react";

// PIN noktaları + rakam tuşları (cam tuşlar; sistem klavyesi açılmaz). `extra` = sol alt köşe (biyometri vb.)
export function PinPad({ length, value, onChange, onComplete, error, disabled, extra, label = "PIN" }) {
  const press = (d) => {
    if (disabled || value.length >= length) return;
    const next = value + d;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };
  return (
    <div className="k-pin">
      <div className={`k-pin-dots ${error ? "err" : ""}`} role="img" aria-label={`${label}: ${value.length} / ${length} hane girildi`}>
        {Array.from({ length }, (_, i) => <span key={i} className={i < value.length ? "on" : ""} />)}
      </div>
      <div className="k-pin-keys" role="group" aria-label={`${label} tuş takımı`}>
        {"123456789".split("").map((d) => <button key={d} type="button" className="k-key" disabled={disabled} onClick={() => press(d)}>{d}</button>)}
        <span className="k-pin-extra">{extra}</span>
        <button type="button" className="k-key" disabled={disabled} onClick={() => press("0")}>0</button>
        <button type="button" className="k-key" disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))} aria-label="Sil"><Delete size={22} /></button>
      </div>
    </div>
  );
}
