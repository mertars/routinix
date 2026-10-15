import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useKesem } from "../state/store";

export default function PageHeader({ title, subtitle, left, right, onBack, large = true }) {
  const { settings, updateSettings } = useKesem();
  const on = !!settings.privacy;
  return (
    <header className={`k-head ${large ? "large" : ""}`}>
      <div className="k-head-bar">
        <div className="k-head-side">
          {onBack ? (
            <button type="button" className="k-back" onClick={onBack} aria-label="Geri">
              <ChevronLeft size={22} />
              <span>Geri</span>
            </button>
          ) : (
            left
          )}
        </div>
        <div className="k-head-side right">
          {right}
          <button type="button" className={`k-icon-btn k-privacy ${on ? "on" : ""}`} aria-pressed={on} aria-label={on ? "Gizlilik modunu kapat (tutarları göster)" : "Gizlilik modunu aç (tutarları gizle)"} onClick={() => updateSettings({ privacy: !on })}>
            {on ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <h1 className="k-title">{title}</h1>
      {subtitle && <p className="k-subtitle">{subtitle}</p>}
    </header>
  );
}
