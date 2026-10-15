import { useMemo } from "react";
import { dayLabel, fromDateInput, startOfDay, toDateInput, withTime } from "../model/dates";

const p2 = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

// 24 saatlik tarih/saat seçici. Gün çipleri (son 7 gün) + serbest tarih,
// saat ve dakika ızgaraları + ±1 dk ince ayar. Hepsi tek dokunuş.
export default function DateTimePicker({ value, onChange, onNow }) {
  const d = new Date(value);
  const h = d.getHours();
  const m = d.getMinutes();
  const today = startOfDay(Date.now());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => today - i * 86400000), [today]);
  const day = startOfDay(value);
  const setDay = (t) => onChange(withTime(t, h, m));
  const setTime = (hh, mm) => onChange(withTime(day, hh, mm));
  const bump = (delta) => {
    const t = value + delta * 60000;
    onChange(t);
  };

  return (
    <div className="k-dtp">
      <div className="k-dtp-days no-scrollbar" role="listbox" aria-label="Gün">
        {days.map((t) => (
          <button key={t} type="button" role="option" aria-selected={day === t} className={`k-chip sm ${day === t ? "on" : ""}`} onClick={() => setDay(t)}>
            {dayLabel(t)}
          </button>
        ))}
        <label className={`k-chip sm k-date-native ${!days.includes(day) ? "on" : ""}`}>
          {!days.includes(day) ? dayLabel(day) : "Tarih seç"}
          <input type="date" value={toDateInput(day)} max={toDateInput(Date.now())} onChange={(e) => e.target.value && setDay(fromDateInput(e.target.value))} aria-label="Tarih seç" />
        </label>
      </div>
      <div className="k-dtp-time-head">
        <span className="k-dtp-clock">
          {p2(h)}:{p2(m)}
        </span>
        <div className="k-dtp-bump">
          <button type="button" className="k-chip sm" onClick={() => bump(-1)} aria-label="1 dakika geri">
            −1 dk
          </button>
          <button type="button" className="k-chip sm" onClick={() => bump(1)} aria-label="1 dakika ileri">
            +1 dk
          </button>
          <button type="button" className="k-chip sm accent" onClick={onNow}>
            Şimdi
          </button>
        </div>
      </div>
      <div className="k-dtp-grid" role="listbox" aria-label="Saat">
        {HOURS.map((x) => (
          <button key={x} type="button" role="option" aria-selected={h === x} className={h === x ? "on" : ""} onClick={() => setTime(x, m)}>
            {p2(x)}
          </button>
        ))}
      </div>
      <div className="k-dtp-grid min" role="listbox" aria-label="Dakika">
        {MINUTES.map((x) => (
          <button key={x} type="button" role="option" aria-selected={m === x} className={m === x ? "on" : ""} onClick={() => setTime(h, x)}>
            :{p2(x)}
          </button>
        ))}
      </div>
    </div>
  );
}
