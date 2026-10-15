import { useMemo, useState } from "react";
import { Amt } from "../ui/Amt";
import { Plus, Trash2, Users, Check } from "lucide-react";
import { Page, AmountSheet, AmountField, SplitView } from "../ui/parts";
import Sheet from "../ui/Sheet";
import { EmptyState, Segmented } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { personBalances, remainingOf } from "../model/finance";
import { formatMoney, formatMoneyText, rateOf, CURRENCIES, currencySymbol } from "../model/money";
import { fromDateInput, shortDate, startOfDay, toDateInput, trLower } from "../model/dates";

function DebtEditor({ initial, onClose }) {
  const k = useKesem();
  const [name, setName] = useState(initial.personName || "");
  const [dir, setDir] = useState(initial.direction || "lent");
  const [amount, setAmount] = useState(initial.amountMinor || 0);
  const [currency, setCurrency] = useState(initial.currency || "TRY");
  const [due, setDue] = useState(initial.dueAt || null);
  const [note, setNote] = useState(initial.note || "");
  const valid = name.trim() && amount > 0 && (currency === "TRY" || rateOf(currency, k.rates));
  const save = async () => {
    const n = name.trim().slice(0, 28);
    let person = k.people.find((p) => trLower(p.name) === trLower(n));
    if (!person) person = await k.saveRecord("people", { name: n }, "kişi ekleme");
    if (!person) return;
    const rec = await k.saveRecord("debts", { id: initial.id, personId: person.id, direction: dir, amountMinor: amount, paidMinor: initial.paidMinor || 0, currency, dueAt: due, note: note.trim(), txId: initial.txId || null, settledAt: initial.settledAt || null }, dir === "lent" ? "alacak kaydı" : "borç kaydı");
    if (rec) {
      k.notify({ message: "Kaydedildi", actionLabel: "Geri Al", action: "undo" });
      onClose(rec);
    }
  };
  return (
    <Sheet open onClose={() => onClose()} title={initial.id ? "Kaydı düzenle" : "Borç / alacak ekle"} size="sm">
      <div className="k-form">
        <Segmented value={dir} onChange={setDir} options={[{ value: "lent", label: "Verdim" }, { value: "borrowed", label: "Aldım" }]} label="Yön" />
        <div className="k-label">Kişi</div>
        <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kime / kimden" maxLength={28} aria-label="Kişi adı" />
        {k.people.length > 0 && (
          <div className="k-chips wrap" style={{ marginTop: 8 }}>
            {k.people.map((p) => <button key={p.id} type="button" className={`k-chip sm ${trLower(p.name) === trLower(name) ? "on" : ""}`} onClick={() => setName(p.name)}>{p.name}</button>)}
          </div>
        )}
        <div className="k-label">Tutar</div>
        <AmountField label={dir === "lent" ? "Verdiğin" : "Aldığın"} value={amount} currency={currency} onChange={setAmount} />
        {k.enabledCurrencies.length > 1 && (
          <div className="k-curr" style={{ marginTop: 8 }}>
            {CURRENCIES.filter((c) => k.enabledCurrencies.includes(c)).map((c) => (
              <button key={c} type="button" className={`k-chip sm ${currency === c ? "on" : ""}`} onClick={() => setCurrency(c)}>{currencySymbol(c)} {c}</button>
            ))}
          </div>
        )}
        <div className="k-label">Vade (isteğe bağlı)</div>
        <input type="date" className="k-input" value={due ? toDateInput(due) : ""} onChange={(e) => setDue(e.target.value ? fromDateInput(e.target.value) : null)} aria-label="Vade tarihi" />
        <div className="k-label">Not</div>
        <input className="k-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" maxLength={80} aria-label="Not" />
        <div className="k-form-actions">
          {initial.id && <button type="button" className="k-btn danger-ghost" onClick={async () => { onClose(null, true); await k.removeRecord("debts", initial.id, "kayıt silme"); }}><Trash2 size={16} /> Sil</button>}
          <button type="button" className="k-btn primary grow" disabled={!valid} onClick={save}>Kaydet</button>
        </div>
      </div>
    </Sheet>
  );
}

function netLine(net) {
  if (net > 0) return { text: "Sana borçlu", cls: "pos" };
  if (net < 0) return { text: "Sen borçlusun", cls: "k-state-over" };
  return { text: "Hesap denk", cls: "" };
}

