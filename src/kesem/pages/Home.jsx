import { useMemo, useRef } from "react";
import { Amt } from "../ui/Amt";
import { ArrowLeft, CalendarClock, Flame, Plus, Repeat, Sparkles, Wallet, X, Zap } from "lucide-react";
import { Ring, STATE_LABEL, pct } from "../ui/parts";
import { useFinance } from "../state/derived";
import PageHeader from "../ui/PageHeader";
import TxRow from "../ui/TxRow";
import { Bubble, Icon } from "../ui/icons";
import { EmptyState, UndoRedoButtons } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { periodTotals, suggestShortcuts } from "../model/stats";
import { relativeDayLabel, startOfDay, periodRange, periodLabel } from "../model/dates";
import { formatMoney, formatMoneyText } from "../model/money";
import { STARTER_IDEAS } from "../model/defaults";

// Uzun bas → tutarı değiştirerek ekle; kısa dokun → anında ekle.
function useLongPress(onLong, onTap, ms = 450) {
  const timer = useRef(null);
  const fired = useRef(false);
  const start = useRef(null);
  const clear = () => clearTimeout(timer.current);
  return {
    onPointerDown: (e) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        onLong();
      }, ms);
    },
    onPointerMove: (e) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (fired.current) return;
      onTap();
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}

function QuickChip({ tpl }) {
  const k = useKesem();
  const app = useApp();
  const cat = k.catById(tpl.categoryId);
  const busy = useRef(false);
  const press = useLongPress(
    () => app.openAdd({ initial: { ...tpl, templateId: tpl.id } }),
    () => {
      if (!tpl.amountMinor) return app.openAdd({ initial: { ...tpl, templateId: tpl.id } });
      if (busy.current) return; // çift dokunuşla çift kayıt olmasın
      busy.current = true;
      k.quickAdd(tpl).finally(() => setTimeout(() => (busy.current = false), 700));
    }
  );
  return (
    <button type="button" className="k-quick" style={{ "--c": `var(--kc-${cat.color})` }} {...press} aria-label={`${tpl.name}${tpl.amountMinor ? ", " + formatMoneyText(tpl.amountMinor) : ""} ekle`}>
      <Bubble icon={cat.icon} color={cat.color} size={34} />
      <span className="k-quick-name">{tpl.name}</span>
      <span className="k-quick-amt">{tpl.amountMinor ? <Amt>{formatMoney(tpl.amountMinor, tpl.currency, { hideZeroDecimals: true })}</Amt> : "Tutar gir"}</span>
    </button>
  );
}

