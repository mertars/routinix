import { useState } from "react";
import { Amt } from "../ui/Amt";
import { Plus, Trash2, Gift, ShoppingBag } from "lucide-react";
import { Page, AmountField } from "../ui/parts";
import Sheet from "../ui/Sheet";
import { Segmented, EmptyState } from "../ui/common";
import { Icon } from "../ui/icons";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { baseOf, formatMoney } from "../model/money";
import { shortDate } from "../model/dates";

const PRIO = [{ value: "3", label: "Çok istiyorum" }, { value: "2", label: "İstiyorum" }, { value: "1", label: "Belki" }];

function WishEditor({ initial, onClose }) {
  const k = useKesem();
  const [name, setName] = useState(initial.name || "");
  const [price, setPrice] = useState(initial.priceMinor || 0);
  const [prio, setPrio] = useState(String(initial.priority || 2));
  const [note, setNote] = useState(initial.note || "");
  const [cat, setCat] = useState(initial.categoryId || "cat-giyim");
  return (
    <Sheet open onClose={onClose} title={initial.id ? "İsteği düzenle" : "Yeni istek"} size="sm">
      <div className="k-form">
        <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ne almak istiyorsun?" maxLength={48} autoFocus={!initial.id} aria-label="İstek adı" />
        <div className="k-label">Fiyat</div>
        <AmountField label="Fiyat" value={price} onChange={setPrice} />
        <div className="k-label">Ne kadar istiyorsun?</div>
        <Segmented value={prio} onChange={setPrio} options={PRIO} label="Öncelik" />
        <div className="k-label">Kategori</div>
        <div className="k-chips no-scrollbar">
          {k.topCategories("expense").map((c) => <button key={c.id} type="button" className={`k-chip sm ${cat === c.id ? "on" : ""}`} style={{ "--c": `var(--kc-${c.color})` }} onClick={() => setCat(c.id)}><Icon name={c.icon} size={15} />{c.name}</button>)}
        </div>
        <div className="k-label">Not</div>
        <input className="k-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mağaza, model, bağlantı…" maxLength={120} aria-label="Not" />
        <div className="k-form-actions">
          {initial.id && <button type="button" className="k-btn danger-ghost" onClick={async () => { onClose(); await k.removeRecord("wishes", initial.id, "istek silme"); }}><Trash2 size={16} /> Sil</button>}
          <button type="button" className="k-btn primary grow" disabled={!name.trim()} onClick={async () => { await k.saveRecord("wishes", { ...initial, name: name.trim(), priceMinor: price, currency: "TRY", priority: Number(prio), note: note.trim(), categoryId: cat }, "istek kaydı"); onClose(); }}>Kaydet</button>
        </div>
      </div>
    </Sheet>
  );
}

export default function WishesPage({ onBack }) {
  const k = useKesem();
  const app = useApp();
  const [edit, setEdit] = useState(null);
  const open = k.wishes.filter((w) => !w.boughtAt).sort((a, b) => (b.priority || 2) - (a.priority || 2));
  const bought = k.wishes.filter((w) => w.boughtAt).sort((a, b) => b.boughtAt - a.boughtAt);
  const total = open.reduce((s, w) => s + baseOf({ amountMinor: w.priceMinor || 0, currency: w.currency }, k.rates), 0);
  const buy = (w) => app.openAdd({ initial: { kind: "expense", amountMinor: w.priceMinor || 0, categoryId: w.categoryId, merchant: w.name, note: w.note || "", linkIds: [{ store: "wishes", id: w.id, kind: "wish" }] } });
  return (
    <Page title="İstek Listesi" subtitle="Almak istediklerin" onBack={onBack} right={<button type="button" className="k-btn primary sm" onClick={() => setEdit({})}><Plus size={16} /> Ekle</button>}>
      <div className="k-bento-wrap">
        <div className="k-bento">
          <section className="k-card hero b-2x1">
            <div className="k-cap">Listenin toplamı</div>
            <div className="k-num lg"><Amt>{formatMoney(total, "TRY", { hideZeroDecimals: true })}</Amt></div>
          </section>
          <div className="k-card accent b-1x1"><div className="k-cap">İstek</div><b className="k-num md">{open.length}</b><span className="k-tile-sub">bekliyor</span></div>
          {open.map((w, i) => (
            <div key={w.id} className={`k-card ${i === 0 ? "accent" : "calm"} ${i === 0 ? "b-3x1" : "b-1x1"}`} style={i === 0 ? { "--wt": 3 } : undefined}>
              <button type="button" className="k-tilebtn" onClick={() => setEdit(w)} aria-label={`${w.name} düzenle`}>
                <span className="k-tile-ico"><Gift size={17} /></span>
                <span style={{ minWidth: 0 }}>
                  <span className="k-tile-title k-ellip" style={{ display: "block", fontSize: i === 0 ? 17 : 13.5 }}>{w.name}</span>
                  <b className="k-num md" style={i === 0 ? {} : { fontSize: 15 }}>{w.priceMinor ? <Amt>{formatMoney(w.priceMinor, w.currency, { hideZeroDecimals: true })}</Amt> : "Fiyat yok"}</b>
                </span>
              </button>
              <button type="button" className="k-btn primary sm" onClick={() => buy(w)}><ShoppingBag size={14} /> Aldım</button>
            </div>
          ))}
        </div>
      </div>
      {open.length === 0 && <EmptyState icon={<Gift size={30} />} title="Listen boş" text="Almak istediklerini fiyatıyla ekle. “Aldım” dediğinde harcamaya dönüşür." action={<button type="button" className="k-btn primary" onClick={() => setEdit({})}><Plus size={18} /> İstek ekle</button>} />}
      {bought.length > 0 && (
        <>
          <div className="k-section-title">Aldıkların</div>
          <div className="k-card-list">
            {bought.map((w) => (
              <button key={w.id} type="button" className="k-manage-row" onClick={() => w.txId && app.navigate(`harcamalar/${w.txId}`)}>
                <span className="k-menu-icon"><ShoppingBag size={18} /></span>
                <span>{w.name}<small>{shortDate(w.boughtAt)}</small></span>
                <b style={{ fontVariantNumeric: "tabular-nums" }}><Amt>{formatMoney(w.priceMinor || 0, w.currency, { hideZeroDecimals: true })}</Amt></b>
              </button>
            ))}
          </div>
        </>
      )}
      {edit && <WishEditor initial={edit} onClose={() => setEdit(null)} />}
    </Page>
  );
}
