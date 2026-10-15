import { useEffect, useMemo, useRef, useState } from "react";
import { Amt } from "../ui/Amt";
import { ChevronLeft, ChevronRight, Copy, Edit3, Receipt, Repeat, Search, SlidersHorizontal, Trash2, X, Zap } from "lucide-react";
import FilterSheet from "../ui/FilterSheet";
import { applyFilter, activeFilterCount, emptyFilter, isGlobalScope } from "../model/filters";
import PageHeader from "../ui/PageHeader";
import TxRow from "../ui/TxRow";
import { Bubble } from "../ui/icons";
import { EmptyState, Segmented, UndoRedoButtons } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { groupByDay, totals } from "../model/stats";
import { formatMoney, formatMoneyText } from "../model/money";
import { dayKey, dayLabel, fullDateTime, periodLabel, periodRange, shiftPeriod, shortDate } from "../model/dates";

const FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "expense", label: "Gider" },
  { value: "income", label: "Gelir" },
];

export function TxDetail({ id, onBack }) {
  const k = useKesem();
  const app = useApp();
  const tx = k.txById(id);
  const [img, setImg] = useState(null);
  const [big, setBig] = useState(false);

  useEffect(() => {
    let url;
    let alive = true;
    setImg(null);
    if (tx?.receiptId)
      k.getBlob(tx.receiptId).then((r) => {
        if (alive && r?.blob) {
          url = URL.createObjectURL(r.blob);
          setImg(url);
        }
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [tx?.receiptId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tx || tx.deletedAt) {
    return (
      <div className="k-page">
        <PageHeader title="Kayıt" onBack={onBack} />
        <EmptyState icon={<Receipt size={30} />} title="Kayıt bulunamadı" text="Silinmiş ya da taşınmış olabilir." />
      </div>
    );
  }
  const cat = k.catById(tx.categoryId);
  const sub = tx.subcategoryId ? k.catById(tx.subcategoryId) : null;
  const acc = k.accById(tx.accountId);
  const income = tx.kind === "income";
  const tags = (tx.tagIds || []).map((i) => k.tagById(i)).filter(Boolean);

  return (
    <div className="k-page">
      <PageHeader title={tx.merchant || sub?.name || cat.name} subtitle={fullDateTime(tx.occurredAt)} onBack={onBack} right={<UndoRedoButtons />} />
      <section className="k-card hero k-detail-card" style={{ "--c": `var(--kc-${cat.color})` }}>
        <Bubble icon={cat.icon} color={cat.color} size={56} />
        <strong className={`k-num xl ${income ? "k-state-ok" : ""}`}><Amt>{formatMoney(income ? tx.amountMinor : -tx.amountMinor, tx.currency)}</Amt></strong>
        <span className="k-muted">
          {income ? "Gelir" : "Gider"} · {cat.name}
          {sub ? ` › ${sub.name}` : ""}
        </span>
      </section>
      <dl className="k-facts">
        <div>
          <dt>Ödeme</dt>
          <dd>{acc.name}</dd>
        </div>
        <div>
          <dt>Tarih ve saat</dt>
          <dd>{fullDateTime(tx.occurredAt)}</dd>
        </div>
        {tx.merchant && (
          <div>
            <dt>Yer</dt>
            <dd>{tx.merchant}</dd>
          </div>
        )}
        {tx.note && (
          <div>
            <dt>Not</dt>
            <dd>{tx.note}</dd>
          </div>
        )}
        {tags.length > 0 && (
          <div>
            <dt>Etiketler</dt>
            <dd className="k-chips wrap">
              {tags.map((t) => (
                <span key={t.id} className="k-chip sm plain">
                  #{t.name}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      {img && (
        <button type="button" className="k-receipt-view" onClick={() => setBig(true)} aria-label="Fişi büyüt">
          <img src={img} alt="Fiş fotoğrafı" />
        </button>
      )}
      {big && img && (
        <div className="k-lightbox" onClick={() => setBig(false)} role="dialog" aria-label="Fiş">
          <img src={img} alt="Fiş fotoğrafı" />
          <button type="button" className="k-icon-btn" aria-label="Kapat">
            <X size={20} />
          </button>
        </div>
      )}
      <div className="k-actions">
        <button type="button" className="k-btn primary" onClick={() => app.openAdd({ editId: tx.id, initial: tx })}>
          <Edit3 size={17} /> Düzenle
        </button>
        <button type="button" className="k-btn tonal" onClick={() => k.repeatTransaction(tx)}>
          <Repeat size={17} /> Tekrarla
        </button>
        <button type="button" className="k-btn tonal" onClick={() => app.openAdd({ initial: { ...tx, occurredAt: undefined, receiptId: null } })}>
          <Copy size={17} /> Düzenleyerek tekrarla
        </button>
        <button
          type="button"
          className="k-btn tonal"
          onClick={() =>
            app.openTemplate({ initial: { name: (tx.merchant || sub?.name || cat.name).slice(0, 28), kind: tx.kind, amountMinor: tx.amountMinor, categoryId: tx.categoryId, subcategoryId: tx.subcategoryId, accountId: tx.accountId, merchant: tx.merchant, note: tx.note, tagIds: tx.tagIds, quick: true } })
          }
        >
          <Zap size={17} /> Kısayol yap
        </button>
        <button
          type="button"
          className="k-btn danger-ghost"
          onClick={async () => {
            await k.deleteTransaction(tx.id);
            onBack?.();
          }}
        >
          <Trash2 size={17} /> Sil
        </button>
      </div>
      <div className="k-page-end" />
    </div>
  );
}

const DAY_CHUNK = 20; // kademeli yükleme: yüzlerce kayıtta liste akıcı kalır

export default function ExpensesPage({ selectedId }) {
  const k = useKesem();
  const app = useApp();
  const f = app.expFilter;
  const setF = app.setExpFilter;
  const [monthTs, setMonthTs] = useState(Date.now());
  const [filterOpen, setFilterOpen] = useState(false);
  const [limit, setLimit] = useState(DAY_CHUNK);
  const startDay = k.budget.startDay;
  const range = periodRange(monthTs, startDay);
  const isNow = periodRange(Date.now(), startDay)[0] === range[0];
  const global = isGlobalScope(f);
  const nFilters = activeFilterCount({ ...f, query: "", kind: "all" });

  const list = useMemo(() => {
    const base = global ? k.transactions : k.transactions.filter((t) => t.occurredAt >= range[0] && t.occurredAt < range[1]);
    return applyFilter(base, f, { catName: (id) => k.catById(id).name, accName: (id) => k.accById(id).name, tagName: (id) => k.tagById(id)?.name, rates: k.rates });
  }, [k.transactions, range[0], f, global, k.rates]); // eslint-disable-line react-hooks/exhaustive-deps
  const sums = useMemo(() => totals(list, undefined, k.rates), [list, k.rates]);
  const groups = useMemo(() => groupByDay(list, dayKey), [list]);
  useEffect(() => setLimit(DAY_CHUNK), [list]);
  const shown = groups.slice(0, limit);
  const sentinel = useRef(null);
  useEffect(() => {
    if (!sentinel.current || limit >= groups.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + DAY_CHUNK), { rootMargin: "400px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [limit, groups.length]);

  // Etkin filtre özet çipleri (× ile tek tek kaldırılır)
  const money = (m) => formatMoneyText(m, "TRY", { hideZeroDecimals: true });
  const chips = [];
  if (f.min != null || f.max != null) chips.push({ key: "amt", label: f.min != null && f.max != null ? `${money(f.min)} – ${money(f.max)}` : f.min != null ? `≥ ${money(f.min)}` : `≤ ${money(f.max)}`, clear: { min: null, max: null } });
  if (f.from != null || f.to != null) chips.push({ key: "date", label: `${f.from != null ? shortDate(f.from) : "…"} – ${f.to != null ? shortDate(f.to) : "…"}`, clear: { from: null, to: null } });
  f.categoryIds.forEach((id) => chips.push({ key: "c" + id, label: k.catById(id).name, clear: { categoryIds: f.categoryIds.filter((x) => x !== id) } }));
  f.accountIds.forEach((id) => chips.push({ key: "a" + id, label: k.accById(id).name, clear: { accountIds: f.accountIds.filter((x) => x !== id) } }));
  f.tagIds.forEach((id) => chips.push({ key: "t" + id, label: "#" + (k.tagById(id)?.name || "?"), clear: { tagIds: f.tagIds.filter((x) => x !== id) } }));

  const master = (
    <div className="k-page">
      <PageHeader title="Harcamalar" subtitle={global ? "Filtre sonuçları (tüm tarihler)" : periodLabel(monthTs, startDay)} right={<UndoRedoButtons />} />
      <section className="k-card hero" aria-label="Liste özeti">
        <div className="k-row-between" style={{ alignItems: "flex-end" }}>
          <div>
            <div className="k-cap">{f.kind === "income" ? "Toplam gelir" : "Toplam gider"}</div>
            <div className="k-num xl"><Amt>{formatMoney(f.kind === "income" ? sums.income : sums.expense, "TRY", { hideZeroDecimals: true })}</Amt></div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="k-cap">{f.kind === "all" ? "Gelir" : "Kayıt"}</div>
            <b className="k-num md">{f.kind === "all" ? <Amt>{formatMoney(sums.income, "TRY", { hideZeroDecimals: true })}</Amt> : list.length}</b>
          </div>
        </div>
      </section>
      <div className="k-toolbar k-gap">
        {!global && (
          <div className="k-month">
            <button type="button" className="k-icon-btn" onClick={() => setMonthTs(shiftPeriod(monthTs, -1, startDay))} aria-label="Önceki dönem"><ChevronLeft size={18} /></button>
            <button type="button" className="k-month-label" onClick={() => setMonthTs(Date.now())} disabled={isNow} aria-label="Bu döneme dön">{periodLabel(monthTs, startDay)}</button>
            <button type="button" className="k-icon-btn" onClick={() => setMonthTs(shiftPeriod(monthTs, 1, startDay))} disabled={isNow} aria-label="Sonraki dönem"><ChevronRight size={18} /></button>
          </div>
        )}
        <div className="k-row-between" style={{ gap: 8 }}>
          <label className="k-search" style={{ flex: 1 }}>
            <Search size={16} />
            <input value={f.query} onChange={(e) => setF({ ...f, query: e.target.value })} placeholder="Ara: yer, not, kategori, etiket" aria-label="Ara" enterKeyHint="search" />
            {f.query && <button type="button" className="k-clear" onClick={() => setF({ ...f, query: "" })} aria-label="Aramayı temizle"><X size={14} /></button>}
          </label>
          <button type="button" className={`k-icon-btn k-filter-btn ${nFilters ? "on" : ""}`} onClick={() => setFilterOpen(true)} aria-label={`Filtrele${nFilters ? `, ${nFilters} etkin` : ""}`}>
            <SlidersHorizontal size={18} />{nFilters > 0 && <i>{nFilters}</i>}
          </button>
        </div>
        <Segmented value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={FILTERS} label="Tür" />
        {chips.length > 0 && (
          <div className="k-chips wrap" aria-label="Etkin filtreler">
            {chips.map((c) => <button key={c.key} type="button" className="k-chip sm on" onClick={() => setF({ ...f, ...c.clear })} aria-label={`${c.label} filtresini kaldır`}>{c.label}<X size={12} /></button>)}
            <button type="button" className="k-chip sm" onClick={() => setF(emptyFilter())}>Tümünü temizle</button>
          </div>
        )}
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={<Receipt size={30} />} title={global ? "Sonuç bulunamadı" : "Bu dönemde kayıt yok"} text={global ? "Filtreleri gevşetmeyi ya da farklı bir kelime denemeyi dene." : "Yeni bir kayıt eklemek için + tuşuna dokun."} action={global ? <button type="button" className="k-btn tonal" onClick={() => setF(emptyFilter())}>Filtreleri temizle</button> : undefined} />
      ) : (
        <>
          {shown.map((g) => {
            const dt = totals(g.items, undefined, k.rates);
            return (
              <section key={g.key} className="k-day" aria-label={dayLabel(g.ts)}>
                <div className="k-day-head">
                  <h3>{dayLabel(g.ts)}</h3>
                  <span><Amt>{dt.expense ? formatMoney(-dt.expense) : formatMoney(dt.income, "TRY", { sign: true })}</Amt></span>
                </div>
                <div className="k-card-list">
                  {g.items.map((t) => (
                    <TxRow key={t.id} tx={t} active={t.id === selectedId} onClick={() => app.navigate(`harcamalar/${t.id}`, { replace: app.isTablet && !!selectedId })} />
                  ))}
                </div>
              </section>
            );
          })}
          {limit < groups.length && (
            <div ref={sentinel} style={{ textAlign: "center", padding: 12 }}>
              <button type="button" className="k-btn tonal sm" onClick={() => setLimit((l) => l + DAY_CHUNK)}>Daha fazla göster ({groups.length - limit} gün)</button>
            </div>
          )}
        </>
      )}
      <div className="k-page-end" />
      {filterOpen && <FilterSheet value={f} onApply={(v) => setF(v)} onClose={() => setFilterOpen(false)} />}
    </div>
  );

  if (!app.isTablet) {
    return selectedId ? <TxDetail id={selectedId} onBack={() => app.goBack("harcamalar")} /> : master;
  }
  return (
    <div className="k-md">
      <div className="k-md-master">{master}</div>
      <div className="k-md-detail">
        {selectedId ? (
          <TxDetail id={selectedId} onBack={() => app.goBack("harcamalar")} />
        ) : (
          <div className="k-page">
            <EmptyState icon={<Receipt size={30} />} title="Bir kayıt seç" text="Ayrıntılarını burada görürsün; düzenleyebilir, tekrarlayabilir ya da silebilirsin." />
          </div>
        )}
      </div>
    </div>
  );
}
