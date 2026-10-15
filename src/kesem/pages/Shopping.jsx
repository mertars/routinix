import { useState } from "react";
import { Amt } from "../ui/Amt";
import { Check, Plus, X, ShoppingBasket } from "lucide-react";
import { Page, AmountSheet, Bar } from "../ui/parts";
import { EmptyState } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { formatMoney } from "../model/money";

export default function ShoppingPage({ onBack }) {
  const k = useKesem();
  const app = useApp();
  const [name, setName] = useState("");
  const [priceFor, setPriceFor] = useState(null);
  const todo = k.shopping.filter((i) => !i.doneAt);
  const done = k.shopping.filter((i) => i.doneAt).sort((a, b) => b.doneAt - a.doneAt).slice(0, 8);
  const checked = todo.filter((i) => i.checked);
  const checkedTotal = checked.reduce((s, i) => s + (i.estimateMinor || 0), 0);
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setName("");
    await k.saveRecord("shopping", { name: n.slice(0, 40), estimateMinor: 0, checked: false, doneAt: null, categoryId: "cat-market" }, "listeye ekleme");
  };
  const record = () =>
    app.openAdd({ initial: { kind: "expense", amountMinor: checkedTotal, categoryId: checked[0]?.categoryId || "cat-market", note: checked.map((i) => i.name).join(", ").slice(0, 180), linkIds: checked.map((i) => ({ store: "shopping", id: i.id, kind: "shop" })) } });
  return (
    <Page title="Alışveriş Listesi" subtitle={todo.length ? `${todo.length} ürün` : "Liste boş"} onBack={onBack}>
      <section className="k-card hero">
        <div className="k-row-between">
          <div>
            <div className="k-cap">İşaretlenen</div>
            <div className="k-num xl">{checked.length}<span className="k-muted" style={{ fontSize: 20, fontWeight: 600 }}> / {todo.length}</span></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="k-cap">Tahmini tutar</div>
            <b className="k-num md"><Amt>{formatMoney(checkedTotal, "TRY", { hideZeroDecimals: true })}</Amt></b>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><Bar value={todo.length ? checked.length / todo.length : 0} /></div>
      </section>
      <label className="k-input-row k-gap">
        <Plus size={18} />
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Listeye ürün ekle" maxLength={40} aria-label="Ürün adı" enterKeyHint="done" />
        <button type="button" className="k-btn primary sm" onClick={add} disabled={!name.trim()}>Ekle</button>
      </label>
      {todo.length === 0 ? (
        <EmptyState icon={<ShoppingBasket size={30} />} title="Listen temiz" text="Alacaklarını yaz; markette işaretle, sonra tek dokunuşla harcama olarak kaydet." />
      ) : (
        <div className="k-card-list k-gap">
          {todo.map((i) => (
            <div key={i.id} className="k-line-item" style={{ padding: "6px 14px" }}>
              <button type="button" className={`k-check ${i.checked ? "on" : ""}`} aria-pressed={!!i.checked} aria-label={`${i.name} ${i.checked ? "işaretini kaldır" : "işaretle"}`} onClick={() => k.saveRecord("shopping", { id: i.id, checked: !i.checked }, "işaretleme")}>
                <Check size={16} />
              </button>
              <span className="k-grow k-ellip" style={{ fontWeight: 600, textDecoration: i.checked ? "line-through" : "none", opacity: i.checked ? 0.6 : 1 }}>{i.name}</span>
              <button type="button" className="k-btn tonal sm" onClick={() => setPriceFor(i)} aria-label={`${i.name} fiyatı`}>{i.estimateMinor ? <Amt>{formatMoney(i.estimateMinor, "TRY", { hideZeroDecimals: true })}</Amt> : "Fiyat"}</button>
              <button type="button" className="k-icon-btn sm" aria-label="Sil" onClick={() => k.removeRecord("shopping", i.id, "ürün silme")}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {checked.length > 0 && (
        <button type="button" className="k-btn primary full k-gap" onClick={record}>
          <Check size={17} /> İşaretlenenleri harcama olarak kaydet
        </button>
      )}
      {done.length > 0 && (
        <>
          <div className="k-section-title">Son alınanlar</div>
          <div className="k-card-list">
            {done.map((i) => (
              <div key={i.id} className="k-line-item" style={{ padding: "8px 14px", opacity: 0.65 }}>
                <span className="k-check on" aria-hidden="true"><Check size={16} /></span>
                <span className="k-grow k-ellip">{i.name}</span>
                <button type="button" className="k-btn ghost sm" onClick={() => k.saveRecord("shopping", { id: i.id, doneAt: null, checked: false, txId: null }, "listeye geri alma")}>Listeye al</button>
              </div>
            ))}
          </div>
        </>
      )}
      {priceFor && <AmountSheet title={`${priceFor.name} · tahmini fiyat`} initialMinor={priceFor.estimateMinor || 0} allowZero onSubmit={(v) => k.saveRecord("shopping", { id: priceFor.id, estimateMinor: v }, "fiyat girme")} onClose={() => setPriceFor(null)} />}
    </Page>
  );
}
