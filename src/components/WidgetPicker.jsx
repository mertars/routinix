import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X } from "lucide-react";
import { WIDGET_CATALOG, WIDGET_CATEGORIES } from "../utils/taskWidgets";
import PopoverPortal from "./PopoverPortal";

// Kategorize edilmiş, aranabilir widget seçim popover'ı — TaskCard.jsx'teki
// "+ Widget Ekle" butonuna VEYA kart üzerindeyken "/" tuşuna basılınca açılır
// (bkz. TaskCard.jsx'teki tetikleyici mantık, burada yalnızca açık/kapalı ve
// arama var). document.body'ye PORTALLANIR (bkz. PopoverPortal.jsx dosya
// başı yorumu — TaskCard'ın `.card-glow` (contain: layout style) atası
// olmadan bu popover görünmez/tıklanamaz kalırdı, canlı testte YAKALANDI).
export default function WidgetPicker({ anchorRef, open, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Popover DOM'a girdiği karede odaklan — bir sonraki animasyon karesi
      // beklenmeden input henüz "geçiş" (transition) sırasında focus
      // kaybedebilir, requestAnimationFrame bunu bir tık geciktirir.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const grouped = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const filtered = q ? WIDGET_CATALOG.filter((w) => w.label.toLocaleLowerCase("tr").includes(q)) : WIDGET_CATALOG;
    return WIDGET_CATEGORIES.map((cat) => ({ ...cat, items: filtered.filter((w) => w.category === cat.key) })).filter((cat) => cat.items.length > 0);
  }, [query]);

  return (
    <PopoverPortal
      anchorRef={anchorRef}
      open={open}
      onClose={onClose}
      className="w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden animate-[fadeIn_0.15s_ease]"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 24px 48px -20px rgba(0,0,0,0.5), 0 0 0 1px rgba(6,182,212,0.12)",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "var(--border-default)" }}>
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          placeholder="Widget ara..."
          className="flex-1 min-w-0 bg-transparent text-[12.5px] font-medium focus:outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        <button onClick={onClose} aria-label="Kapat" className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors" style={{ color: "var(--text-faint)" }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-h-[320px] overflow-y-auto no-scrollbar p-2 flex flex-col gap-3">
        {grouped.length === 0 && <p className="text-[11.5px] text-center py-4" style={{ color: "var(--text-faint)" }}>Eşleşen widget yok</p>}
        {grouped.map((cat) => (
          <div key={cat.key} className="flex flex-col gap-1">
            <p className="px-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#06B6D4" }}>
              {cat.label}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {cat.items.map((w) => {
                const Icon = w.icon;
                return (
                  <button
                    key={w.type}
                    onClick={() => onPick(w.type)}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[rgba(16,185,129,0.10)]"
                    style={{ background: "rgba(var(--overlay-rgb),0.04)" }}
                  >
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.14)", color: "#10B981" }}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11.5px] font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
                      {w.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PopoverPortal>
  );
}
