import { useState } from "react";
import { X } from "lucide-react";
import { WIDGET_CATALOG, WIDGET_CATEGORIES } from "../utils/taskWidgets";
import PopoverPortal from "./PopoverPortal";

// "Görev Özellikleri" popover'ı — ManualPlanBuilder.jsx'in TEK, plan-geneli
// alan görünürlüğü anahtarlarını (ATTRIBUTE_TOGGLES/enabledAttrs — mantığı
// DEĞİŞMEDİ, yalnızca render konumu bu popover'a taşındı) YENİ widget
// kütüphanesiyle (bkz. utils/taskWidgets.js) TEK bir estetikte birleştirir.
//
// Widget seçimi "Aktif Güne Uygula"ya kadar yalnızca bu popover'ın YEREL
// state'inde yaşar; onaylanınca ManualPlanBuilder'ın kendi setDayTasks'ı
// üzerinden aktif günün TÜM görevlerine taze birer widget kopyası eklenir —
// DayBatchWidgetModal + usePlanStudio.batchApplyWidgets İLE AYNI "toplu
// uygula" ilkesi, burada henüz kaydedilmemiş yerel taslak state'i üzerinde
// çalışır (bkz. TaskWidgets.jsx'teki WidgetAddButton/WidgetList — GRANÜLER,
// tek-tek görev bazlı ekleme için zaten her görev satırında var; bu popover
// bunun YERİNE değil, YANINA eklenen toplu bir kısayol).
export default function TaskAttributesModal({
  anchorRef,
  open,
  onClose,
  attributeToggles,
  enabledAttrs,
  onToggleAttr,
  onApplyWidgets,
  activeDayHasTasks,
}) {
  const [selectedTypes, setSelectedTypes] = useState(() => new Set());

  const toggleType = (type) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleClose = () => {
    setSelectedTypes(new Set());
    onClose();
  };

  const canApply = selectedTypes.size > 0 && activeDayHasTasks;

  const handleApply = () => {
    if (!canApply) return;
    onApplyWidgets(Array.from(selectedTypes));
    setSelectedTypes(new Set());
    onClose();
  };

  return (
    <PopoverPortal
      anchorRef={anchorRef}
      open={open}
      onClose={handleClose}
      className="w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden animate-[fadeIn_0.15s_ease]"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-default)",
        boxShadow: "0 24px 48px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(6,182,212,0.14)",
      }}
    >
      <div className="flex items-center justify-between px-3.5 py-3 border-b" style={{ borderColor: "var(--border-default)" }}>
        <p className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
          ⚙️ Görev Özellikleri
        </p>
        <button onClick={handleClose} aria-label="Kapat" className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors" style={{ color: "var(--text-faint)" }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto no-scrollbar p-3.5 flex flex-col gap-3.5">
        {/* Standart Seçenekler — mevcut ATTRIBUTE_TOGGLES, davranış BİREBİR
            AYNI (hasAttr/toggleAttr), yalnızca burada gösteriliyor. */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#06B6D4" }}>
            Standart Seçenekler
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {attributeToggles.map(({ key, label, icon: Icon }) => {
              const active = enabledAttrs.has(key);
              return (
                <button
                  key={key}
                  onClick={() => onToggleAttr(key)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors"
                  style={{
                    background: active ? "rgba(6,182,212,0.14)" : "rgba(var(--overlay-rgb),0.04)",
                    border: active ? "1px solid rgba(6,182,212,0.5)" : "1px solid transparent",
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: active ? "rgba(6,182,212,0.22)" : "rgba(var(--overlay-rgb),0.08)", color: active ? "#06B6D4" : "var(--text-faint)" }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[11.5px] font-semibold truncate" style={{ color: active ? "#06B6D4" : "var(--text-secondary)" }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Widget Kütüphanesi — DayBatchWidgetModal.jsx İLE AYNI kategorize
            checkbox grid deseni. */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#06B6D4" }}>
            Widget Kütüphanesi
          </p>
          <div className="flex flex-col gap-2.5">
            {WIDGET_CATEGORIES.map((cat) => {
              const items = WIDGET_CATALOG.filter((w) => w.category === cat.key);
              return (
                <div key={cat.key} className="flex flex-col gap-1">
                  <p className="px-0.5 text-[9.5px] font-bold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    {cat.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((w) => {
                      const Icon = w.icon;
                      const active = selectedTypes.has(w.type);
                      return (
                        <button
                          key={w.type}
                          onClick={() => toggleType(w.type)}
                          className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors"
                          style={{
                            background: active ? "rgba(16,185,129,0.14)" : "rgba(var(--overlay-rgb),0.04)",
                            border: active ? "1px solid rgba(16,185,129,0.5)" : "1px solid transparent",
                          }}
                        >
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: active ? "rgba(16,185,129,0.22)" : "rgba(var(--overlay-rgb),0.08)", color: active ? "#10B981" : "var(--text-faint)" }}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[11.5px] font-semibold truncate" style={{ color: active ? "#10B981" : "var(--text-secondary)" }}>
                            {w.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-3.5 py-3 border-t flex flex-col gap-1.5" style={{ borderColor: "var(--border-default)" }}>
        <button
          onClick={handleApply}
          disabled={!canApply}
          className="w-full rounded-xl h-10 text-[12.5px] font-bold transition-all disabled:opacity-40"
          style={{
            background: canApply ? "linear-gradient(135deg, #10B981, #06B6D4)" : "rgba(var(--overlay-rgb),0.08)",
            color: canApply ? "#04040a" : "var(--text-faint)",
            boxShadow: canApply ? "0 8px 20px -8px rgba(16,185,129,0.55)" : "none",
          }}
        >
          Aktif Güne Uygula
        </button>
        {!activeDayHasTasks && (
          <p className="text-[10.5px] text-center" style={{ color: "var(--text-faint)" }}>
            Bu günde henüz görev yok — önce bir görev ekle.
          </p>
        )}
      </div>
    </PopoverPortal>
  );
}
