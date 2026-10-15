import { useState } from "react";
import Sheet from "./Sheet";
import { PinPad } from "./PinPad";
import { Segmented } from "./common";
import { makePinRecord, verifyPin } from "../state/lock";

// Yeni PIN: uzunluk seç (4/6) → gir → tekrar gir.
export function PinSetupSheet({ title = "Yeni PIN", onDone, onClose }) {
  const [len, setLen] = useState(4);
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const done = async (value) => {
    if (step === 0) { setFirst(value); setStep(1); setTimeout(() => setPin(""), 150); return; }
    if (value !== first) { setErr("PIN'ler eşleşmedi. Baştan dene."); setTimeout(() => { setStep(0); setFirst(""); setPin(""); setErr(""); }, 800); return; }
    onDone(await makePinRecord(value));
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={title} size="sm">
      <div className="k-form" style={{ alignItems: "center" }}>
        {step === 0 && <Segmented value={String(len)} onChange={(v) => { setLen(+v); setPin(""); }} options={[{ value: "4", label: "4 haneli" }, { value: "6", label: "6 haneli" }]} label="PIN uzunluğu" />}
        <p className="k-hint" role="status" style={{ textAlign: "center", margin: "12px 0" }}>{err || (step === 0 ? "Bir PIN belirle" : "PIN'i tekrar gir")}</p>
        <PinPad key={step + "-" + len} length={len} value={pin} onChange={setPin} onComplete={done} error={!!err} />
      </div>
    </Sheet>
  );
}

// Mevcut PIN'i doğrula (kilidi kapatma / PIN değiştirme öncesi).
export function PinVerifySheet({ lock, title = "PIN'ini gir", onVerified, onClose }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const check = async (v) => {
    if (await verifyPin(lock, v)) { onVerified(); onClose(); }
    else { setErr("Yanlış PIN."); setTimeout(() => { setPin(""); setErr(""); }, 600); }
  };
  return (
    <Sheet open onClose={onClose} title={title} size="sm">
      <div className="k-form" style={{ alignItems: "center" }}>
        <p className="k-hint" role="status" style={{ textAlign: "center", margin: "4px 0 12px" }}>{err || "Devam etmek için mevcut PIN'ini gir"}</p>
        <PinPad length={lock.len || 4} value={pin} onChange={setPin} onComplete={check} error={!!err} />
      </div>
    </Sheet>
  );
}
