import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "back"];

// Özel sayısal tuş takımı — sistem klavyesi hiç açılmaz, böylece tek elle,
// hızlı tutar girişi. Sağ sütunda büyük "Kaydet" tuşu.
export default function NumPad({ onKey, onSubmit, canSubmit, submitLabel = "Kaydet" }) {
  return (
    <div className="k-pad" role="group" aria-label="Tutar tuş takımı">
      <div className="k-pad-keys">
        {KEYS.map((k) => (
          <button key={k} type="button" className="k-key" onClick={() => onKey(k)} aria-label={k === "back" ? "Sil" : k === "," ? "Virgül" : k}>
            {k === "back" ? <Delete size={22} /> : k}
          </button>
        ))}
      </div>
      <button type="button" className="k-pad-submit" disabled={!canSubmit} onClick={onSubmit}>
        {submitLabel}
      </button>
    </div>
  );
}
