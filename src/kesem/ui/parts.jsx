import { useState } from "react";
import Sheet from "./Sheet";
import NumPad from "./NumPad";
import { displayInput, formatMoney, minorToInput, parseAmountInput, pressKey, currencySymbol } from "../model/money";
import { useApp } from "./appctx";
import PageHeader from "./PageHeader";
import { Amt } from "./Amt";

// Halka ilerleme göstergesi. state: ok | near | over (yalnızca DURUM renkleri) | boş = marka vurgusu.
export function Ring({ value = 0, size = 64, stroke = 7, state, label, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="k-ring" data-state={state} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="k-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="k-ring-bar" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      {children !== undefined && <span className="k-ring-label">{children}</span>}
    </span>
  );
}

export const Bar = ({ value, state }) => (
  <div className="k-bar" data-state={state} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, Math.max(0, value)) * 100)}>
    <i style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }} />
  </div>
);

export const pct = (v) => `%${Math.round(Math.max(0, v) * 100)}`;
export const STATE_LABEL = { ok: "Yolunda", near: "Bütçeye yakın", over: "Bütçe aşıldı", none: "" };

// Tutar giriş sayfası: büyük sayı + özel tuş takımı (sistem klavyesi açılmaz).
export function AmountSheet({ title, initialMinor = 0, currency = "TRY", submitLabel = "Tamam", allowZero = false, onSubmit, onRemove, removeLabel = "Kaldır", onClose }) {
  const [v, setV] = useState(minorToInput(initialMinor));
  const minor = parseAmountInput(v);
  const ok = allowZero || minor > 0;
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={<NumPad onKey={(k) => setV((c) => pressKey(c, k))} canSubmit={ok} submitLabel={submitLabel} onSubmit={() => { onSubmit(minor); onClose(); }} />}
    >
      <div className="k-amount" style={{ minHeight: 120 }}>
        <span className="k-amount-num" data-empty={!v}>{displayInput(v)}</span>
        <span className="k-amount-sym">{currencySymbol(currency)}</span>
      </div>
      {onRemove && (
        <div style={{ textAlign: "center" }}>
          <button type="button" className="k-btn danger-ghost sm" onClick={() => { onRemove(); onClose(); }}>{removeLabel}</button>
        </div>
      )}
    </Sheet>
  );
}

// Formlarda tutar alanı: dokununca AmountSheet açılır.
export function AmountField({ label, value, currency = "TRY", onChange, placeholder = "Tutar gir", allowZero }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="k-amount-field k-glassfield" onClick={() => setOpen(true)} aria-label={label}>
        <span>{value ? <Amt>{formatMoney(value, currency)}</Amt> : <span className="k-muted" style={{ fontWeight: 500, fontSize: 16 }}>{placeholder}</span>}</span>
        <small>{label}</small>
      </button>
      {open && <AmountSheet title={label} initialMinor={value || 0} currency={currency} allowZero={allowZero} onSubmit={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

// Tablet: solda liste, sağda detay. Telefon: biri gösterilir. (Parça 1'deki kalıpla aynı.)
export function SplitView({ master, detail, hasDetail, empty }) {
  const app = useApp();
  if (!app.isTablet) return hasDetail ? detail : master;
  return (
    <div className="k-md">
      <div className="k-md-master">{master}</div>
      <div className="k-md-detail">{hasDetail ? detail : empty}</div>
    </div>
  );
}

// Sayfa kabuğu: başlık + içerik + alt boşluk (alt çubuk altında kalmasın).
export function Page({ title, subtitle, onBack, right, children }) {
  return (
    <div className="k-page">
      <PageHeader title={title} subtitle={subtitle} onBack={onBack} right={right} />
      {children}
      <div className="k-page-end" />
    </div>
  );
}

// Küçük Kahraman kartı (yönetim sayfalarında tek Kahraman).
export function HeroStat({ cap, value, sub }) {
  return (
    <section className="k-card hero" aria-label={cap}>
      <div className="k-cap">{cap}</div>
      <div className="k-num xl" style={typeof value === "string" ? { fontSize: "clamp(26px, 8vw, 34px)" } : undefined}>{value}</div>
      {sub && <div className="k-muted" style={{ fontSize: 13.5, marginTop: 6 }}>{sub}</div>}
    </section>
  );
}
