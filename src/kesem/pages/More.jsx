import { useMemo, useState } from "react";
import { Amt } from "../ui/Amt";
import {
  CreditCard, Tags, Hash, Zap, Trash2, Settings, ChevronRight, Plus, RotateCcw, CalendarClock, Landmark,
  PiggyBank, Target, Layers, Coins, Repeat, Gift, ShoppingBasket, Award,
} from "lucide-react";
import { AmountField, Ring, pct, STATE_LABEL } from "../ui/parts";
import { useFinance } from "../state/derived";
import BudgetPage from "./Budget";
import GoalsPage from "./Goals";
import DebtsPage from "./Debts";
import RecurringPage from "./Recurring";
import CalendarPage from "./Calendar";
import WishesPage from "./Wishes";
import ShoppingPage from "./Shopping";
import BadgesPage from "./Badges";
import { goalProjection, personBalances, installmentProgress } from "../model/finance";
import { CURRENCIES, currencySymbol, CURRENCY_NAMES, formatRate, formatMoneyText } from "../model/money";
import { relativeDayLabel } from "../model/dates";
import PageHeader from "../ui/PageHeader";
import TxRow from "../ui/TxRow";
import { Bubble } from "../ui/icons";
import { EmptyState, Segmented, UndoRedoButtons } from "../ui/common";
import { AccountEditor, CategoryEditor, TagEditor } from "../ui/editors";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { formatMoney } from "../model/money";
import SettingsSection from "./Settings";
import { HeroStat } from "../ui/parts";

const SECTIONS = [
  { key: "kategoriler", icon: Tags, label: "Kategoriler", desc: "Kategori ve alt kategorilerini düzenle" },
  { key: "odeme", icon: CreditCard, label: "Ödeme yöntemleri", desc: "Nakit, kartların" },
  { key: "etiketler", icon: Hash, label: "Etiketler", desc: "Kayıtlarını etiketle" },
  { key: "kisayollar", icon: Zap, label: "Kısayollar ve şablonlar", desc: "Tek dokunuşla eklemeler" },
  { key: "silinenler", icon: Trash2, label: "Son silinenler", desc: "Silinen kayıtları geri getir" },
  { key: "kurlar", icon: Coins, label: "Para birimleri", desc: "₺, $, € ve manuel kur" },
  { key: "ayarlar", icon: Settings, label: "Ayarlar", desc: "Görünüm, gizlilik, kilit, yedek, menü adı" },
];


