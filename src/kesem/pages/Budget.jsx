import { useState } from "react";
import { Amt } from "../ui/Amt";
import { Plus, Wallet } from "lucide-react";
import { Page, Ring, AmountSheet, STATE_LABEL, pct } from "../ui/parts";
import Sheet from "../ui/Sheet";
import { Bubble } from "../ui/icons";
import { useKesem } from "../state/store";
import { useFinance } from "../state/derived";
import { formatMoney } from "../model/money";
import { periodLabel } from "../model/dates";

export default function BudgetPage({ onBack }) {
  const k = useKesem();
  const f = useFinance();
  const { status: st, cats } = f;
  const [edit, setEdit] = useState(null); // {type:'total'} | {type:'cat', id}
  const [pick, setPick] = useState(false);
  const budgeted = new Set(cats.map((c) => c.categoryId));
  const free = k.topCategories("expense").filter((c) => !budgeted.has(c.id));
  const setCat = (id, v) => k.saveBudget({ byCategory: { ...k.budget.byCategory, [id]: v } });
  const delCat = (id) => {
    const { [id]: _, ...rest } = k.budget.byCategory;
    k.saveBudget({ byCategory: rest });
  };

  return (
    <Page title="Bütçe" subtitle={periodLabel(f.now, st.startDay)} onBack={onBack}>
      <div className="k-bento-wrap">
        <div className="k-bento">
          <section className="k-card hero b-3x1" style={{ "--ht": 2, "--wt": 6 }} aria-label="Genel bütçe">
            {st.hasBudget ? (
              <div className="k-row-between" style={{ gap: 16 }}>
                <Ring value={st.ratio} size={104} stroke={10} state={st.state} label={`Bütçenin ${pct(st.ratio)} kullanıldı`}>
                  {pct(st.ratio)}
                </Ring>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="k-cap">Aylık bütçe</div>
                  <button type="button" className="k-num lg" onClick={() => setEdit({ type: "total" })} aria-label="Aylık bütçeyi düzenle" style={{ display: "block", textAlign: "left" }}>
                    <Amt>{formatMoney(st.monthly, "TRY", { hideZeroDecimals: true })}</Amt>
                  </button>
                  <span className={`k-pill ${st.state}`} style={{ marginTop: 8 }}>{STATE_LABEL[st.state]}</span>
                </div>
              </div>
            ) : (
              <div className="k-stack">
                <div className="k-cap">Aylık bütçe</div>
                <p className="k-muted" style={{ fontSize: 15 }}>Bir tutar belirle; her gün ne kadar harcayabileceğini hesaplayalım.</p>
                <button type="button" className="k-btn primary" onClick={() => setEdit({ type: "total" })}>Bütçeni belirle</button>
              </div>
            )}
            {st.hasBudget && (
              <div className="k-row-between" style={{ marginTop: 14, gap: 8, alignItems: "flex-start" }}>
                <div><div className="k-cap">Harcanan</div><b className="k-num md"><Amt>{formatMoney(st.spent, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
                <div><div className="k-cap">Planlı</div><b className="k-num md"><Amt>{formatMoney(st.committed, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
                <div><div className="k-cap">Kalan</div><b className={`k-num md ${st.free < 0 ? "k-state-over" : ""}`}><Amt>{formatMoney(st.free, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
              </div>
            )}
          </section>

          {cats.map((c) => {
            const cat = k.catById(c.categoryId);
            return (
              <button key={c.categoryId} type="button" className="k-card b-1x1" onClick={() => setEdit({ type: "cat", id: c.categoryId, limit: c.limit })} aria-label={`${cat.name} bütçesi, ${pct(c.ratio)}`}>
                <Ring value={c.ratio} size={58} stroke={6} state={c.state}>
                  <Bubble icon={cat.icon} color={cat.color} size={26} />
                </Ring>
                <div style={{ minWidth: 0 }}>
                  <div className="k-tile-title k-ellip" style={{ fontSize: 13.5 }}>{cat.name}</div>
                  <div className={`k-tile-sub k-state-${c.state === "ok" ? "" : c.state}`} style={{ fontWeight: 700 }}>
                    {pct(c.ratio)}
                  </div>
                  <div className="k-tile-sub k-ellip"><Amt>{formatMoney(c.spent, "TRY", { hideZeroDecimals: true })}</Amt> / <Amt>{formatMoney(c.limit, "TRY", { hideZeroDecimals: true })}</Amt></div>
                </div>
              </button>
            );
          })}
          <button type="button" className="k-card calm b-1x1" onClick={() => setPick(true)} disabled={!free.length}>
            <span className="k-tile-ico"><Plus size={18} /></span>
            <span className="k-tile-title" style={{ fontSize: 13.5 }}>Kategori bütçesi ekle</span>
          </button>

          <section className="k-card accent b-3x1" style={{ "--wt": 6 }} aria-label="Bütçe ayarları">
            <div className="k-cap">Dönem ve hesap</div>
            <div className="k-row-between">
              <div>
                <div className="k-tile-title">Ay başlangıç günü</div>
                <div className="k-tile-sub">Maaş gününü seç; bütçe o gün yenilenir</div>
              </div>
              <div className="k-stepper">
                <button type="button" className="k-icon-btn" onClick={() => k.saveBudget({ startDay: Math.max(1, st.startDay - 1) })} disabled={st.startDay <= 1} aria-label="Bir gün azalt">−</button>
                <b>{st.startDay}</b>
                <button type="button" className="k-icon-btn" onClick={() => k.saveBudget({ startDay: Math.min(28, st.startDay + 1) })} disabled={st.startDay >= 28} aria-label="Bir gün artır">+</button>
              </div>
            </div>
            <label className="k-switch-row" style={{ marginTop: 4 }}>
              <span><b>Planlı ödemeleri düş</b><small>Taksit ve abonelikler günlük tutardan önce ayrılır</small></span>
              <input type="checkbox" checked={k.budget.includePlanned !== false} onChange={(e) => k.saveBudget({ includePlanned: e.target.checked })} />
              <i aria-hidden="true" />
            </label>
          </section>
        </div>
      </div>

      {edit?.type === "total" && (
        <AmountSheet title="Aylık bütçe" initialMinor={k.budget.monthlyMinor} onSubmit={(v) => k.saveBudget({ monthlyMinor: v })} onRemove={k.budget.monthlyMinor ? () => k.saveBudget({ monthlyMinor: 0 }) : undefined} removeLabel="Bütçeyi kaldır" onClose={() => setEdit(null)} />
      )}
      {edit?.type === "cat" && (
        <AmountSheet title={`${k.catById(edit.id).name} bütçesi`} initialMinor={edit.limit || 0} onSubmit={(v) => setCat(edit.id, v)} onRemove={() => delCat(edit.id)} removeLabel="Bu kategori bütçesini kaldır" onClose={() => setEdit(null)} />
      )}
      {pick && (
        <Sheet open onClose={() => setPick(false)} title="Hangi kategori?" size="sm">
          <div className="k-card-list" style={{ margin: "0 16px 20px" }}>
            {free.map((c) => (
              <button key={c.id} type="button" className="k-manage-row" onClick={() => { setPick(false); setEdit({ type: "cat", id: c.id, limit: 0 }); }}>
                <Bubble icon={c.icon} color={c.color} size={36} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {!st.hasBudget && cats.length === 0 && <p className="k-hint" style={{ textAlign: "center", marginTop: 18 }}><Wallet size={14} style={{ verticalAlign: -2 }} /> Kategori bütçeleri genel bütçeden bağımsızdır.</p>}
    </Page>
  );
}