function PersonDetail({ id, onBack }) {
  const k = useKesem();
  const bal = personBalances({ people: k.people, debts: k.debts, rates: k.rates }).find((b) => b.person.id === id);
  const entries = k.debts.filter((d) => d.personId === id).sort((a, b) => b.createdAt - a.createdAt);
  const [edit, setEdit] = useState(null);
  const [part, setPart] = useState(null);
  const person = k.personById(id);
  if (!person) return <Page title="Kişi" onBack={onBack}><EmptyState icon={<Users size={30} />} title="Kişi bulunamadı" /></Page>;
  const nl = netLine(bal?.net || 0);
  const today = startOfDay(Date.now());
  return (
    <Page title={person.name} subtitle={nl.text} onBack={onBack} right={<button type="button" className="k-btn primary sm" onClick={() => setEdit({ personName: person.name })}><Plus size={16} /> Kayıt</button>}>
      <section className="k-card hero">
        <div className="k-cap">{nl.text}</div>
        <div className="k-num xl"><Amt>{formatMoney(Math.abs(bal?.net || 0), "TRY", { hideZeroDecimals: true })}</Amt></div>
        <div className="k-row-between" style={{ marginTop: 10 }}>
          <span className="k-muted" style={{ fontSize: 13.5 }}>Alacak <Amt>{formatMoney(bal?.lent || 0, "TRY", { hideZeroDecimals: true })}</Amt> · Borç <Amt>{formatMoney(bal?.borrowed || 0, "TRY", { hideZeroDecimals: true })}</Amt></span>
          {bal?.overdue > 0 && <span className="k-pill over">{bal.overdue} gecikmiş</span>}
        </div>
      </section>
      <div className="k-section-title">Kayıtlar</div>
      <div className="k-card-list">
        {entries.map((d) => {
          const rem = remainingOf(d);
          const settled = rem === 0;
          const late = !settled && d.dueAt && d.dueAt < today;
          return (
            <div key={d.id} className="k-line-item" style={{ padding: "8px 14px" }}>
              <button type="button" className={`k-check ${settled ? "on" : ""}`} aria-label={settled ? "Ödendi işaretini kaldır" : "Ödendi olarak işaretle"} aria-pressed={settled} onClick={() => k.settleDebt(d.id, settled ? 0 : d.amountMinor)}>
                <Check size={16} />
              </button>
              <button type="button" className="k-grow" style={{ textAlign: "left" }} onClick={() => setEdit(d)}>
                <div className="k-ellip" style={{ fontWeight: 650, textDecoration: settled ? "line-through" : "none", opacity: settled ? 0.6 : 1 }}>
                  {d.direction === "lent" ? "Verdim" : "Aldım"} · <Amt>{formatMoney(d.amountMinor, d.currency)}</Amt>
                </div>
                <div className="k-tile-sub k-ellip">
                  {d.note || "Not yok"}{d.txId ? " · bölüşülen harcama" : ""}{d.paidMinor && !settled ? ` · ${formatMoneyText(d.paidMinor, d.currency)} ödendi` : ""}
                </div>
                {d.dueAt && !settled && <div className={`k-tile-sub ${late ? "k-state-over" : ""}`} style={late ? { fontWeight: 700 } : {}}>{late ? "Gecikti · " : "Vade · "}{shortDate(d.dueAt)}</div>}
              </button>
              {!settled && <button type="button" className="k-btn tonal sm" onClick={() => setPart(d)}>Kısmi</button>}
            </div>
          );
        })}
      </div>
      {edit && <DebtEditor initial={edit} onClose={() => setEdit(null)} />}
      {part && <AmountSheet title="Ödenen tutar" currency={part.currency} initialMinor={remainingOf(part)} submitLabel="Kaydet" onSubmit={(v) => k.settleDebt(part.id, (part.paidMinor || 0) + v)} onClose={() => setPart(null)} />}
    </Page>
  );
}

export default function DebtsPage({ id }) {
  const k = useKesem();
  const app = useApp();
  const [edit, setEdit] = useState(null);
  const balances = useMemo(() => personBalances({ people: k.people, debts: k.debts, rates: k.rates }), [k.people, k.debts, k.rates]);
  const withOpen = balances.filter((b) => b.open > 0 || b.person.id === id);
  const lent = balances.reduce((s, b) => s + b.lent, 0);
  const borrowed = balances.reduce((s, b) => s + b.borrowed, 0);
  const net = lent - borrowed;
  const nl = netLine(net);
  const go = (pid) => app.navigate(`daha-fazla/borclar/${pid}`, { replace: app.isTablet && !!id });
  const master = (
    <Page title="Borçlar" subtitle="Kim kime ne borçlu" onBack={app.isTablet ? undefined : () => app.goBack("daha-fazla")} right={<button type="button" className="k-btn primary sm" onClick={() => setEdit({})}><Plus size={16} /> Ekle</button>}>
      <section className="k-card hero">
        <div className="k-cap">{nl.text}</div>
        <div className="k-num xl"><Amt>{formatMoney(Math.abs(net), "TRY", { hideZeroDecimals: true })}</Amt></div>
        <div className="k-row-between" style={{ marginTop: 12, gap: 8 }}>
          <div><div className="k-cap">Alacağın</div><b className="k-num md"><Amt>{formatMoney(lent, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
          <div><div className="k-cap">Borcun</div><b className="k-num md"><Amt>{formatMoney(borrowed, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
        </div>
      </section>
      {withOpen.length === 0 ? (
        <EmptyState icon={<Users size={30} />} title="Açık borç yok" text="Birine borç verdiysen ya da aldıysan ekle. Harcama eklerken “Bölüş” dersen burada otomatik görünür." />
      ) : (
        <>
          <div className="k-section-title">Kişiler</div>
          <div className="k-card-list">
            {withOpen.map((b) => {
              const l = netLine(b.net);
              return (
                <button key={b.person.id} type="button" className={`k-manage-row ${id === b.person.id ? "active" : ""}`} onClick={() => go(b.person.id)}>
                  <span className="k-menu-icon" style={{ fontWeight: 800 }}>{b.person.name.charAt(0).toLocaleUpperCase("tr-TR")}</span>
                  <span>{b.person.name}<small>{l.text}{b.overdue ? ` · ${b.overdue} gecikmiş` : ""}</small></span>
                  <b className={l.cls} style={{ fontVariantNumeric: "tabular-nums" }}><Amt>{formatMoney(Math.abs(b.net), "TRY", { hideZeroDecimals: true })}</Amt></b>
                </button>
              );
            })}
          </div>
        </>
      )}
      {edit && <DebtEditor initial={edit} onClose={(rec) => { setEdit(null); if (rec) go(rec.personId); }} />}
    </Page>
  );
  return <SplitView master={master} hasDetail={!!id} detail={<PersonDetail id={id} onBack={() => app.goBack("daha-fazla/borclar")} />} empty={<div className="k-page"><EmptyState icon={<Users size={30} />} title="Bir kişi seç" text="Kayıtlarını, ödendi işaretlerini ve kısmi ödemeleri burada yönet." /></div>} />;
}