export default function HomePage() {
  const k = useKesem();
  const app = useApp();
  const { transactions, templates, settings } = k;
  const f = useFinance();
  const now = f.now;
  const st = f.status;
  const range = periodRange(now, k.budget.startDay);
  const month = useMemo(() => periodTotals(transactions, range, k.rates), [transactions, k.rates, range[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = useMemo(() => periodTotals(transactions, [startOfDay(now), startOfDay(now) + 86400000], k.rates), [transactions, k.rates]); // eslint-disable-line react-hooks/exhaustive-deps
  const upcoming = f.planned.slice(0, 3);
  const quicks = templates.filter((t) => t.quick);
  const suggestions = useMemo(() => suggestShortcuts(transactions, templates, settings.dismissedSuggestions), [transactions, templates, settings.dismissedSuggestions]);
  const lastAdded = useMemo(() => transactions.reduce((a, t) => (!a || t.createdAt > a.createdAt ? t : a), null), [transactions]);
  const recent = transactions.slice(0, 5);

  const shortcutFrom = (g) => {
    const t = g.sample;
    const sub = t.subcategoryId ? k.catById(t.subcategoryId) : null;
    app.openTemplate({
      initial: { name: (t.merchant || sub?.name || k.catById(t.categoryId).name).slice(0, 28), kind: t.kind, amountMinor: t.amountMinor, categoryId: t.categoryId, subcategoryId: t.subcategoryId, accountId: t.accountId, merchant: t.merchant, quick: true },
    });
  };

  return (
    <div className="k-page">
      <PageHeader
        title={app.menuLabel}
        subtitle={periodLabel(now, k.budget.startDay)}
        left={
          <button type="button" className="k-back" onClick={app.exit} aria-label="Routinix'e dön">
            <ArrowLeft size={20} />
            <span>Routinix</span>
          </button>
        }
        right={<UndoRedoButtons />}
      />

      <div className="k-bento-wrap">
        <div className="k-bento">
          {st.hasBudget ? (
            <section className="k-card hero b-3x1" style={{ "--wt": 4, "--ht": 2 }} aria-label="Bugün harcayabileceğin tutar">
              <div className="k-row-between">
                <div className="k-cap">Bugün harcayabileceğin</div>
                <span className={`k-pill ${st.state}`}>{STATE_LABEL[st.state]}</span>
              </div>
              <div className="k-row-between" style={{ gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div className={`k-num xl ${st.todayLeft < 0 ? "k-state-over" : ""}`}><Amt>{formatMoney(Math.max(st.todayLeft, st.todayLeft < 0 ? st.todayLeft : 0), "TRY", { hideZeroDecimals: true })}</Amt></div>
                  <div className="k-muted" style={{ fontSize: 13.5, marginTop: 6 }}>
                    Günlük pay <Amt>{formatMoney(st.allowance, "TRY", { hideZeroDecimals: true })}</Amt> · bugün <Amt>{formatMoney(st.spentToday, "TRY", { hideZeroDecimals: true })}</Amt> harcandı
                  </div>
                </div>
                <Ring value={st.ratio} size={74} stroke={8} state={st.state} label={`Bütçenin ${pct(st.ratio)} kullanıldı`}>
                  <span style={{ fontSize: 14 }}>{pct(st.ratio)}</span>
                </Ring>
              </div>
              <div className="k-hero-row2">
                <div><span>Kalan bütçe</span><b className={st.free < 0 ? "k-state-over" : ""}><Amt>{formatMoney(st.free, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
                <div><span>Kalan gün</span><b>{st.daysLeft}</b></div>
                <div><span>Planlı ödeme</span><b><Amt>{formatMoney(st.committed, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
              </div>
            </section>
          ) : (
            <section className="k-card hero b-3x1" style={{ "--wt": 4, "--ht": 2 }} aria-label="Dönem özeti">
              <div className="k-cap">Bu dönem harcanan</div>
              <div className="k-num xl"><Amt>{formatMoney(month.expense, "TRY", { hideZeroDecimals: true })}</Amt></div>
              <div className="k-muted" style={{ fontSize: 13.5 }}>Bir bütçe belirlersen her gün ne kadar harcayabileceğini hesaplarım.</div>
              <button type="button" className="k-btn primary" onClick={() => app.navigate("daha-fazla/butce")}>Bütçe belirle</button>
            </section>
          )}
          <div className="k-card calm b-1x1">
            <div className="k-cap">Bugün</div>
            <b className="k-num md"><Amt>{formatMoney(today.expense, "TRY", { hideZeroDecimals: true })}</Amt></b>
            <span className="k-tile-sub">harcandı</span>
          </div>
          <button type="button" className="k-card accent b-2x2" style={{ "--wt": 2 }} onClick={() => app.navigate("daha-fazla/takvim")} aria-label="Yaklaşan ödemeler">
            <div className="k-cap"><CalendarClock size={14} /> Yaklaşan ödemeler</div>
            {upcoming.length ? (
              <div className="k-stack" style={{ gap: 8, width: "100%" }}>
                {upcoming.map((u) => (
                  <div key={u.id} className="k-split-row" style={{ padding: 0 }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="k-ellip" style={{ display: "block", fontWeight: 650, fontSize: 13.5 }}>{u.title}</span>
                      <span className={`k-tile-sub ${u.status === "overdue" ? "k-state-over" : u.status === "soon" || u.status === "today" ? "k-state-near" : ""}`} style={u.status !== "later" ? { fontWeight: 700 } : {}}>{relativeDayLabel(u.days)}</span>
                    </span>
                    <b style={{ fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}><Amt>{formatMoney(u.amountMinor, u.currency, { hideZeroDecimals: true })}</Amt></b>
                  </div>
                ))}
              </div>
            ) : <span className="k-tile-sub">Yaklaşan ödeme yok</span>}
          </button>
          <div className="k-card calm b-1x1">
            <div className="k-cap">Gelir</div>
            <b className="k-num md pos"><Amt>{formatMoney(month.income, "TRY", { hideZeroDecimals: true })}</Amt></b>
            <span className="k-tile-sub">bu dönem</span>
          </div>
          <button type="button" className="k-card calm b-3x1" style={{ "--wt": 2 }} onClick={() => app.navigate("daha-fazla/rozetler")} aria-label="Harcamasız gün serisi">
            <div className="k-cap"><Flame size={14} /> Harcamasız seri</div>
            <b className="k-num md">{f.streak.current} gün</b>
          </button>
        </div>
      </div>

      <section className="k-section" aria-label="Sık harcamalar">
        <div className="k-section-head">
          <h2>
            <Zap size={16} /> Sık harcamalar
          </h2>
          <button type="button" className="k-link" onClick={() => app.openTemplate({})}>
            <Plus size={14} /> Kısayol
          </button>
        </div>
        {quicks.length > 0 ? (
          <div className="k-quick-row no-scrollbar">
            {quicks.map((t) => (
              <QuickChip key={t.id} tpl={t} />
            ))}
          </div>
        ) : (
          <div className="k-ideas">
            <p>Her gün yaptığın harcamaları tek dokunuşla ekle. Bir fikirle başla:</p>
            <div className="k-chips wrap">
              {STARTER_IDEAS.map((i) => (
                <button key={i.name} type="button" className="k-chip" onClick={() => app.openTemplate({ initial: { ...i, quick: true } })}>
                  <Icon name={i.icon} size={16} /> {i.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {suggestions.map((g) => {
          const t = g.sample;
          const label = t.merchant || (t.subcategoryId && k.catById(t.subcategoryId).name) || k.catById(t.categoryId).name;
          return (
            <div key={g.key} className="k-suggest-card">
              <Sparkles size={16} />
              <button type="button" onClick={() => shortcutFrom(g)}>
                <b>{label}</b> {g.count} kez <Amt>{formatMoney(t.amountMinor)}</Amt> girdin — kısayol yap?
              </button>
              <button type="button" className="k-icon-btn sm" aria-label="Önerme" onClick={() => k.updateSettings({ dismissedSuggestions: [...settings.dismissedSuggestions, g.key] })}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </section>

      {lastAdded && (
        <section className="k-repeat" aria-label="Son harcamayı tekrarla">
          <Repeat size={18} />
          <span className="k-repeat-text">
            <small>Son {lastAdded.kind === "income" ? "gelir" : "harcama"}</small>
            <b>
              {lastAdded.merchant || k.catById(lastAdded.categoryId).name} · <Amt>{formatMoney(lastAdded.amountMinor)}</Amt>
            </b>
          </span>
          <button type="button" className="k-btn tonal sm" onClick={() => k.repeatTransaction(lastAdded)}>
            Tekrarla
          </button>
          <button type="button" className="k-btn ghost sm" onClick={() => app.openAdd({ initial: { ...lastAdded, occurredAt: undefined, receiptId: null } })}>
            Düzenle
          </button>
        </section>
      )}

      <section className="k-section" aria-label="Son kayıtlar">
        <div className="k-section-head">
          <h2>Son kayıtlar</h2>
          {transactions.length > 5 && (
            <button type="button" className="k-link" onClick={() => app.navigate("harcamalar")}>
              Tümü
            </button>
          )}
        </div>
        {recent.length ? (
          <div className="k-card-list">
            {recent.map((t) => (
              <TxRow key={t.id} tx={t} onClick={() => app.navigate(`harcamalar/${t.id}`)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Wallet size={30} />}
            title="Henüz kayıt yok"
            text="Alttaki + tuşuna dokunup ilk harcamanı ya da gelirini ekle. Birkaç saniye sürer."
            action={
              <button type="button" className="k-btn primary" onClick={() => app.openAdd({})}>
                <Plus size={18} /> İlk harcamayı ekle
              </button>
            }
          />
        )}
      </section>
      <div className="k-page-end" />
    </div>
  );
}
