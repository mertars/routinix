import { useState } from "react";
import { Amt } from "../ui/Amt";
import { PiggyBank, Plus, Trash2, Edit3, Target } from "lucide-react";
import { Page, Ring, AmountSheet, AmountField, SplitView, pct } from "../ui/parts";
import Sheet from "../ui/Sheet";
import { Bubble, ICONS, COLOR_KEYS } from "../ui/icons";
import { EmptyState } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { goalProjection, goalSaved } from "../model/finance";
import { baseOf, formatMoney, formatMoneyText } from "../model/money";
import { shortDate, fromDateInput, toDateInput, dateTimeLabel } from "../model/dates";
import { uid } from "../model/schema";

const GOAL_ICONS = ["plane", "smartphone", "gift", "home", "car", "piggy", "graduation", "heart", "star", "sofa"];

function GoalEditor({ initial, onClose }) {
  const k = useKesem();
  const [name, setName] = useState(initial.name || "");
  const [icon, setIcon] = useState(initial.icon || "piggy");
  const [color, setColor] = useState(initial.color || "rose");
  const [target, setTarget] = useState(initial.targetMinor || 0);
  const [plan, setPlan] = useState(initial.monthlyPlanMinor || 0);
  const [date, setDate] = useState(initial.targetDate || null);
  const valid = name.trim() && target > 0;
  const save = async () => {
    const rec = await k.saveRecord("goals", { ...initial, name: name.trim().slice(0, 28), icon, color, targetMinor: target, currency: "TRY", monthlyPlanMinor: plan || null, targetDate: date, deposits: initial.deposits || [] }, "kumbara kaydı");
    if (rec) onClose(rec);
  };
  return (
    <Sheet open onClose={() => onClose()} title={initial.id ? "Kumbarayı düzenle" : "Yeni kumbara"} size="sm">
      <div className="k-form">
        <div className="k-preview-row">
          <Bubble icon={icon} color={color} size={56} />
          <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Yaz tatili" maxLength={28} aria-label="Kumbara adı" />
        </div>
        <div className="k-label">İkon</div>
        <div className="k-icon-grid">
          {GOAL_ICONS.map((i) => (
            <button key={i} type="button" className={icon === i ? "on" : ""} style={{ "--c": `var(--kc-${color})` }} onClick={() => setIcon(i)} aria-label={i} aria-pressed={icon === i}>
              {(() => { const C = ICONS[i]; return <C size={20} />; })()}
            </button>
          ))}
        </div>
        <div className="k-label">Renk</div>
        <div className="k-color-row">
          {COLOR_KEYS.map((c) => (
            <button key={c} type="button" className={color === c ? "on" : ""} style={{ "--c": `var(--kc-${c})` }} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} />
          ))}
        </div>
        <div className="k-label">Hedef tutar</div>
        <AmountField label="Hedef" value={target} onChange={setTarget} />
        <div className="k-label">Hedef tarih (isteğe bağlı)</div>
        <input type="date" className="k-input" value={date ? toDateInput(date) : ""} min={toDateInput(Date.now())} onChange={(e) => setDate(e.target.value ? fromDateInput(e.target.value) : null)} aria-label="Hedef tarih" />
        <div className="k-label">Aylık ayırmayı planladığın tutar (isteğe bağlı)</div>
        <AmountField label="Aylık" value={plan} onChange={setPlan} placeholder="Yok" />
        <div className="k-form-actions">
          {initial.id && (
            <button type="button" className="k-btn danger-ghost" onClick={async () => { onClose(null, true); await k.removeRecord("goals", initial.id, "kumbara silme"); }}>
              <Trash2 size={16} /> Sil
            </button>
          )}
          <button type="button" className="k-btn primary grow" disabled={!valid} onClick={save}>Kaydet</button>
        </div>
      </div>
    </Sheet>
  );
}

function etaText(p) {
  if (p.done) return "Hedefe ulaştın";
  if (p.etaTs) return `Tahmini bitiş ${shortDate(p.etaTs)} ${new Date(p.etaTs).getFullYear()}`;
  return "Tahmin için birikim ekle";
}

