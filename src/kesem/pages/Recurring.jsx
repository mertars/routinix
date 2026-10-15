import { useMemo, useState } from "react";
import { Amt } from "../ui/Amt";
import { Plus, Trash2, Repeat, Layers, Pause, Play, Check, SkipForward } from "lucide-react";
import { Page, AmountField, Bar, SplitView } from "../ui/parts";
import Sheet from "../ui/Sheet";
import { Bubble, Icon } from "../ui/icons";
import { EmptyState, Segmented } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { installmentProgress, monthlyEquivalent, occurrencesBetween, yearlyEquivalent } from "../model/finance";
import { formatMoney, rateOf, CURRENCIES, currencySymbol, formatMoneyText } from "../model/money";
import { addDays, daysBetween, fromDateInput, relativeDayLabel, shortDate, startOfDay, toDateInput } from "../model/dates";

const TYPES = [
  { value: "subscription", label: "Abonelik" },
  { value: "bill", label: "Fatura" },
  { value: "rent", label: "Kira" },
  { value: "other", label: "Diğer" },
];
const TYPE_ICON = { subscription: "music", bill: "receipt", rent: "home", other: "wallet" };
const FREQ = [
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
  { value: "yearly", label: "Yıllık" },
];
const FREQ_LABEL = { weekly: "hafta", monthly: "ay", yearly: "yıl" };

const nextOccurrence = (rule, now = Date.now()) => {
  const from = startOfDay(now);
  const skipped = new Set(rule.skipped || []);
  return occurrencesBetween(rule, from, addDays(from, 800)).find((o) => !skipped.has(o.index)) || null;
};

