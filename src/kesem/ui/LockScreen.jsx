import { useEffect, useRef, useState } from "react";
import { Fingerprint, Lock } from "lucide-react";
import { PinPad } from "./PinPad";
import Sheet from "./Sheet";
import { ConfirmSheetBody } from "./common";
import { bioAuth, bioAvailable, nextLockoutMs, verifyPin } from "../state/lock";
import { useKesem } from "../state/store";

// Tam ekran kilit — kilit açılana dek hiçbir sayfa/veri DOM'a konmaz.
export default function LockScreen({ onUnlock }) {
  const k = useKesem();
  const lock = k.lock;
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [bio, setBio] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const busy = useRef(false);
  const remaining = Math.max(0, Math.ceil(((lock.lockedUntil || 0) - now) / 1000));

  useEffect(() => { if (lock.bio?.credId) bioAvailable().then(setBio); }, [lock.bio?.credId]);
  useEffect(() => {
    if (!remaining) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const check = async (value) => {
    if (busy.current) return;
    busy.current = true;
    const ok = await verifyPin(lock, value);
    if (ok) {
      await k.saveLock({ fails: 0, lockedUntil: 0 });
      onUnlock();
    } else {
      const fails = (lock.fails || 0) + 1;
      const wait = nextLockoutMs(fails);
      await k.saveLock({ fails, lockedUntil: wait ? Date.now() + wait : 0 });
      setNow(Date.now());
      setError(wait ? "Çok fazla yanlış deneme. Biraz bekle." : "Yanlış PIN. Tekrar dene.");
      setTimeout(() => { setPin(""); setError(""); }, 650);
    }
    busy.current = false;
  };
  const tryBio = async () => {
    if (await bioAuth(lock.bio.credId)) {
      await k.saveLock({ fails: 0, lockedUntil: 0 });
      onUnlock();
    } else setError("Biyometrik doğrulama yapılamadı. PIN'ini gir.");
  };

  return (
    <div className="k-lock" role="dialog" aria-modal="true" aria-label="Uygulama kilitli">
      <div className="k-lock-inner">
        <span className="k-tile-ico k-lock-ico"><Lock size={22} /></span>
        <h1 className="k-lock-title">Harcama Takibi kilitli</h1>
        <p className="k-lock-sub" role={error || remaining ? "alert" : undefined}>
          {remaining ? `${remaining} sn sonra tekrar deneyebilirsin` : error || "PIN'ini gir"}
        </p>
        <PinPad length={lock.len || 4} value={pin} onChange={setPin} onComplete={check} error={!!error} disabled={remaining > 0}
          extra={bio ? <button type="button" className="k-key" onClick={tryBio} aria-label="Biyometrik ile aç"><Fingerprint size={24} /></button> : null} />
        <button type="button" className="k-btn ghost sm" style={{ marginTop: 18 }} onClick={() => setConfirmWipe(true)}>PIN'imi unuttum</button>
      </div>
      {confirmWipe && (
        <Sheet open onClose={() => setConfirmWipe(false)} title="PIN'ini mi unuttun?" size="sm">
          <ConfirmSheetBody
            text="PIN geri getirilemez. Devam edersen Harcama Takibi verilerinin TAMAMI bu cihazdan silinir ve modül sıfırdan başlar. (Yedeğin varsa sonra içe aktarabilirsin.)"
            confirmLabel="Tüm verileri sil"
            onCancel={() => setConfirmWipe(false)}
            onConfirm={async () => { setConfirmWipe(false); await k.wipeAll(); onUnlock(); }}
          />
        </Sheet>
      )}
    </div>
  );
}