function CategoriesSection() {
  const k = useKesem();
  const [kind, setKind] = useState("expense");
  const [editor, setEditor] = useState(null);
  const tops = k.topCategories(kind);
  return (
    <>
      <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Gider" }, { value: "income", label: "Gelir" }]} label="Kategori türü" />
      <div className="k-card-list mt">
        {tops.map((c) => (
          <div key={c.id} className="k-manage-group">
            <button type="button" className="k-manage-row" onClick={() => setEditor(c)}>
              <Bubble icon={c.icon} color={c.color} size={38} />
              <span>{c.name}</span>
              <ChevronRight size={16} />
            </button>
            {k.subCategories(c.id).map((s) => (
              <button key={s.id} type="button" className="k-manage-row sub" onClick={() => setEditor(s)}>
                <span className="k-dot" style={{ "--c": `var(--kc-${s.color})` }} />
                <span>{s.name}</span>
                <ChevronRight size={14} />
              </button>
            ))}
            <button type="button" className="k-manage-row sub add" onClick={() => setEditor({ kind, parentId: c.id })}>
              <Plus size={14} /> <span>Alt kategori ekle</span>
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="k-btn tonal full mt" onClick={() => setEditor({ kind })}>
        <Plus size={17} /> Yeni kategori
      </button>
      {editor && <CategoryEditor key={editor.id || "new"} initial={editor} onClose={() => setEditor(null)} />}
    </>
  );
}

function AccountsSection() {
  const k = useKesem();
  const [editor, setEditor] = useState(null);
  return (
    <>
      <div className="k-card-list">
        {k.accounts.map((a) => (
          <button key={a.id} type="button" className="k-manage-row" onClick={() => setEditor(a)}>
            <Bubble icon={a.type === "cash" ? "cash" : a.type === "card" ? "card" : "wallet"} color={a.color} size={38} />
            <span>{a.name}</span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      <button type="button" className="k-btn tonal full mt" onClick={() => setEditor({})}>
        <Plus size={17} /> Yeni ödeme yöntemi
      </button>
      <p className="k-hint">Örnek: “Akbank Kredi Kartı”. Silinen bir yöntemin eski kayıtları adıyla görünmeye devam eder.</p>
      {editor && <AccountEditor key={editor.id || "new"} initial={editor} onClose={() => setEditor(null)} />}
    </>
  );
}

function TagsSection() {
  const k = useKesem();
  const [editor, setEditor] = useState(null);
  const counts = useMemo(() => {
    const m = new Map();
    for (const t of k.transactions) for (const id of t.tagIds || []) m.set(id, (m.get(id) || 0) + 1);
    return m;
  }, [k.transactions]);
  return (
    <>
      {k.tags.length ? (
        <div className="k-card-list">
          {k.tags.map((t) => (
            <button key={t.id} type="button" className="k-manage-row" onClick={() => setEditor(t)}>
              <span className="k-hash">#</span>
              <span>{t.name}</span>
              <em>{counts.get(t.id) || 0} kayıt</em>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Hash size={30} />} title="Etiket yok" text="Bir harcama eklerken etiket yazarsan burada görünür." />
      )}
      <button type="button" className="k-btn tonal full mt" onClick={() => setEditor({})}>
        <Plus size={17} /> Yeni etiket
      </button>
      {editor && <TagEditor key={editor.id || "new"} initial={editor} onClose={() => setEditor(null)} />}
    </>
  );
}

function TemplatesSection() {
  const k = useKesem();
  const app = useApp();
  return (
    <>
      {k.templates.length ? (
        <div className="k-card-list">
          {k.templates.map((t) => {
            const c = k.catById(t.categoryId);
            return (
              <div key={t.id} className="k-manage-row plain">
                <button type="button" className="k-manage-main" onClick={() => app.openTemplate({ initial: t })}>
                  <Bubble icon={c.icon} color={c.color} size={38} />
                  <span>
                    {t.name}
                    <small>
                      {t.amountMinor ? <Amt>{formatMoney(t.amountMinor, t.currency)}</Amt> : "Tutar her seferinde sorulur"} · {t.useCount || 0} kullanım
                    </small>
                  </span>
                </button>
                <button type="button" role="switch" aria-checked={!!t.quick} aria-label={`${t.name} ana sayfada göster`} className={`k-toggle ${t.quick ? "on" : ""}`} onClick={() => k.saveTemplate({ id: t.id, quick: !t.quick })}>
                  <i />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Zap size={30} />} title="Henüz kısayol yok" text="Sık yaptığın bir harcamayı kısayol yap; Ana Sayfa'dan tek dokunuşla eklersin." />
      )}
      <button type="button" className="k-btn tonal full mt" onClick={() => app.openTemplate({})}>
        <Plus size={17} /> Yeni kısayol
      </button>
    </>
  );
}

function TrashSection() {
  const k = useKesem();
  const items = k.deletedTransactions;
  if (!items.length) return <EmptyState icon={<Trash2 size={30} />} title="Silinen kayıt yok" text="Sildiğin kayıtlar burada durur; istediğin zaman geri getirebilirsin." />;
  return (
    <div className="k-card-list">
      {items.map((t) => (
        <div key={t.id} className="k-trash-row">
          <TxRow tx={t} />
          <div className="k-trash-actions">
            <button type="button" className="k-btn tonal sm" onClick={() => k.restoreTransaction(t.id)}>
              <RotateCcw size={15} /> Geri yükle
            </button>
            <button type="button" className="k-btn danger-ghost sm" onClick={() => k.purgeTransaction(t.id)}>
              Kalıcı sil
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CurrenciesSection() {
  const k = useKesem();
  const enabled = k.enabledCurrencies;
  const toggle = (c) => k.saveRates({ enabled: enabled.includes(c) ? enabled.filter((x) => x !== c) : [...enabled, c] });
  const setRate = (c, minor) => k.saveRates({ rates: { ...k.rates, [c]: { rate: minor / 100, updatedAt: Date.now() } } });
  return (
    <>
      <p className="k-hint" style={{ marginTop: 0 }}>Kurları sen girersin; internet gerekmez. Bir kayıt eklerken o günkü kur kayda yazılır, sonradan değişse de eski kayıtların ₺ karşılığı değişmez.</p>
      <div className="k-card-list k-gap">
        {CURRENCIES.map((c) => (
          <div key={c} className="k-manage-row plain" style={{ flexWrap: "wrap" }}>
            <span className="k-menu-icon" style={{ fontWeight: 800 }}>{currencySymbol(c)}</span>
            <span>{c}<small>{CURRENCY_NAMES[c]}{c !== "TRY" && k.rates[c] ? ` · 1 ${currencySymbol(c)} = ${formatRate(k.rates[c].rate)} ₺` : ""}</small></span>
            {c === "TRY" ? <em>Ana para birimi</em> : (
              <button type="button" role="switch" aria-checked={enabled.includes(c)} aria-label={`${c} kullan`} className={`k-toggle ${enabled.includes(c) ? "on" : ""}`} onClick={() => toggle(c)}><i /></button>
            )}
          </div>
        ))}
      </div>
      {CURRENCIES.filter((c) => c !== "TRY" && enabled.includes(c)).map((c) => (
        <div key={c} className="k-gap">
          <div className="k-label">1 {currencySymbol(c)} kaç ₺?</div>
          <AmountField label={`${c} kuru`} value={Math.round((k.rates[c]?.rate || 0) * 100)} onChange={(v) => setRate(c, v)} placeholder="Kuru gir" />
        </div>
      ))}
    </>
  );
}

function sectionHero(section, k) {
  switch (section) {
    case "kategoriler": return { cap: "Kategoriler", value: k.topCategories("expense").length, sub: `gider kategorisi · ${k.topCategories("income").length} gelir kategorisi` };
    case "odeme": return { cap: "Ödeme yöntemleri", value: k.accounts.length, sub: k.accounts.filter((a) => a.type === "card").length + " kart · " + k.accounts.filter((a) => a.type === "cash").length + " nakit" };
    case "etiketler": return { cap: "Etiketler", value: k.tags.length, sub: "kayıtlarını gruplamak için" };
    case "kisayollar": return { cap: "Kısayollar", value: k.templates.length, sub: `${k.templates.filter((t) => t.quick).length} tanesi ana sayfada · ${k.templates.reduce((s, t) => s + (t.useCount || 0), 0)} kez kullanıldı` };
    case "kurlar": return { cap: "Kullanılan para birimleri", value: k.enabledCurrencies.join(" · "), sub: "Kurlar elle girilir" };
    case "silinenler": return { cap: "Son silinenler", value: k.deletedTransactions.length, sub: "geri getirilebilir kayıt" };
    default: return { cap: "Gizlilik ve güvenlik", value: k.lock.enabled ? "Kilit açık" : "Kilit kapalı", sub: `Gizlilik modu ${k.settings.privacy ? "açık" : "kapalı"} · veriler bu cihazda` };
  }
}

const BODY = { kurlar: CurrenciesSection, kategoriler: CategoriesSection, odeme: AccountsSection, etiketler: TagsSection, kisayollar: TemplatesSection, gorunum: SettingsSection, silinenler: TrashSection, ayarlar: SettingsSection };

function SectionPage({ section, onBack }) {
  const k = useKesem();
  const meta = SECTIONS.find((s) => s.key === section) || (section === "kurlar" ? { label: "Para birimleri", desc: "₺, $, € ve manuel kur" } : section === "gorunum" ? SECTIONS.find((s) => s.key === "ayarlar") : null);
  const Body = BODY[section];
  if (!meta || !Body) return null;
  return (
    <div className="k-page">
      <PageHeader title={meta.label} subtitle={meta.desc} onBack={onBack} right={<UndoRedoButtons />} />
      <HeroStat {...sectionHero(section, k)} />
      <div className="k-section-body">
        <Body />
      </div>
      <div className="k-page-end" />
    </div>
  );
}

const FEATURE = { butce: BudgetPage, birikimler: GoalsPage, borclar: DebtsPage, takvim: CalendarPage, istekler: WishesPage, alisveris: ShoppingPage, rozetler: BadgesPage };

function Launcher({ section }) {
  const app = useApp();
  const k = useKesem();
  const f = useFinance();
  const st = f.status;
  const goal0 = k.goals[0];
  const bal = personBalances({ people: k.people, debts: k.debts, rates: k.rates });
  const net = bal.reduce((s, b) => s + b.net, 0);
  const next = f.planned.find((i) => i.kind !== "debt");
  const leftPlans = k.installments.reduce((s, p) => s + installmentProgress(p).leftCount, 0);
  const open = k.shopping.filter((i) => !i.doneAt).length;
  const wishes = k.wishes.filter((w) => !w.boughtAt).length;
  const go = (key) => app.navigate(`daha-fazla/${key}`, { replace: app.isTablet && !!section });
  const Tile = ({ k: key, icon: I, label, sub, cls = "calm", size = "b-1x1", style }) => (
    <button type="button" className={`k-card ${cls} ${size}`} style={style} onClick={() => go(key)}>
      <span className="k-tile-ico"><I size={18} /></span>
      <span style={{ minWidth: 0, width: "100%" }}>
        <span className="k-tile-title" style={{ display: "block", fontSize: 14 }}>{label}</span>
        <span className="k-tile-sub k-clamp2" style={{ display: "-webkit-box" }}>{sub}</span>
      </span>
    </button>
  );
  return (
    <div className="k-bento-wrap">
      <div className="k-bento">
        <button type="button" className="k-card hero b-2x2" onClick={() => go("butce")} aria-label="Bütçe">
          <div className="k-cap"><Target size={14} /> Bütçe</div>
          {st.hasBudget ? (
            <>
              <Ring value={st.ratio} size={78} stroke={8} state={st.state} label={`Bütçenin ${pct(st.ratio)} kullanıldı`}><span style={{ fontSize: 14 }}>{pct(st.ratio)}</span></Ring>
              <div><div className="k-num md"><Amt>{formatMoney(st.free, "TRY", { hideZeroDecimals: true })}</Amt></div><div className="k-muted" style={{ fontSize: 12.5 }}>kaldı · {STATE_LABEL[st.state]}</div></div>
            </>
          ) : (<><div className="k-num md">Belirle</div><div className="k-muted" style={{ fontSize: 12.5 }}>Aylık bütçeni ve kategori limitlerini ayarla</div></>)}
        </button>
        <Tile k="birikimler" icon={PiggyBank} label="Birikimler" sub={goal0 ? `${goal0.name} · ${pct(goalProjection(goal0).pct)}` : "İlk kumbaranı aç"} cls="accent" />
        <Tile k="borclar" icon={Landmark} label="Borçlar" sub={net === 0 ? "Hesap denk" : net > 0 ? `${formatMoneyText(net, "TRY", { hideZeroDecimals: true })} alacak` : `${formatMoneyText(-net, "TRY", { hideZeroDecimals: true })} borç`} />
        <Tile k="abonelikler" icon={Repeat} label="Abonelikler" sub={`${k.recurrings.length} ödeme`} size="b-2x1" cls="accent" />
        <Tile k="takvim" icon={CalendarClock} label="Takvim" sub={next ? `${next.title} · ${relativeDayLabel(next.days)}` : "Yaklaşan yok"} />
        <Tile k="taksitler" icon={Layers} label="Taksitler" sub={`${leftPlans} taksit kaldı`} />
        <Tile k="istekler" icon={Gift} label="İstekler" sub={`${wishes} ürün`} />
        <Tile k="alisveris" icon={ShoppingBasket} label="Alışveriş" sub={`${open} ürün`} />
        <Tile k="rozetler" icon={Award} label="Rozetler" sub={`${f.streak.current} gün seri`} size="b-3x1" style={{ "--wt": 3 }} />
      </div>
    </div>
  );
}

export default function MorePage({ section, id }) {
  const app = useApp();
  const k = useKesem();
  if (section === "abonelikler" || section === "taksitler") return <RecurringPage tab={section} id={id} />;
  if (FEATURE[section]) {
    const F = FEATURE[section];
    return <F id={id} onBack={() => app.goBack("daha-fazla")} />;
  }
  const menu = (
    <div className="k-page">
      <PageHeader title="Daha Fazla" subtitle="Para yönetimi ve ayarlar" right={<UndoRedoButtons />} />
      <Launcher section={section} />
      <div className="k-section-title">Yönetim</div>
      <div className="k-card-list">
        {SECTIONS.map((s) => (
          <button key={s.key} type="button" className={`k-manage-row big ${section === s.key ? "active" : ""}`} onClick={() => app.navigate(`daha-fazla/${s.key}`, { replace: app.isTablet && !!section })}>
            <span className="k-menu-icon">
              <s.icon size={19} />
            </span>
            <span>
              {s.label}
              <small>{s.desc}</small>
            </span>
            {s.key === "silinenler" && k.deletedTransactions.length > 0 && <em>{k.deletedTransactions.length}</em>}
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      <div className="k-page-end" />
    </div>
  );
  if (!app.isTablet) return section ? <SectionPage section={section} onBack={() => app.goBack("daha-fazla")} /> : menu;
  return (
    <div className="k-md">
      <div className="k-md-master">{menu}</div>
      <div className="k-md-detail">
        {section ? <SectionPage section={section} onBack={() => app.goBack("daha-fazla")} /> : <div className="k-page"><EmptyState icon={<Settings size={30} />} title="Bir bölüm seç" text="Kategorilerini, ödeme yöntemlerini ve görünümü soldan yönet." /></div>}
      </div>
    </div>
  );
}