function RecurringEditor({ initial, onClose }) {
  const k = useKesem();
  const [title, setTitle] = useState(initial.title || "");
  const [type, setType] = useState(initial.type || "subscription");
  const [amount, setAmount] = useState(initial.amountMinor || 0);
  const [currency, setCurrency] = useState(initial.currency || "TRY");
  const [freq, setFreq] = useState(initial.frequency || "monthly");
  const [interval, setInterval] = useState(initial.interval || 1);
  const [next, setNext] = useState(initial.anchorAt || Date.now());
  const [auto, setAuto] = useState(initial.autoPost ?? true);
  const tops = k.topCategories("expense");
  const [catId, setCatId] = useState(initial.categoryId || (type === "bill" ? "cat-fatura" : "cat-eglence"));
  const [accId, setAccId] = useState(initial.accountId || k.accounts[0]?.id || null);
  const valid = title.trim() && amount > 0 && (currency === "TRY" || rateOf(currency, k.rates));
  const pickType = (t) => {
    setType(t);
    setAuto(t === "subscription" || t === "rent" ? true : false); // fatura: tutar değişir → elle onay
    if (!initial.id) setCatId(t === "bill" ? "cat-fatura" : t === "rent" ? "cat-ev" : "cat-eglence");
  };
  const save = async () => {
    const rec = await k.saveRecord("recurrings", {
      ...initial, title: title.trim().slice(0, 32), type, kind: "expense", amountMinor: amount, currency, frequency: freq, interval,
      anchorAt: initial.id && initial.anchorAt && toDateInput(initial.anchorAt) === toDateInput(next) ? initial.anchorAt : next,
      autoPost: auto, paused: !!initial.paused, skipped: initial.skipped || [], categoryId: catId, subcategoryId: null, accountId: accId, merchant: title.trim(),
    }, "tekrarlayan ödeme");
    if (rec) {
      k.notify({ message: "Kaydedildi", actionLabel: "Geri Al", action: "undo" });
      setTimeout(() => k.materialize(), 0);
      onClose(rec);
    }
  };
  return (
    <Sheet open onClose={() => onClose()} title={initial.id ? "Ödemeyi düzenle" : "Yeni tekrarlayan ödeme"} size="sm">
      <div className="k-form">
        <div className="k-preview-row">
          <Bubble icon={TYPE_ICON[type]} color={k.catById(catId).color} size={56} />
          <input className="k-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Netflix" maxLength={32} aria-label="Ad" />
        </div>
        <div className="k-label">Tür</div>
        <Segmented value={type} onChange={pickType} options={TYPES} label="Tür" />
        <div className="k-label">Tutar</div>
        <AmountField label="Her ödeme" value={amount} currency={currency} onChange={setAmount} />
        {k.enabledCurrencies.length > 1 && (
          <div className="k-curr" style={{ marginTop: 8 }}>
            {CURRENCIES.filter((c) => k.enabledCurrencies.includes(c)).map((c) => <button key={c} type="button" className={`k-chip sm ${currency === c ? "on" : ""}`} onClick={() => setCurrency(c)}>{currencySymbol(c)} {c}</button>)}
          </div>
        )}
        <div className="k-label">Sıklık</div>
        <Segmented value={freq} onChange={setFreq} options={FREQ} label="Sıklık" />
        <div className="k-row-between" style={{ marginTop: 10 }}>
          <span className="k-muted">Her</span>
          <div className="k-stepper">
            <button type="button" className="k-icon-btn" onClick={() => setInterval(Math.max(1, interval - 1))} disabled={interval <= 1} aria-label="Azalt">−</button>
            <b>{interval}</b>
            <button type="button" className="k-icon-btn" onClick={() => setInterval(Math.min(12, interval + 1))} aria-label="Artır">+</button>
          </div>
          <span className="k-muted">{FREQ_LABEL[freq]}</span>
        </div>
        <div className="k-label">Sonraki ödeme tarihi</div>
        <input type="date" className="k-input" value={toDateInput(next)} onChange={(e) => e.target.value && setNext(fromDateInput(e.target.value) + 12 * 3600000)} aria-label="Sonraki ödeme tarihi" />
        <label className="k-switch-row" style={{ marginTop: 12 }}>
          <span><b>Otomatik harcama kaydı</b><small>{auto ? "Vadesi gelince kendiliğinden eklenir" : "Vadesi gelince sana “Öde” diye sorulur (fatura tutarı değişirse)"}</small></span>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <i aria-hidden="true" />
        </label>
        <div className="k-label">Kategori</div>
        <div className="k-chips no-scrollbar">
          {tops.map((c) => <button key={c.id} type="button" className={`k-chip sm ${catId === c.id ? "on" : ""}`} style={{ "--c": `var(--kc-${c.color})` }} onClick={() => setCatId(c.id)}><Icon name={c.icon} size={15} />{c.name}</button>)}
        </div>
        <div className="k-label">Ödeme yöntemi</div>
        <div className="k-chips no-scrollbar">
          {k.accounts.map((a) => <button key={a.id} type="button" className={`k-chip sm ${accId === a.id ? "on" : ""}`} style={{ "--c": `var(--kc-${a.color})` }} onClick={() => setAccId(a.id)}>{a.name}</button>)}
        </div>
        <div className="k-form-actions">
          {initial.id && <button type="button" className="k-btn danger-ghost" onClick={async () => { onClose(null, true); await k.removeRecord("recurrings", initial.id, "tekrarlayan ödeme silme"); }}><Trash2 size={16} /> Sil</button>}
          <button type="button" className="k-btn primary grow" disabled={!valid} onClick={save}>Kaydet</button>
        </div>
      </div>
    </Sheet>
  );
}

