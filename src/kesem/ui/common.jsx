import { useEffect, useRef } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useKesem } from "../state/store";

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="k-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="k-empty">
      <div className="k-empty-art">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function UndoRedoButtons() {
  const { canUndo, canRedo, undo, redo } = useKesem();
  if (!canUndo && !canRedo) return null;
  return (
    <div className="k-undo-group">
      <button type="button" className="k-icon-btn" disabled={!canUndo} onClick={undo} aria-label="Geri al">
        <Undo2 size={18} />
      </button>
      <button type="button" className="k-icon-btn" disabled={!canRedo} onClick={redo} aria-label="Yinele">
        <Redo2 size={18} />
      </button>
    </div>
  );
}

// Geri Al şeridi — yalnızca uygulama İÇİNDE görünür (bildirim/ses/titreşim yok).
export function Toast() {
  const { toast, dismissToast, undo, redo } = useKesem();
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    if (toast) timer.current = setTimeout(dismissToast, toast.action ? 6500 : 3200);
    return () => clearTimeout(timer.current);
  }, [toast, dismissToast]);
  if (!toast) return null;
  const run = () => {
    dismissToast();
    if (toast.action === "undo") undo();
    else if (toast.action === "redo") redo();
  };
  return (
    <div className="k-toast-wrap" role="status" aria-live="polite">
      <div className={`k-toast ${toast.tone === "error" ? "err" : ""}`} key={toast.id}>
        <span>{toast.message}</span>
        {toast.actionLabel && (
          <button type="button" onClick={run}>
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function ConfirmSheetBody({ text, confirmLabel, onConfirm, onCancel, danger = true }) {
  return (
    <div className="k-confirm">
      <p>{text}</p>
      <div className="k-confirm-actions">
        <button type="button" className="k-btn ghost" onClick={onCancel}>
          Vazgeç
        </button>
        <button type="button" className={`k-btn ${danger ? "danger" : "primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
