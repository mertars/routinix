import { useMemo, useRef, useState } from "react";
import { BarChart3, Calendar as CalIcon, ChevronLeft, ChevronRight, CreditCard, Download, Share2, Store, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Page, Bar } from "../ui/parts";
import { Amt } from "../ui/Amt";
import { Donut, LineChart, Heatmap } from "../ui/charts";
import ReportCard from "../ui/ReportCard";
import Sheet from "../ui/Sheet";
import TxRow from "../ui/TxRow";
import { Bubble } from "../ui/icons";
import { EmptyState, Segmented } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { useFinance } from "../state/derived";
import { accountTotals, categoryBreakdown, compareText, comparePeriods, dailyTotals, heatmap, insights, trendSeries } from "../model/analytics";
import { emptyFilter } from "../model/filters";
import { formatCompact, formatMoney, formatMoneyText } from "../model/money";
import { addDays, dayLabel, daysBetween, dayKey, periodLabel, periodRange, shiftPeriod, shortDate, startOfDay } from "../model/dates";

const WD = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const TREND = [{ value: "day", label: "Günlük" }, { value: "week", label: "Haftalık" }, { value: "month", label: "Aylık" }];

function DayList({ day, txs, onOpen }) {
  const list = txs.filter((t) => dayKey(t.occurredAt) === day);
  const sum = list.reduce((s, t) => s + (t.kind === "expense" ? t.baseMinor ?? t.amountMinor : 0), 0);
  const ts = list[0]?.occurredAt ?? new Date(day + "T12:00:00").getTime();
  return (
    <div>
      <div className="k-row-between" style={{ margin: "2px 4px 10px" }}>
        <b style={{ fontSize: 17 }}>{dayLabel(ts)}</b>
        <b className="k-num md"><Amt>{formatMoney(sum, "TRY", { hideZeroDecimals: true })}</Amt></b>
      </div>
      {list.length ? <div className="k-card-list">{list.map((t) => <TxRow key={t.id} tx={t} onClick={() => onOpen(t)} />)}</div> : <p className="k-hint" style={{ textAlign: "center", padding: "16px 0" }}>Bu gün kayıt yok.</p>}
    </div>
  );
}