function RuleDetail({ id, onBack }) {
  const k = useKesem();
  const rule = k.recurrings.find((r) => r.id === id);
  const [edit, setEdit] = useState(false);
  if (!rule) return <Page title="Ödeme" onBack={onBack}><EmptyState icon={<Repeat size={30} />} title="Bulunamadı" /></Page>;
  const now = Date.now();
  const skipped = new Set(rule.skipped || []);
  const upcoming = occurrencesBetween(rule, addDays(startOfDay(now), rule.autoPost ? 0 : -90), addDays(now, 400)).filter((o) => !skipped.has(o.index) && !k.txExists(o.key)).slice(0, 4);
  const monthly = monthlyEquivalent(rule, k.rates);
  const item = (o) => ({ ruleId: rule.id, index: o.index, amountMinor: rule.amountMinor });
  return (
    <Page title={rule.title} subtitle={`${rule.interval > 1 ? `Her ${rule.interval} ` : "Her "}${FREQ_LABEL[rule.frequency]}${rule.paused ? " · duraklatıldı" : ""}`} onBack={onBack}>
      <section className="k-card hero">
        <div className="k-cap">Her ödeme</div>
        <div className="k-num xl"><Amt>{formatMoney(rule.amountMinor, rule.currency)}</Amt></div>
        <div className="k-row-between" style={{ marginTop: 12, gap: 8 }}>
          <div><div className="k-cap">Aylık</div><b className="k-num md"><Amt>{formatMoney(monthly, "TRY", { hideZeroDecimals: true })}</Amt></b></div>
          <div><div className="k-cap">Yıllık</div><b className="k-num md"><Amt>{formatMoney(yearlyEquivalent(rule, k.rates), "TRY", { hideZeroDecimals: true })}</Amt></b></div>
        </div>
      </section>
      <div className="k-section-title">Yaklaşan</div>
      <div className="k-card-list">
        {upcoming.length === 0 && <p className="k-hint" style={{ padding: 14 }}>{rule.paused ? "Duraklatıldı." : "Yaklaşan ödeme yok."}</p>}
        {upcoming.map((o) => {
          const days = daysBetween(now, o.dateTs);
          const late = days < 0 && !rule.autoPost;
          return (
            <div key={o.key} className="k-line-item" style={{ padding: "8px 14px" }}>
              <div className="k-grow">
                <b>{shortDate(o.dateTs)}</b>
                <div className={`k-tile-sub ${late ? "k-state-over" : ""}`} style={late ? { fontWeight: 700 } : {}}>{relativeDayLabel(days)}</div>
              </div>
              {!rule.autoPost && days <= 3 && <button type="button" className="k-btn primary sm" onClick={() => k.payOccurrence(item(o))}><Check size={15} /> Öde</button>}
              {!rule.autoPost && <button type="button" className="k-icon-btn sm" aria-label="Bu dönemi atla" onClick={() => k.skipOccurrence(item(o))}><SkipForward size={14} /></button>}
            </div>
          );
        })}
      </div>
      <div className="k-actions">
        <button type="button" className="k-btn primary" onClick={() => setEdit(true)}>Düzenle</button>
        <button type="button" className="k-btn tonal" onClick={() => k.saveRecord("recurrings", { id: rule.id, paused: !rule.paused }, rule.paused ? "devam ettirme" : "duraklatma")}>
          {rule.paused ? <><Play size={16} /> Devam et</> : <><Pause size={16} /> Duraklat</>}
        </button>
        <button type="button" className="k-btn danger-ghost" onClick={async () => { await k.removeRecord("recurrings", rule.id, "tekrarlayan ödeme silme"); onBack(); }}><Trash2 size={16} /> Sil</button>
      </div>
      {edit && <RecurringEditor initial={rule} onClose={() => setEdit(false)} />}
    </Page>
  );
}

function PlanDetail({ id, onBack }) {
  const k = useKesem();
  const plan = k.installments.find((p) => p.id === id);
  if (!plan) return <Page title="Taksit" onBack={onBack}><EmptyState icon={<Layers size={30} />} title="Bulunamadı" /></Page>;
  const now = Date.now();
  const pr = installmentProgress(plan, now);
  return (
    <Page title={plan.title} subtitle={`${plan.count} taksit${plan.stoppedAt ? " · durduruldu" : ""}`} onBack={onBack}>
      <section className="k-card hero">
        <div className="k-cap">Kalan</div>
        <div className="k-num xl"><Amt>{formatMoney(pr.leftMinor, plan.currency, { hideZeroDecimals: true })}</Amt></div>
        <div className="k-muted" style={{ fontSize: 13.5, margin: "6px 0 12px" }}>{pr.leftCount} taksit kaldı · toplam <Amt>{formatMoney(plan.totalMinor, plan.currency, { hideZeroDecimals: true })}</Amt></div>
        <Bar value={pr.rows.length ? pr.doneCount / pr.rows.length : 0} />
      </section>
      <div className="k-section-title">Ödeme planı</div>
      <div className="k-card-list">
        {pr.rows.map((r) => {
          const done = r.dateTs <= now;
          return (
            <div key={r.key} className="k-line-item" style={{ padding: "8px 14px", opacity: done ? 0.7 : 1 }}>
              <span className={`k-check ${done ? "on" : ""}`} aria-hidden="true"><Check size={16} /></span>
              <div className="k-grow"><b>{r.index + 1}. taksit</b><div className="k-tile-sub">{shortDate(r.dateTs)} {new Date(r.dateTs).getFullYear()}{done ? " · kaydedildi" : ` · ${relativeDayLabel(daysBetween(now, r.dateTs))}`}</div></div>
              <b style={{ fontVariantNumeric: "tabular-nums" }}><Amt>{formatMoney(r.amountMinor, plan.currency)}</Amt></b>
            </div>
          );
        })}
      </div>
      <div className="k-actions">
        {!pr.finished && !plan.stoppedAt && <button type="button" className="k-btn tonal" onClick={() => k.saveRecord("installments", { id: plan.id, stoppedAt: now }, "taksit planını durdurma")}>Kalanları iptal et</button>}
        <button type="button" className="k-btn danger-ghost" onClick={async () => { await k.removeRecord("installments", plan.id, "taksit planı silme"); onBack(); }}><Trash2 size={16} /> Planı sil</button>
      </div>
      <p className="k-hint">Planı silmek geçmiş taksit kayıtlarını silmez; yalnızca yenilerini durdurur.</p>
    </Page>
  );
}

