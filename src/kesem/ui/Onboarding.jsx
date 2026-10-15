import { useState } from "react";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { AmountField } from "./parts";
import { Segmented } from "./common";
import { Icon } from "./icons";
import { PALETTES } from "./palettes";
import { useKesem } from "../state/store";

// İlk açılışta 3 adım: kategoriler → bütçe → tema. Her adımda "Atla"; en fazla 3 adım.
export default function Onboarding({ onFinish }) {
  const k = useKesem();
  const tops = k.topCategories("expense");
  const [step, setStep] = useState(0);
  const [keep, setKeep] = useState(() => new Set(tops.map((c) => c.id)));
  const [budget, setBudget] = useState(0);
  const [startDay, setStartDay] = useState(1);
  const toggle = (id) => setKeep((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const finish = async (apply) => {
    if (apply) {
      const hide = tops.filter((c) => !keep.has(c.id) && c.id !== "cat-diger").map((c) => c.id);
      if (hide.length) await k.hideCategories(hide);
      if (budget > 0 || startDay !== 1) await k.saveBudget({ monthlyMinor: budget, startDay });
    }
    await k.updateSettings({ onboarded: true, onbForce: false });
    onFinish?.();
  };
  const next = () => (step < 2 ? setStep(step + 1) : finish(true));

  return (
    <div className="k-onb" role="dialog" aria-modal="true" aria-label="Hoş geldin">
      <div className="k-onb-inner">
        <div className="k-row-between">
          <span className="k-onb-dots" role="img" aria-label={`Adım ${step + 1} / 3`}>{[0, 1, 2].map((i) => <i key={i} className={i === step ? "on" : i < step ? "done" : ""} />)}</span>
          <button type="button" className="k-btn ghost sm" onClick={() => finish(false)}>Atla</button>
        </div>

        <div className="k-onb-body" key={step}>
          <span className="k-tile-ico k-onb-ico"><Sparkles size={22} /></span>
          {step === 0 && (
            <>
              <h1>Hangi harcamaları takip edeceksin?</h1>
              <p>Kullanmayacaklarını kapat; sonra Ayarlar'dan istediğin zaman geri getirebilir, kendi kategorini ekleyebilirsin.</p>
              <div className="k-chips wrap" role="group" aria-label="Kategoriler">
                {tops.map((c) => (
                  <button key={c.id} type="button" aria-pressed={keep.has(c.id)} className={`k-chip ${keep.has(c.id) ? "on" : ""}`} style={{ "--c": `var(--kc-${c.color})` }} onClick={() => toggle(c.id)}>
                    <Icon name={c.icon} size={17} />{c.name}{keep.has(c.id) && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1>Aylık bütçen ne kadar?</h1>
              <p>Her gün ne kadar harcayabileceğini hesaplayacağım. Boş bırakabilirsin.</p>
              <AmountField label="Aylık bütçe" value={budget} onChange={setBudget} placeholder="Tutar gir (isteğe bağlı)" />
              <div className="k-row-between" style={{ marginTop: 18 }}>
                <span><b>Ay başlangıç günü</b><small className="k-muted" style={{ display: "block", fontSize: 12.5 }}>Maaş günün</small></span>
                <div className="k-stepper">
                  <button type="button" className="k-icon-btn" onClick={() => setStartDay(Math.max(1, startDay - 1))} disabled={startDay <= 1} aria-label="Bir gün azalt">−</button>
                  <b>{startDay}</b>
                  <button type="button" className="k-icon-btn" onClick={() => setStartDay(Math.min(28, startDay + 1))} disabled={startDay >= 28} aria-label="Bir gün artır">+</button>
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h1>Görünümünü seç</h1>
              <p>Değişiklik anında uygulanır; Ayarlar'dan her zaman değiştirebilirsin.</p>
              <Segmented value={k.settings.mode} onChange={(v) => k.updateSettings({ mode: v })} options={[{ value: "auto", label: "Routinix gibi" }, { value: "light", label: "Gündüz" }, { value: "dark", label: "Gece" }]} label="Görünüm modu" />
              <div className="k-palettes" style={{ marginTop: 14 }}>
                {PALETTES.map((p) => (
                  <button key={p.key} type="button" aria-pressed={k.settings.palette === p.key} className={`k-palette ${k.settings.palette === p.key ? "on" : ""}`} data-k-palette={p.key} onClick={() => k.updateSettings({ palette: p.key })}>
                    <span className="k-palette-swatch" /><b>{p.name}</b>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="k-onb-foot">
          {step > 0 && <button type="button" className="k-btn tonal" onClick={() => setStep(step - 1)}>Geri</button>}
          <button type="button" className="k-btn primary grow" style={{ flex: 1 }} onClick={next}>{step < 2 ? <>Devam <ChevronRight size={17} /></> : "Başla"}</button>
        </div>
      </div>
    </div>
  );
}
