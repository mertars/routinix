import { useEffect, useRef, useState } from "react";
import { ChevronRight, Coins, Download, FileSpreadsheet, FileUp, Fingerprint, Lock, RotateCcw, ShieldCheck, Target, Trash2 } from "lucide-react";
import Sheet from "../ui/Sheet";
import { Segmented } from "../ui/common";
import { PinSetupSheet, PinVerifySheet } from "../ui/PinSheets";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { KESEM_DEFAULT_MENU_LABEL, setMenuLabel } from "../config";
import { PALETTES } from "../ui/palettes";
import { bioAvailable, bioRegister } from "../state/lock";
import { BACKUP_VERSION, COLLECTION_LABEL, buildBackup, buildCsv, planImport, validateBackup, COLLECTIONS } from "../model/backup";
import { blobToDataUrl, dataUrlToBlob, downloadBlob } from "../ui/download";
import { dateTimeLabel, trLower } from "../model/dates";

const AUTO = [{ value: "0", label: "Hemen" }, { value: "60", label: "1 dk" }, { value: "300", label: "5 dk" }];
const stamp = () => new Date().toISOString().slice(0, 10);

function Row({ label, hint, children }) {
  return (
    <div className="k-setrow">
      <span className="k-grow"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      {children}
    </div>
  );
}
function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`k-toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button>
  );
}
function Group({ title, children }) {
  return (
    <section className="k-setgroup" aria-label={title}>
      <h2 className="k-section-title" style={{ marginTop: 0 }}>{title}</h2>
      <div className="k-card calm k-setcard">{children}</div>
    </section>
  );
}

// ---- içe aktarma önizleme sayfası ----
function ImportSheet({ file, valid, onClose }) {
  const k = useKesem();
  const [mode, setMode] = useState("merge");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const existing = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map(k.exportData().data[c].map((r) => [r.id, r]))]));
  const plan = planImport(valid.data, existing);
  const r = valid.report;
  const run = async () => {
    setBusy(true);
    const blobs = [];
    for (const rc of valid.receipts) { try { blobs.push({ id: rc.id, blob: await dataUrlToBlob(rc.dataUrl) }); } catch { /* bozuk görsel atlanır */ } }
    const res = await k.importBackup(valid, mode, blobs);
    setBusy(false);
    setDone(res.ok ? `Tamamlandı · ${res.changed} değişiklik uygulandı.` : "İçe aktarma başarısız oldu; hiçbir değişiklik yapılmadı.");
  };
  return (
    <Sheet open onClose={onClose} title="İçe aktarma önizlemesi" size="md">
      <div className="k-form">
        <p className="k-hint" style={{ margin: "0 0 10px" }}><b>{file.name}</b> · sürüm {r.version}{r.exportedAt ? ` · ${dateTimeLabel(Date.parse(r.exportedAt))}` : ""}</p>
        <div className="k-card-list">
          {COLLECTIONS.filter((c) => r.counts[c]).map((c) => (
            <div key={c} className="k-line-item" style={{ padding: "8px 14px" }}>
              <span className="k-grow">{r.counts[c]} {COLLECTION_LABEL[c]}</span>
              <span className="k-tile-sub">{plan[c].add} yeni · {plan[c].update} güncel · {plan[c].same} aynı</span>
            </div>
          ))}
        </div>
        {valid.receipts.length > 0 && <p className="k-hint">{valid.receipts.length} fiş fotoğrafı da içe aktarılacak.</p>}
        {r.skipped.length > 0 && <p className="k-error" role="alert">{r.skipped.length} bozuk kayıt atlanacak (örn. {COLLECTION_LABEL[r.skipped[0].c]}: {r.skipped[0].reason}).</p>}
        {r.warnings.map((w) => <p key={w} className="k-hint">{w}</p>)}
        <div className="k-label">Nasıl uygulansın?</div>
        <Segmented value={mode} onChange={setMode} options={[{ value: "merge", label: "Birleştir" }, { value: "replace", label: "Değiştir" }]} label="İçe aktarma biçimi" />
        <p className="k-hint">{mode === "merge" ? "Mevcut kayıtların korunur; yedekteki yeni kayıtlar eklenir, aynı kayıtta daha yeni olan kalır." : "Mevcut tüm kayıtların silinip yedektekilerle değiştirilir. Geri Al ile döndürebilirsin."}</p>
        {done ? (
          <><p className="k-hint" role="status" style={{ color: "var(--k-ok)", fontWeight: 700 }}>{done}</p><button type="button" className="k-btn primary full k-gap" onClick={onClose}>Tamam</button></>
        ) : (
          <div className="k-form-actions"><button type="button" className="k-btn tonal" onClick={onClose}>Vazgeç</button><button type="button" className={`k-btn ${mode === "replace" ? "danger" : "primary"} grow`} disabled={busy} onClick={run}>{busy ? "Aktarılıyor…" : mode === "replace" ? "Değiştir ve içe aktar" : "İçe aktar"}</button></div>
        )}
      </div>
    </Sheet>
  );
}

export default function SettingsSection() {
  const k = useKesem();
  const app = useApp();
  const { settings } = k;
  const lock = k.lock;
  const [label, setLabel] = useState(app.menuLabel);
  const [sheet, setSheet] = useState(null); // setup | change | disable | wipe
  const [bioOk, setBioOk] = useState(false);
  const [withReceipts, setWithReceipts] = useState(true);
  const [msg, setMsg] = useState("");
  const [imp, setImp] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => { bioAvailable().then(setBioOk); }, []);
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const ctx = () => ({ catName: (id) => k.catById(id).name, accName: (id) => k.accById(id).name, tagName: (id) => k.tagById(id)?.name, rates: k.rates });
  const exportCsv = () => {
    downloadBlob(`harcamalar-${stamp()}.csv`, new Blob([buildCsv(k.transactions, ctx())], { type: "text/csv;charset=utf-8" }));
    flash(`${k.transactions.length} kayıt CSV olarak indirildi.`);
  };
  const exportJson = async () => {
    const { data, meta } = k.exportData();
    let receipts;
    if (withReceipts) {
      const used = new Set(data.transactions.map((t) => t.receiptId).filter(Boolean));
      receipts = [];
      for (const b of await k.getAllBlobs()) if (used.has(b.id)) receipts.push({ id: b.id, dataUrl: await blobToDataUrl(b.blob) });
    }
    const out = buildBackup({ data, meta, receipts });
    downloadBlob(`harcama-yedek-${stamp()}.json`, new Blob([JSON.stringify(out)], { type: "application/json" }));
    await k.updateSettings({ lastBackupAt: Date.now() });
    flash(`Yedek indirildi (${data.transactions.length} işlem${receipts?.length ? `, ${receipts.length} fiş` : ""}).`);
  };
  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 60 * 1024 * 1024) { flash("Dosya çok büyük (en fazla 60 MB)."); return; }
    const text = await f.text();
    const v = validateBackup(text, f.size);
    if (!v.ok) { flash(v.error); return; }
    setImp({ file: f, valid: v });
  };

  const enableBio = async () => {
    try {
      const id = await bioRegister(app.userKey);
      if (id) { await k.saveLock({ bio: { credId: id } }); flash("Biyometrik kilit açıldı."); }
    } catch { flash("Biyometrik kayıt yapılamadı veya iptal edildi."); }
  };
  const savePin = async (rec) => { await k.saveLock({ ...rec, enabled: true, fails: 0, lockedUntil: 0, autoLock: lock.autoLock ?? 0 }); app.markUnlocked(); flash("Kilit açıldı. Uygulama arka plandan dönünce PIN istenecek."); };

  return (
    <div className="k-setpage">
      {msg && <div className="k-card accent k-setmsg" role="status">{msg}</div>}

      <Group title="Görünüm">
        <Row label="Tema"><span /></Row>
        <Segmented value={settings.mode} onChange={(v) => k.updateSettings({ mode: v })} options={[{ value: "auto", label: "Routinix gibi" }, { value: "light", label: "Gündüz" }, { value: "dark", label: "Gece" }]} label="Görünüm modu" />
        <div className="k-palettes" style={{ marginTop: 12 }}>
          {PALETTES.map((p) => (
            <button key={p.key} type="button" aria-pressed={settings.palette === p.key} className={`k-palette ${settings.palette === p.key ? "on" : ""}`} data-k-palette={p.key} onClick={() => k.updateSettings({ palette: p.key })}>
              <span className="k-palette-swatch" /><b>{p.name}</b>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Gizlilik ve güvenlik">
        <Row label="Gizlilik modu" hint="Tutarları bulanıklaştırır; başlıktaki göz tuşuyla da değişir"><Switch checked={!!settings.privacy} onChange={(v) => k.updateSettings({ privacy: v })} label="Gizlilik modu" /></Row>
        <Row label="Uygulama kilidi" hint={lock.enabled ? `${lock.len} haneli PIN açık` : "PIN ile koru"}>
          <Switch checked={!!lock.enabled} onChange={(v) => setSheet(v ? "setup" : "disable")} label="Uygulama kilidi" />
        </Row>
        {lock.enabled && (
          <>
            <Row label="PIN'i değiştir"><button type="button" className="k-btn tonal sm" onClick={() => setSheet("change")}><Lock size={15} /> Değiştir</button></Row>
            {bioOk ? (
              <Row label="Biyometrik kilit" hint="Parmak izi / Yüz tanıma ile aç; PIN her zaman yedek"><Switch checked={!!lock.bio} onChange={(v) => (v ? enableBio() : k.saveLock({ bio: null }))} label="Biyometrik kilit" /></Row>
            ) : (
              <Row label="Biyometrik kilit" hint="Bu cihaz/tarayıcı desteklemiyor — yalnızca PIN kullanılır"><Fingerprint size={18} className="k-muted" /></Row>
            )}
            <Row label="Otomatik kilitle" hint="Arka plandan dönünce"><span /></Row>
            <Segmented value={String(lock.autoLock ?? 0)} onChange={(v) => k.saveLock({ autoLock: +v })} options={AUTO} label="Otomatik kilit süresi" />
          </>
        )}
        <p className="k-hint" style={{ margin: "10px 2px 0" }}><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> PIN yalnızca türevi (PBKDF2) olarak saklanır. Bu kilit, cihazını elinden bırakmışken başkasının açmasına karşıdır; verilerin cihazda şifrelenmediğini unutma.</p>
      </Group>

      <Group title="Bütçe ve para">
        <Row label="Ay başlangıç günü" hint="Maaş gününe göre bütçe dönemi">
          <div className="k-stepper">
            <button type="button" className="k-icon-btn" onClick={() => k.saveBudget({ startDay: Math.max(1, k.budget.startDay - 1) })} disabled={k.budget.startDay <= 1} aria-label="Bir gün azalt">−</button>
            <b>{k.budget.startDay}</b>
            <button type="button" className="k-icon-btn" onClick={() => k.saveBudget({ startDay: Math.min(28, k.budget.startDay + 1) })} disabled={k.budget.startDay >= 28} aria-label="Bir gün artır">+</button>
          </div>
        </Row>
        <Row label="Planlı ödemeleri bütçeden düş"><Switch checked={k.budget.includePlanned !== false} onChange={(v) => k.saveBudget({ includePlanned: v })} label="Planlı ödemeleri düş" /></Row>
        <button type="button" className="k-setlink" onClick={() => app.navigate("daha-fazla/butce")}><Target size={18} /><span>Bütçe ve kategori limitleri</span><ChevronRight size={16} /></button>
        <button type="button" className="k-setlink" onClick={() => app.navigate("daha-fazla/kurlar")}><Coins size={18} /><span>Para birimleri ve kurlar</span><ChevronRight size={16} /></button>
      </Group>

      <Group title="Veri ve yedek">
        <Row label="Son yedek" hint={settings.lastBackupAt ? dateTimeLabel(settings.lastBackupAt) : "Henüz yedek almadın"}><span /></Row>
        <Row label="Fişleri yedeğe ekle" hint="Dosya büyüyebilir"><Switch checked={withReceipts} onChange={setWithReceipts} label="Fişleri yedeğe ekle" /></Row>
        <div className="k-setbtns">
          <button type="button" className="k-btn primary" onClick={exportJson}><Download size={17} /> JSON yedek indir</button>
          <button type="button" className="k-btn tonal" onClick={exportCsv}><FileSpreadsheet size={17} /> CSV indir</button>
          <button type="button" className="k-btn tonal" onClick={() => fileRef.current?.click()}><FileUp size={17} /> Yedekten içe aktar</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={pickFile} aria-label="Yedek dosyası seç" />
        </div>
        <p className="k-hint" style={{ margin: "10px 2px 0" }}>Veriler yalnızca bu cihazda, hesabına özel saklanır{k.persistent ? "" : " — dikkat: bu tarayıcı kalıcı depolamaya izin vermiyor, sekme kapanınca silinir"}. CSV Excel için (noktalı virgül, UTF-8); yedek sürümü {BACKUP_VERSION}.</p>
      </Group>

      <Group title="Genel">
        <Row label="Hamburger menüdeki ad"><span /></Row>
        <div className="k-inline-form">
          <input className="k-input" value={label} maxLength={28} onChange={(e) => setLabel(e.target.value)} aria-label="Menü adı" placeholder={KESEM_DEFAULT_MENU_LABEL} />
          <button type="button" className="k-btn primary" onClick={() => { setMenuLabel(label); flash("Menü adı güncellendi."); }}>Kaydet</button>
        </div>
        <button type="button" className="k-setlink" onClick={() => k.updateSettings({ onboarded: false, onbForce: true })}><RotateCcw size={18} /><span>Tanışma ekranını yeniden göster</span><ChevronRight size={16} /></button>
        <button type="button" className="k-setlink danger" onClick={() => setSheet("wipe")}><Trash2 size={18} /><span>Tüm verileri sil</span><ChevronRight size={16} /></button>
      </Group>

      {sheet === "setup" && <PinSetupSheet title="PIN belirle" onDone={savePin} onClose={() => setSheet(null)} />}
      {sheet === "change" && <PinVerifySheet lock={lock} title="Mevcut PIN" onVerified={() => setTimeout(() => setSheet("setup2"), 0)} onClose={() => sheet === "change" && setSheet(null)} />}
      {sheet === "setup2" && <PinSetupSheet title="Yeni PIN" onDone={savePin} onClose={() => setSheet(null)} />}
      {sheet === "disable" && <PinVerifySheet lock={lock} title="Kilidi kapat" onVerified={async () => { await k.saveLock({ enabled: false, hash: null, salt: null, bio: null, fails: 0, lockedUntil: 0 }); flash("Kilit kapatıldı."); }} onClose={() => setSheet(null)} />}
      {sheet === "wipe" && <WipeSheet onClose={() => setSheet(null)} onWipe={async () => { setSheet(null); await k.wipeAll(); }} />}
      {imp && <ImportSheet file={imp.file} valid={imp.valid} onClose={() => setImp(null)} />}
    </div>
  );
}

function WipeSheet({ onClose, onWipe }) {
  const [t, setT] = useState("");
  const ok = trLower(t.trim()) === "sil";
  return (
    <Sheet open onClose={onClose} title="Tüm veriler silinsin mi?" size="sm">
      <div className="k-confirm">
        <p>Harcamaların, kategorilerin, bütçen, kumbaraların ve kilit dahil Harcama Takibi verilerinin TAMAMI bu cihazdan silinir. Bu işlem geri alınamaz. Önce yedek almanı öneririz.</p>
        <p className="k-hint" style={{ margin: "10px 0 6px" }}>Onaylamak için <b>SİL</b> yaz:</p>
        <input className="k-input" value={t} onChange={(e) => setT(e.target.value)} aria-label="Onay metni" autoCapitalize="characters" />
        <div className="k-confirm-actions"><button type="button" className="k-btn tonal" onClick={onClose}>Vazgeç</button><button type="button" className="k-btn danger" disabled={!ok} onClick={onWipe}>Hepsini sil</button></div>
      </div>
    </Sheet>
  );
}