export default function RecurringPage({ tab = "abonelikler", id }) {
  const k = useKesem();
  const app = useApp();
  const [creating, setCreating] = useState(false);
  const subs = tab === "abonelikler";
  const now = Date.now();
  const rows = useMemo(() => k.recurrings.map((r) => ({ r, next: nextOccurrence(r, now), monthly: monthlyEquivalent(r, k.rates) })).sort((a, b) => (a.next?.dateTs ?? Infinity) - (b.next?.dateTs ?? Infinity)), [k.recurrings, k.rates]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthTotal = rows.filter((x) => !x.r.paused).reduce((s, x) => s + x.monthly, 0);
  const plans = k.installments.map((p) => ({ p, pr: installmentProgress(p, now) }));
  const leftTotal = plans.reduce((s, x) => s + Math.round(x.pr.leftMinor * (x.p.rate || 1)), 0);
  const nextMonthLoad = plans.reduce((s, x) => s + (x.pr.next ? Math.round(x.pr.next.amountMinor * (x.p.rate || 1)) : 0), 0);
  const base = `daha-fazla/${tab}`;
  const go = (rid) => app.navigate(`${base}/${rid}`, { replace: app.isTablet && !!id });
  const switchTab = (t) => app.navigate(`daha-fazla/${t}`, { replace: true });

  const master = (
    <Page title={subs ? "Abonelikler" : "Taksitler"} subtitle={subs ? "Tekrarlayan ödemeler" : "Taksitli alışverişler"} onBack={app.isTablet ? undefined : () => app.goBack("daha-fazla")}
      right={subs ? <button type="button" className="k-btn primary sm" onClick={() => setCreating(true)}><Plus size={16} /> Ekle</button> : <button type="button" className="k-btn primary sm" onClick={() => app.openAdd({ initial: { installments: true } })}><Plus size={16} /> Taksit</button>}>
      <Segmented value={tab} onChange={switchTab} options={[{ value: "abonelikler", label: "Abonelikler" }, { value: "taksitler", label: "Taksitler" }]} label="Bölüm" />
      {subs ? (
        <>
          <section className="k-card hero k-gap">
            <div className="k-cap">Aylık toplam</div>
            <div className="k-num xl"><Amt>{formatMoney(monthTotal, "TRY", { hideZeroDecimals: true })}</Amt></div>
            <div className="k-muted" style={{ fontSize: 13.5, marginTop: 6 }}>Yıllık <Amt>{formatMoney(monthTotal * 12, "TRY", { hideZeroDecimals: true })}</Amt> · {rows.filter((x) => !x.r.paused).length} ödeme</div>
          </section>
          {rows.length === 0 ? (
            <EmptyState icon={<Repeat size={30} />} title="Tekrarlayan ödeme yok" text="Netflix, Spotify, kira, faturalar… Ekle; sonraki tarihi ve aylık/yıllık toplamı görürsün." action={<button type="button" className="k-btn primary" onClick={() => setCreating(true)}><Plus size={18} /> Ödeme ekle</button>} />
          ) : (
            <div className="k-card-list k-gap">
              {rows.map(({ r, next, monthly }) => {
                const days = next ? daysBetween(now, next.dateTs) : null;
                return (
                  <button key={r.id} type="button" className={`k-manage-row ${id === r.id ? "active" : ""}`} onClick={() => go(r.id)} style={r.paused ? { opacity: 0.6 } : undefined}>
                    <Bubble icon={TYPE_ICON[r.type] || "wallet"} color={k.catById(r.categoryId).color} size={40} />
                    <span>{r.title}<small>{r.paused ? "Duraklatıldı" : next ? `${shortDate(next.dateTs)} · ${relativeDayLabel(days)}` : "Sona erdi"}{!r.autoPost && !r.paused ? " · elle onay" : ""}</small></span>
                    <span style={{ textAlign: "right" }}><b style={{ fontVariantNumeric: "tabular-nums" }}><Amt>{formatMoney(r.amountMinor, r.currency, { hideZeroDecimals: true })}</Amt></b><small>aylık <Amt>{formatMoney(monthly, "TRY", { hideZeroDecimals: true })}</Amt></small></span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="k-bento-wrap k-gap">
            <div className="k-bento">
              <section className="k-card hero b-2x2">
                <div className="k-cap">Kalan taksit</div>
                <div className="k-num lg"><Amt>{formatMoney(leftTotal, "TRY", { hideZeroDecimals: true })}</Amt></div>
                <div className="k-muted" style={{ fontSize: 13 }}>{plans.reduce((s, x) => s + x.pr.leftCount, 0)} taksit</div>
              </section>
              <div className="k-card accent b-1x1"><div className="k-cap">Plan</div><b className="k-num md">{plans.filter((x) => !x.pr.finished).length}</b><span className="k-tile-sub">devam eden</span></div>
              <div className="k-card calm b-1x1"><div className="k-cap">Sıradaki</div><b className="k-num md"><Amt>{formatMoney(nextMonthLoad, "TRY", { hideZeroDecimals: true })}</Amt></b><span className="k-tile-sub">bir sonraki ay</span></div>
            </div>
          </div>
          {plans.length === 0 ? (
            <EmptyState icon={<Layers size={30} />} title="Taksitli alışveriş yok" text="Harcama eklerken “Taksitli alışveriş”i aç; her ay otomatik dağılır, kalan taksitleri buradan izlersin." action={<button type="button" className="k-btn primary" onClick={() => app.openAdd({ initial: { installments: true } })}><Plus size={18} /> Taksitli ekle</button>} />
          ) : (
            <div className="k-card-list k-gap">
              {plans.map(({ p, pr }) => (
                <button key={p.id} type="button" className={`k-manage-row ${id === p.id ? "active" : ""}`} onClick={() => go(p.id)} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <span className="k-row-between"><b style={{ fontSize: 16 }}>{p.title}</b><b style={{ fontVariantNumeric: "tabular-nums" }}><Amt>{formatMoney(pr.leftMinor, p.currency, { hideZeroDecimals: true })}</Amt></b></span>
                  <Bar value={pr.rows.length ? pr.doneCount / pr.rows.length : 0} />
                  <span className="k-tile-sub">{pr.doneCount}/{pr.rows.length} ödendi{pr.next ? ` · sıradaki ${shortDate(pr.next.dateTs)} · ${formatMoneyText(pr.next.amountMinor, p.currency)}` : " · bitti"}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {creating && <RecurringEditor initial={{}} onClose={(rec) => { setCreating(false); if (rec) go(rec.id); }} />}
    </Page>
  );
  return (
    <SplitView master={master} hasDetail={!!id}
      detail={subs ? <RuleDetail id={id} onBack={() => app.goBack(base)} /> : <PlanDetail id={id} onBack={() => app.goBack(base)} />}
      empty={<div className="k-page"><EmptyState icon={subs ? <Repeat size={30} /> : <Layers size={30} />} title="Bir kayıt seç" text="Ayrıntılar ve ödeme planı burada görünür." /></div>} />
  );
}
