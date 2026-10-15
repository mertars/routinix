import { useMemo, useState } from "react";
import { Amt } from "../ui/Amt";
import { CalendarClock, ChevronLeft, ChevronRight, Check, SkipForward } from "lucide-react";
import { Page } from "../ui/parts";
import { Bubble } from "../ui/icons";
import { EmptyState } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { useFinance } from "../state/derived";
import { formatMoney } from "../model/money";
import { dayKey, monthLabel, relativeDayLabel, shiftMonth, shortDate, startOfDay } from "../model/dates";

const WD = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
export const KIND_ICON = { installment: "card", recurring: "receipt", debt: "wallet" };

export function UpcomingRow({ it, onOpen }) {
  const k = useKesem();
  const late = it.status === "overdue";
  return (
    <div className="k-line-item" style={{ padding: "9px 14px" }}>
      <button type="button" className="k-line-item k-grow" style={{ textAlign: "left" }} onClick={onOpen}>
        <Bubble icon={KIND_ICON[it.kind] || "wallet"} color={it.kind === "debt" ? "sky" : it.kind === "installment" ? "indigo" : "amber"} size={38} />
        <span className="k-grow" style={{ minWidth: 0 }}>
          <span className="k-ellip" style={{ display: "block", fontWeight: 650 }}>{it.title}{it.kind === "installment" ? ` · ${it.index + 1}/${it.count}` : ""}</span>
          <span className={`k-tile-sub ${late ? "k-state-over" : it.status === "soon" || it.status === "today" ? "k-state-near" : ""}`} style={it.status !== "later" ? { fontWeight: 700 } : {}}>
            {shortDate(it.dateTs)} · {relativeDayLabel(it.days)}
          </span>
        </span>
        <b style={{ fontVariantNumeric: "tabular-nums" }}><Amt>{formatMoney(it.amountMinor, it.currency, { hideZeroDecimals: true })}</Amt></b>
      </button>
      {it.kind === "recurring" && !it.autoPost && (
        <>
          <button type="button" className="k-btn primary sm" onClick={() => k.payOccurrence(it)} aria-label={`${it.title} ödendi`}><Check size={15} /> Öde</button>
          <button type="button" className="k-icon-btn sm" onClick={() => k.skipOccurrence(it)} aria-label="Bu ödemeyi atla"><SkipForward size={14} /></button>
        </>
      )}
    </div>
  );
}

export default function CalendarPage({ onBack }) {
  const app = useApp();
  const f = useFinance();
  const [off, setOff] = useState(0);
  const items = f.planned;
  const first = items.find((i) => i.kind !== "debt") || items[0];
  const base = shiftMonth(f.now, off);
  const grid = useMemo(() => {
    const d = new Date(base);
    const y = d.getFullYear();
    const m = d.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const has = new Set(items.map((i) => dayKey(i.dateTs)));
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push({ blank: true, key: `b${i}` });
    for (let n = 1; n <= days; n++) {
      const ts = new Date(y, m, n).getTime();
      cells.push({ n, ts, has: has.has(dayKey(ts)), today: startOfDay(f.now) === ts, key: n });
    }
    return cells;
  }, [base, items, f.now]);
  const open = (it) => app.navigate(it.kind === "installment" ? `daha-fazla/taksitler/${it.planId}` : it.kind === "recurring" ? `daha-fazla/abonelikler/${it.ruleId}` : `daha-fazla/borclar`);
  const overdue = items.filter((i) => i.status === "overdue");
  const week = items.filter((i) => i.status !== "overdue" && i.days <= 7);
  const later = items.filter((i) => i.days > 7);

  return (
    <Page title="Takvim" subtitle="Yaklaşan ödemeler" onBack={onBack}>
      <div className="k-bento-wrap">
        <div className="k-bento">
          <section className="k-card hero b-3x1" aria-label="Sıradaki ödeme">
            {first ? (
              <>
                <div className="k-cap">{first.status === "overdue" ? "Gecikmiş ödeme" : "Sıradaki ödeme"}</div>
                <div className="k-num lg k-ellip">{first.title}</div>
                <div className="k-row-between" style={{ marginTop: 6 }}>
                  <b className="k-num md"><Amt>{formatMoney(first.amountMinor, first.currency, { hideZeroDecimals: true })}</Amt></b>
                  <span className={`k-pill ${first.status === "overdue" ? "over" : first.status === "later" ? "" : "near"}`}>{relativeDayLabel(first.days)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="k-cap">Sıradaki ödeme</div>
                <div className="k-num lg">Yaklaşan ödeme yok</div>
                <p className="k-muted" style={{ fontSize: 13.5 }}>Abonelik, fatura veya taksit eklediğinde burada görünür.</p>
              </>
            )}
          </section>
          <section className="k-card b-3x2" style={{ "--wt": 3 }} aria-label="Ay takvimi">
            <div className="k-row-between">
              <button type="button" className="k-icon-btn sm" onClick={() => setOff(off - 1)} aria-label="Önceki ay"><ChevronLeft size={16} /></button>
              <b>{monthLabel(base)}</b>
              <button type="button" className="k-icon-btn sm" onClick={() => setOff(off + 1)} aria-label="Sonraki ay"><ChevronRight size={16} /></button>
            </div>
            <div className="k-cal" role="grid" aria-label="Ödeme günleri">
              {WD.map((d) => <b key={d}>{d}</b>)}
              {grid.map((c) => c.blank ? <span key={c.key} /> : <span key={c.key} className={`${c.today ? "today" : ""} ${c.has ? "has" : ""}`} aria-label={`${c.n}${c.has ? ", ödeme var" : ""}`}>{c.n}</span>)}
            </div>
          </section>
          <section className="k-card accent b-3x1" style={{ "--wt": 3, "--ht": 2 }}>
            <div className="k-cap">Özet</div>
            <div className="k-row-between"><span>Gecikmiş</span><b className={overdue.length ? "k-state-over" : ""}>{overdue.length}</b></div>
            <div className="k-row-between"><span>Bu hafta</span><b>{week.length}</b></div>
            <div className="k-row-between"><span>Daha sonra</span><b>{later.length}</b></div>
          </section>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<CalendarClock size={30} />} title="Takvim boş" text="Fatura ve abonelikleri “Abonelikler”den, taksitli alışverişi harcama ekranından ekleyebilirsin." />
      ) : (
        [["Gecikmiş", overdue], ["Bu hafta", week], ["Daha sonra", later]].filter(([, l]) => l.length).map(([t, l]) => (
          <div key={t}>
            <div className="k-section-title">{t}</div>
            <div className="k-card-list">{l.map((it) => <UpcomingRow key={it.id} it={it} onOpen={() => open(it)} />)}</div>
          </div>
        ))
      )}
    </Page>
  );
}