export default function AnalysisPage() {
  const k = useKesem();
  const app = useApp();
  const f = useFinance();
  const startDay = k.budget.startDay;
  const [periodTs, setPeriodTs] = useState(Date.now());
  const [mode, setMode] = useState("day");
  const [catSel, setCatSel] = useState(null);
  const [day, setDay] = useState(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [report, setReport] = useState(false);
  const [from, to] = periodRange(periodTs, startDay);
  const isNow = periodRange(Date.now(), startDay)[0] === from;
  const refNow = isNow ? Date.now() : to - 1;
  const txs = k.transactions;

  const A = useMemo(() => {
    const brk = categoryBreakdown(txs, from, to, k.rates);
    return {
      daily: dailyTotals(txs, from, to, k.rates),
      brk,
      trend: trendSeries(txs, mode, isNow ? Date.now() : to - 1, k.rates, startDay),
      heat: heatmap(txs, from, to, k.rates),
      cmp: comparePeriods(txs, refNow, startDay, k.rates),
      ins: insights(txs, from, to, refNow, k.rates),
      acc: accountTotals(txs, from, to, k.rates),
    };
  }, [txs, from, to, mode, k.rates, startDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const income = useMemo(() => txs.reduce((s, t) => (t.kind === "income" && t.occurredAt >= from && t.occurredAt < to ? s + (t.baseMinor ?? t.amountMinor) : s), 0), [txs, from, to]);
  const slices = A.brk.rows.map((r) => {
    if (r.categoryId === "__other") return { id: "__other", label: "Diğer", value: r.value, share: r.share, color: "stone", icon: "dots" };
    const c = k.catById(r.categoryId);
    return { id: r.categoryId, label: c.name, value: r.value, share: r.share, color: c.color, icon: c.icon };
  });
  const maxDay = Math.max(1, ...[...A.daily.values()].map((d) => d.expense));
  const cmpText = compareText(A.cmp.pct);
  const cmpState = A.cmp.pct == null ? null : A.cmp.pct <= 0 ? "ok" : "near";
  const hasData = A.ins.count > 0;

  // takvim: dönemin günleri, haftanın gününe hizalı
  const cells = useMemo(() => {
    const n = daysBetween(from, to);
    const lead = (new Date(from).getDay() + 6) % 7;
    const out = Array.from({ length: lead }, (_, i) => ({ blank: true, key: `b${i}` }));
    const today = startOfDay(Date.now());
    for (let i = 0; i < n; i++) {
      const ts = addDays(from, i);
      const key = dayKey(ts);
      out.push({ ts, key, d: new Date(ts).getDate(), v: A.daily.get(key)?.expense || 0, count: A.daily.get(key)?.count || 0, today: ts === today });
    }
    return out;
  }, [from, to, A.daily]);

  const openDay = (key) => { setDay(key); if (!app.isTablet) setDayOpen(true); };
  const openTx = (t) => { setDayOpen(false); app.navigate(`harcamalar/${t.id}`); };
  const goCard = (accountId) => { app.setExpFilter({ ...emptyFilter(), accountIds: [accountId], from: from, to: to - 86400000 }); app.navigate("harcamalar"); };

  const heroNode = (
    <section className="k-card hero" aria-label="Dönem özeti">
      <div className="k-cap">Toplam harcama</div>
      <div className="k-num xl"><Amt>{formatMoney(A.ins.total, "TRY", { hideZeroDecimals: true })}</Amt></div>
      <div className="k-row-between" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
        {cmpText ? <span className={`k-pill ${cmpState}`}>{A.cmp.pct <= 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}{cmpText}</span> : <span className="k-muted" style={{ fontSize: 13 }}>Karşılaştırma için geçen dönem verisi yok</span>}
        <span className="k-muted" style={{ fontSize: 12.5 }}>aynı gün sayısına göre</span>
      </div>
      <div className="k-hero-row2">
        <div><span>Gelir</span><b><Amt>{formatMoney(income, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
        <div><span>Günlük ort.</span><b><Amt>{formatMoney(A.ins.avgDaily, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
        <div><span>İşlem</span><b>{A.ins.count}</b></div>
      </div>
    </section>
  );

  const calNode = (
    <section className="k-card" aria-label="Takvim görünümü">
      <div className="k-cap"><CalIcon size={14} /> Günlük harcama takvimi</div>
      <div className="k-cal k-cal-days" role="grid" aria-label="Günlük harcama toplamları">
        {WD.map((d) => <b key={d}>{d}</b>)}
        {cells.map((c) => c.blank ? <span key={c.key} /> : (
          <button key={c.key} type="button" role="gridcell" className={`k-cal-cell ${c.today ? "today" : ""} ${day === c.key ? "sel" : ""}`} style={{ "--i": c.v ? Math.max(0.1, c.v / maxDay) : 0 }} onClick={() => openDay(c.key)}
            aria-label={`${shortDate(c.ts)}: ${c.count ? `${c.count} harcama, ${formatMoneyText(c.v)}` : "harcama yok"}`}>
            <i>{c.d}</i>
            <em>{c.v ? <Amt>{formatCompact(c.v)}</Amt> : ""}</em>
          </button>
        ))}
      </div>
    </section>
  );

  const donutNode = (
    <section className="k-card">
      <div className="k-cap"><BarChart3 size={14} /> Kategori dağılımı</div>
      {slices.length ? (
        <div className="k-donut-row">
          <Donut slices={slices} total={A.brk.total} selected={catSel} onSelect={setCatSel} />
          <ul className="k-legend">
            {slices.map((s) => (
              <li key={s.id}>
                <button type="button" aria-pressed={catSel === s.id} onClick={() => setCatSel(catSel === s.id ? null : s.id)} className={catSel === s.id ? "on" : ""}>
                  <i style={{ background: `var(--kc-${s.color})` }} />
                  <span className="k-ellip">{s.label}</span>
                  <b>%{Math.round(s.share * 100)}</b>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="k-hint">Bu dönemde harcama yok.</p>}
    </section>
  );

  const topCat = A.ins.topCategory ? k.catById(A.ins.topCategory.categoryId) : null;
  const tilesNode = (
    <>
      <div className="k-card accent b-1x1">
        <div className="k-cap"><Trophy size={14} /> En çok</div>
        {topCat ? <><b className="k-tile-title k-ellip" style={{ fontSize: 14 }}>{topCat.name}</b><span className="k-tile-sub"><Amt>{formatMoney(A.ins.topCategory.value, "TRY", { hideZeroDecimals: true })}</Amt></span></> : <span className="k-tile-sub">—</span>}
      </div>
      <div className="k-card calm b-1x1">
        <div className="k-cap">En pahalı gün</div>
        {A.ins.priciestDay ? <><b className="k-tile-title" style={{ fontSize: 14 }}>{shortDate(new Date(A.ins.priciestDay.dayKey + "T12:00:00").getTime())}</b><span className="k-tile-sub"><Amt>{formatMoney(A.ins.priciestDay.value, "TRY", { hideZeroDecimals: true })}</Amt></span></> : <span className="k-tile-sub">—</span>}
      </div>
      <div className="k-card calm b-1x1">
        <div className="k-cap">Günlük ort.</div>
        <b className="k-num md"><Amt>{formatMoney(A.ins.avgDaily, "TRY", { hideZeroDecimals: true })}</Amt></b>
        <span className="k-tile-sub">{A.ins.elapsed} gün</span>
      </div>
      <div className="k-card accent b-3x1" style={{ "--wt": 6 }}>
        <div className="k-cap"><Store size={14} /> En sık gidilen yer</div>
        {A.ins.topMerchant ? <div className="k-row-between"><b style={{ fontSize: 17 }} className="k-ellip">{A.ins.topMerchant.name}</b><span className="k-tile-sub">{A.ins.topMerchant.count} kez · <Amt>{formatMoney(A.ins.topMerchant.total, "TRY", { hideZeroDecimals: true })}</Amt></span></div> : <span className="k-tile-sub">Yer adı girdikçe burada görünür.</span>}
      </div>
    </>
  );

  const trendNode = (
    <section className="k-card">
      <div className="k-row-between"><div className="k-cap">Trend</div></div>
      <Segmented value={mode} onChange={setMode} options={TREND} label="Trend aralığı" />
      <LineChart points={A.trend} ariaLabel={`${TREND.find((x) => x.value === mode).label} harcama trendi`} />
    </section>
  );

  const heatNode = (
    <section className="k-card">
      <div className="k-cap">Ne zaman harcıyorsun?</div>
      <Heatmap cells={A.heat.cells} max={A.heat.max} />
    </section>
  );

  const cardsNode = (
    <section className="k-card calm" aria-label="Kart bazlı görünüm">
      <div className="k-cap"><CreditCard size={14} /> Kart ve ödeme yöntemi</div>
      {A.acc.rows.length ? (
        <div className="k-stack" style={{ gap: 12 }}>
          {A.acc.rows.map((r) => {
            const a = k.accById(r.accountId);
            return (
              <button key={r.accountId || "x"} type="button" className="k-acc-row" onClick={() => r.accountId && goCard(r.accountId)}>
                <Bubble icon={a.type === "cash" ? "cash" : a.type === "card" ? "card" : "wallet"} color={a.color} size={36} />
                <span className="k-grow" style={{ minWidth: 0 }}>
                  <span className="k-row-between"><b className="k-ellip">{a.name}</b><b style={{ fontVariantNumeric: "tabular-nums" }}><Amt>{formatMoney(r.value, "TRY", { hideZeroDecimals: true })}</Amt></b></span>
                  <Bar value={r.share} />
                </span>
              </button>
            );
          })}
        </div>
      ) : <p className="k-hint">Bu dönemde harcama yok.</p>}
    </section>
  );

  const reportBtn = (
    <button type="button" className="k-card accent k-report-cta" onClick={() => setReport(true)}>
      <span className="k-tile-ico"><Share2 size={18} /></span>
      <span><b className="k-tile-title">Aylık rapor kartı</b><span className="k-tile-sub" style={{ display: "block" }}>Görsel olarak kaydet ve paylaş</span></span>
    </button>
  );

  const nav = (
    <div className="k-month" style={{ marginBottom: 12 }}>
      <button type="button" className="k-icon-btn" onClick={() => setPeriodTs(shiftPeriod(periodTs, -1, startDay))} aria-label="Önceki dönem"><ChevronLeft size={18} /></button>
      <button type="button" className="k-month-label" onClick={() => setPeriodTs(Date.now())} disabled={isNow} aria-label="Bu döneme dön">{periodLabel(periodTs, startDay)}</button>
      <button type="button" className="k-icon-btn" onClick={() => setPeriodTs(shiftPeriod(periodTs, 1, startDay))} disabled={isNow} aria-label="Sonraki dönem"><ChevronRight size={18} /></button>
    </div>
  );

  const reportSheet = report && (
    <ReportSheet onClose={() => setReport(false)} label={periodLabel(periodTs, startDay)} total={A.ins.total} compare={cmpText} slices={slices.filter((s) => s.id !== "__other").slice(0, 4)} insights={A.ins} budget={isNow && f.status.hasBudget ? f.status.ratio : 0} streak={f.streak.current} income={income} />
  );

  if (!hasData && !txs.length) {
    return (
      <Page title="Analiz" subtitle="Harcamalarını anla">
        <EmptyState icon={<BarChart3 size={32} />} title="Analiz için kayıt gerekli" text="İlk harcamalarını ekledikçe kategori dağılımı, trend, takvim ve akıllı özetler burada belirir." action={<button type="button" className="k-btn primary" onClick={() => app.openAdd({})}>İlk harcamayı ekle</button>} />
      </Page>
    );
  }

  const dayNode = day && <DayList day={day} txs={txs} onOpen={openTx} />;
  const phoneBody = (
    <>
      {heroNode}
      <div className="k-gap">{calNode}</div>
      <div className="k-bento-wrap k-gap"><div className="k-bento"><div className="b-3x1 k-bento-span">{donutNode}</div>{tilesNode}</div></div>
      <div className="k-gap">{trendNode}</div>
      <div className="k-gap">{heatNode}</div>
      <div className="k-gap">{cardsNode}</div>
      <div className="k-gap">{reportBtn}</div>
    </>
  );
  const tabletBody = (
    <div className="k-an-cols">
      <div className="k-an-left">
        {heroNode}
        <div className="k-gap">{calNode}</div>
        {day && <div className="k-gap k-card calm">{dayNode}</div>}
      </div>
      <div className="k-an-right">
        <div className="k-bento-wrap"><div className="k-bento"><div className="b-3x1 k-bento-span">{donutNode}</div>{tilesNode}</div></div>
        <div className="k-gap">{trendNode}</div>
        <div className="k-gap">{heatNode}</div>
        <div className="k-gap">{cardsNode}</div>
        <div className="k-gap">{reportBtn}</div>
      </div>
    </div>
  );

  return (
    <Page title="Analiz" subtitle={periodLabel(periodTs, startDay)}>
      {nav}
      {app.isTablet ? tabletBody : phoneBody}
      {dayOpen && day && <Sheet open onClose={() => setDayOpen(false)} title="Günün harcamaları" size="md"><div style={{ padding: "0 16px 24px" }}>{dayNode}</div></Sheet>}
      {reportSheet}
    </Page>
  );
}

function ReportSheet({ onClose, ...props }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const render = async () => {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(ref.current, { pixelRatio: 3, cacheBust: true });
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], `harcama-raporu-${props.label.replace(/\s+/g, "-")}.png`, { type: "image/png" });
  };
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const file = await render();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      setMsg("Görsel kaydedildi.");
    } catch { setMsg("Görsel oluşturulamadı. Tekrar dene."); }
    setBusy(false);
  };
  const share = async () => {
    setBusy(true); setMsg("");
    try {
      const file = await render();
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Aylık harcama raporum" });
      else setMsg("Bu cihaz paylaşımı desteklemiyor; “Görsel olarak kaydet”i kullan.");
    } catch (e) { if (e?.name !== "AbortError") setMsg("Paylaşılamadı."); }
    setBusy(false);
  };
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  return (
    <Sheet open onClose={onClose} title="Aylık rapor" size="md">
      <div style={{ padding: "0 16px 24px" }}>
        <div className="k-report-wrap"><ReportCard ref={ref} {...props} top={props.slices} /></div>
        <div className="k-actions" style={{ gridTemplateColumns: canShare ? "1fr 1fr" : "1fr" }}>
          <button type="button" className="k-btn primary" onClick={save} disabled={busy}><Download size={17} /> Görsel olarak kaydet</button>
          {canShare && <button type="button" className="k-btn tonal" onClick={share} disabled={busy}><Share2 size={17} /> Paylaş</button>}
        </div>
        {msg && <p className="k-hint" role="status" style={{ textAlign: "center" }}>{msg}</p>}
      </div>
    </Sheet>
  );
}
