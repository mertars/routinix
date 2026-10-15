import { useState } from "react";
import Sheet from "./Sheet";
import { AmountField } from "./parts";
import { Segmented } from "./common";
import { Icon } from "./icons";
import { useKesem } from "../state/store";
import { emptyFilter } from "../model/filters";
import { fromDateInput, toDateInput } from "../model/dates";

const KINDS = [{ value: "all", label: "Tümü" }, { value: "expense", label: "Gider" }, { value: "income", label: "Gelir" }];
const toggle = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

// Gelişmiş filtre: tür, tutar aralığı (₺ karşılığı), tarih aralığı, kategori, ödeme yöntemi, etiket.
export default function FilterSheet({ value, onApply, onClose }) {
  const k = useKesem();
  const [f, setF] = useState({ ...value });
  const set = (p) => setF((c) => ({ ...c, ...p }));
  const cats = [...k.topCategories("expense"), ...k.topCategories("income")];
  const bad = f.min != null && f.max != null && f.min > f.max;
  const badDate = f.from != null && f.to != null && f.from > f.to;
  const footer = (
    <div className="k-footbar">
      <button type="button" className="k-btn tonal" onClick={() => setF({ ...emptyFilter(), query: value.query })}>Temizle</button>
      <button type="button" className="k-btn primary grow" style={{ flex: 1 }} disabled={bad || badDate} onClick={() => { onApply(f); onClose(); }}>Uygula</button>
    </div>
  );
  return (
    <Sheet open onClose={onClose} title="Filtrele" tall footer={footer} size="md">
      <div className="k-form" style={{ paddingBottom: 12 }}>
        <div className="k-label" style={{ marginTop: 0 }}>Tür</div>
        <Segmented value={f.kind} onChange={(v) => set({ kind: v })} options={KINDS} label="Tür" />

        <div className="k-label">Tutar aralığı (₺)</div>
        <div className="k-two">
          <AmountField label="En az" value={f.min || 0} onChange={(v) => set({ min: v || null })} placeholder="En az" allowZero />
          <AmountField label="En çok" value={f.max || 0} onChange={(v) => set({ max: v || null })} placeholder="En çok" allowZero />
        </div>
        {bad && <p className="k-error">“En az” tutar “en çok” tutardan büyük olamaz.</p>}

        <div className="k-label">Tarih aralığı</div>
        <div className="k-two">
          <label className="k-datefield"><span>Başlangıç</span><input type="date" className="k-input" value={f.from != null ? toDateInput(f.from) : ""} onChange={(e) => set({ from: e.target.value ? fromDateInput(e.target.value) : null })} aria-label="Başlangıç tarihi" /></label>
          <label className="k-datefield"><span>Bitiş</span><input type="date" className="k-input" value={f.to != null ? toDateInput(f.to) : ""} onChange={(e) => set({ to: e.target.value ? fromDateInput(e.target.value) : null })} aria-label="Bitiş tarihi" /></label>
        </div>
        {badDate && <p className="k-error">Başlangıç tarihi bitişten sonra olamaz.</p>}

        <div className="k-label">Kategori</div>
        <div className="k-chips wrap">
          {cats.map((c) => (
            <button key={c.id} type="button" aria-pressed={f.categoryIds.includes(c.id)} className={`k-chip sm ${f.categoryIds.includes(c.id) ? "on" : ""}`} style={{ "--c": `var(--kc-${c.color})` }} onClick={() => set({ categoryIds: toggle(f.categoryIds, c.id) })}>
              <Icon name={c.icon} size={14} />{c.name}
            </button>
          ))}
        </div>

        <div className="k-label">Ödeme yöntemi</div>
        <div className="k-chips wrap">
          {k.accounts.map((a) => (
            <button key={a.id} type="button" aria-pressed={f.accountIds.includes(a.id)} className={`k-chip sm ${f.accountIds.includes(a.id) ? "on" : ""}`} style={{ "--c": `var(--kc-${a.color})` }} onClick={() => set({ accountIds: toggle(f.accountIds, a.id) })}>
              {a.name}
            </button>
          ))}
        </div>

        {k.tags.length > 0 && (
          <>
            <div className="k-label">Etiket</div>
            <div className="k-chips wrap">
              {k.tags.map((t) => (
                <button key={t.id} type="button" aria-pressed={f.tagIds.includes(t.id)} className={`k-chip sm ${f.tagIds.includes(t.id) ? "on" : ""}`} onClick={() => set({ tagIds: toggle(f.tagIds, t.id) })}>#{t.name}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