function GoalDetail({ id, onBack }) {
  const k = useKesem();
  const goal = k.goals.find((g) => g.id === id);
  const [sheet, setSheet] = useState(null);
  if (!goal) return <Page title="Kumbara" onBack={onBack}><EmptyState icon={<PiggyBank size={30} />} title="Kumbara bulunamadı" /></Page>;
  const p = goalProjection(goal);
  const addDeposit = (amountMinor) => k.saveRecord("goals", { id: goal.id, deposits: [...goal.deposits, { id: uid(), amountMinor, at: Date.now(), note: "" }] }, amountMinor >= 0 ? "birikim ekleme" : "para çekme");
  const delDeposit = (did) => k.saveRecord("goals", { id: goal.id, deposits: goal.deposits.filter((d) => d.id !== did) }, "birikim silme");
  return (
    <Page title={goal.name} subtitle={etaText(p)} onBack={onBack} right={<button type="button" className="k-icon-btn" aria-label="Düzenle" onClick={() => setSheet({ type: "edit" })}><Edit3 size={18} /></button>}>
      <section className="k-card hero">
        <div className="k-row-between" style={{ gap: 16 }}>
          <Ring value={p.pct} size={118} stroke={11} label={`Hedefin ${pct(p.pct)} tamamlandı`}>
            <span className="k-num lg">{pct(p.pct)}</span>
          </Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="k-cap">Biriken</div>
            <div className="k-num lg"><Amt>{formatMoney(p.saved, goal.currency, { hideZeroDecimals: true })}</Amt></div>
            <div className="k-muted" style={{ fontSize: 13.5, marginTop: 4 }}>Hedef <Amt>{formatMoney(goal.targetMinor, goal.currency, { hideZeroDecimals: true })}</Amt></div>
            <div className="k-muted" style={{ fontSize: 13.5 }}>Kalan <Amt>{formatMoney(p.remaining, goal.currency, { hideZeroDecimals: true })}</Amt></div>
          </div>
        </div>
      </section>
      <div className="k-bento-wrap k-gap">
        <div className="k-bento">
          <div className="k-card accent b-2x1">
            <div className="k-cap"><Target size={14} /> Tahmin</div>
            <b style={{ fontSize: 15 }}>{etaText(p)}</b>
            <span className="k-tile-sub">{p.basis === "history" ? "Son birikim hızına göre" : p.basis === "plan" ? "Aylık planına göre" : p.done ? "" : "Düzenli ekledikçe netleşir"}</span>
          </div>
          <div className="k-card calm b-1x1">
            <div className="k-cap">Aylık gerekli</div>
            <b className="k-num md">{p.neededPerMonth ? <Amt>{formatMoney(p.neededPerMonth, goal.currency, { hideZeroDecimals: true })}</Amt> : "—"}</b>
            <span className="k-tile-sub">{goal.targetDate ? `${shortDate(goal.targetDate)} için` : "Tarih yok"}</span>
          </div>
        </div>
      </div>
      <div className="k-actions" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <button type="button" className="k-btn primary" onClick={() => setSheet({ type: "dep" })}><Plus size={17} /> Birikim ekle</button>
        <button type="button" className="k-btn tonal" onClick={() => setSheet({ type: "wd" })} disabled={!p.saved}>Para çek</button>
      </div>
      <div className="k-section-title">Hareketler</div>
      {goal.deposits.length ? (
        <div className="k-card-list">
          {[...goal.deposits].sort((a, b) => b.at - a.at).map((d) => (
            <div key={d.id} className="k-line-item" style={{ padding: "6px 14px" }}>
              <div className="k-grow">
                <b className={d.amountMinor < 0 ? "k-state-over" : "pos"}><Amt>{formatMoney(d.amountMinor, goal.currency, { sign: true })}</Amt></b>
                <div className="k-tile-sub">{dateTimeLabel(d.at)}</div>
              </div>
              <button type="button" className="k-icon-btn sm" aria-label="Hareketi sil" onClick={() => delDeposit(d.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      ) : <p className="k-hint">Henüz birikim eklemedin.</p>}
      {sheet?.type === "dep" && <AmountSheet title="Birikim ekle" currency={goal.currency} submitLabel="Ekle" onSubmit={addDeposit} onClose={() => setSheet(null)} />}
      {sheet?.type === "wd" && <AmountSheet title="Para çek" currency={goal.currency} submitLabel="Çek" onSubmit={(v) => addDeposit(-Math.min(v, p.saved))} onClose={() => setSheet(null)} />}
      {sheet?.type === "edit" && <GoalEditor initial={goal} onClose={(_, deleted) => { setSheet(null); if (deleted) onBack(); }} />}
    </Page>
  );
}

export default function GoalsPage({ id }) {
  const k = useKesem();
  const app = useApp();
  const [creating, setCreating] = useState(false);
  const totalSaved = k.goals.reduce((s, g) => s + baseOf({ amountMinor: goalSaved(g), currency: g.currency }, k.rates), 0);
  const totalTarget = k.goals.reduce((s, g) => s + baseOf({ amountMinor: g.targetMinor, currency: g.currency }, k.rates), 0);
  const go = (gid) => app.navigate(`daha-fazla/birikimler/${gid}`, { replace: app.isTablet && !!id });
  const master = (
    <Page title="Birikimler" subtitle="Kumbaraların" onBack={app.isTablet ? undefined : () => app.goBack("daha-fazla")} right={<button type="button" className="k-btn primary sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni</button>}>
      {k.goals.length === 0 ? (
        <EmptyState icon={<PiggyBank size={32} />} title="İlk kumbaranı aç" text="Tatil, telefon, hediye… Hedef tutarı belirle; ne kadar biriktirdiğini ve ne zaman biteceğini görürsün." action={<button type="button" className="k-btn primary" onClick={() => setCreating(true)}><Plus size={18} /> Kumbara ekle</button>} />
      ) : (
        <>
          <section className="k-card hero">
            <div className="k-cap">Toplam birikim</div>
            <div className="k-num xl"><Amt>{formatMoney(totalSaved, "TRY", { hideZeroDecimals: true })}</Amt></div>
            <div className="k-muted" style={{ fontSize: 13.5, marginTop: 6 }}>{k.goals.length} hedef · toplam hedef <Amt>{formatMoney(totalTarget, "TRY", { hideZeroDecimals: true })}</Amt></div>
          </section>
          <div className="k-bento-wrap k-gap">
            <div className="k-bento">
              {k.goals.map((g, i) => {
                const p = goalProjection(g);
                const big = i === 0;
                return (
                  <button key={g.id} type="button" className={`k-card ${big ? "accent b-2x2" : "calm b-1x1"}`} onClick={() => go(g.id)} aria-current={id === g.id ? "true" : undefined}>
                    <Ring value={p.pct} size={big ? 96 : 54} stroke={big ? 9 : 6} label={`${g.name} ${pct(p.pct)}`}>
                      <Bubble icon={g.icon} color={g.color} size={big ? 40 : 24} />
                    </Ring>
                    <div style={{ minWidth: 0 }}>
                      <div className="k-tile-title k-ellip" style={big ? {} : { fontSize: 13.5 }}>{g.name}</div>
                      <div className="k-accent-text" style={{ fontWeight: 800, fontSize: big ? 24 : 15 }}>{pct(p.pct)}</div>
                      <div className="k-tile-sub k-ellip"><Amt>{formatMoney(p.saved, g.currency, { hideZeroDecimals: true })}</Amt>{big ? ` / ${formatMoneyText(g.targetMinor, g.currency, { hideZeroDecimals: true })}` : ""}</div>
                      {big && <div className="k-tile-sub">{etaText(p)}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      {creating && <GoalEditor initial={{}} onClose={(rec) => { setCreating(false); if (rec) go(rec.id); }} />}
    </Page>
  );
  return <SplitView master={master} hasDetail={!!id} detail={<GoalDetail id={id} onBack={() => app.goBack("daha-fazla/birikimler")} />} empty={<div className="k-page"><EmptyState icon={<PiggyBank size={30} />} title="Bir kumbara seç" text="Ayrıntıları, hareketleri ve tahmini bitiş tarihini burada görürsün." /></div>} />;
}
