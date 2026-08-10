import { useState, useMemo } from "react";
import { X, CalendarDays, CalendarRange, ListChecks as CustomDaysIcon } from "lucide-react";
import { WIDGET_CATALOG, WIDGET_CATEGORIES, createWidget } from "../utils/taskWidgets";
import PopoverPortal from "./PopoverPortal";

// Haftanın günü (Pzt İLK, kullanıcının istediği Türkçe hafta sırası) → JS
// `Date.getDay()` değeri (0=Paz..6=Cmt) eşlemesi — "Özel Günler" checkbox'ları
// için.
const WEEKDAYS = [
  { day: 1, label: "Pzt" },
  { day: 2, label: "Sal" },
  { day: 3, label: "Çar" },
  { day: 4, label: "Per" },
  { day: 5, label: "Cuma" },
  { day: 6, label: "Cmt" },
  { day: 0, label: "Paz" },
];

// DÜRÜSTLÜK NOTU: plan modelinde gün numarasına bağlı GERÇEK/kalıcı bir
// takvim tarihi YOK. icsExport.js'teki AYNI, halihazırda kullanıcıya sunulan
// yaklaşımı tekrar kullanıyoruz: 1. gün = bugün, sonrası ardışık. Bu bir
// zamanlayıcı DEĞİL, yalnızca "Özel Günler" seçiminin haftanın hangi gününe
// denk geldiğini tahmin eden bir sezgi.
function dayNumberToWeekday(dayNumber) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(0, dayNumber - 1));
  return d.getDay();
}

const SCOPES = [
  { key: "active", label: "Açık Olan Güne", icon: CalendarDays },
  { key: "all", label: "Tüm Günlere", icon: CalendarRange },
  { key: "custom", label: "Özel Günler", icon: CustomDaysIcon },
];

// Plan ekranındaki "+ Günlük Widget / Şablon Ekle" butonuna basınca açılan
// popover (Day Batch Selector). Kapsam (hangi günler) + widget kütüphanesi
// (hangi araçlar) seçilir, "Onayla ve Günlere Uygula" ile
// usePlanStudio.batchApplyWidgets(dayNumbers, widgetTypes)'a iletilir.
// document.body'ye PORTALLANIR (bkz. PopoverPortal.jsx dosya başı yorumu —
// `.card-glow` (contain: layout style) atası olmadan bu popover da
// TaskCard'daki WidgetPicker gibi görünmez/tıklanamaz kalırdı).
export default function DayBatchWidgetModal({ anchorRef, open, onClose, calendar, activeDayNumber, onApply }) {
  const [scope, setScope] = useState("active");
  const [selectedWeekdays, setSelectedWeekdays] = useState(() => new Set());
  const [selectedTypes, setSelectedTypes] = useState(() => new Set());

  const unlockedCells = useMemo(() => (calendar || []).filter((c) => !c.locked), [calendar]);

  const resolvedDayNumbers = useMemo(() => {
    if (scope === "active") {
      return activeDayNumber != null && unlockedCells.some((c) => c.dayNumber === activeDayNumber) ? [activeDayNumber] : [];
    }
    if (scope === "all") {
      return unlockedCells.map((c) => c.dayNumber);
    }
    if (selectedWeekdays.size === 0) return [];
    return unlockedCells.filter((c) => selectedWeekdays.has(dayNumberToWeekday(c.dayNumber))).map((c) => c.dayNumber);
  }, [scope, activeDayNumber, unlockedCells, selectedWeekdays]);

  const toggleWeekday = (day) => {
    setSelectedWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const reset = () => {
    setScope("active");
    setSelectedWeekdays(new Set());
    setSelectedTypes(new Set());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canApply = resolvedDayNumbers.length > 0 && selectedTypes.size > 0;

  const handleApply = () => {
    if (!canApply) return;
    // createWidget burada YALNIZCA tür geçerliliğini doğrulamak için
    // çağrılıyor — gerçek widget nesneleri (her gün/görev için AYRI id ile)
    // usePlanStudio.batchApplyWidgets İÇİNDE üretilir, aksi halde tüm
    // günler/görevler AYNI widget id'sini paylaşırdı.
    const validTypes = Array.from(selectedTypes).filter((t) => createWidget(t));
    onApply(resolvedDayNumbers, validTypes);
    handleClose();
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
          ✨ Günlük Widget / Şablon Ekle
        </p>
        <button onClick={handleClose} aria-label="Kapat" className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors" style={{ color: "var(--text-faint)" }}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto no-scrollbar p-3.5 flex flex-col gap-3.5">
        {/* Kapsam Seçimi */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#06B6D4" }}>
            1. Kapsam
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {SCOPES.map((s) => {
              const Icon = s.icon;
              const active = scope === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setScope(s.key)}
                  className="flex flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-center transition-colors"
                  style={{
                    background: active ? "rgba(16,185,129,0.16)" : "rgba(var(--overlay-rgb),0.04)",
                    border: active ? "1px solid rgba(16,185,129,0.5)" : "1px solid transparent",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: active ? "#10B981" : "var(--text-faint)" }} />
                  <span className="text-[9.5px] font-semibold leading-tight" style={{ color: active ? "#10B981" : "var(--text-muted)" }}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
          {scope === "custom" && (
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {WEEKDAYS.map((wd) => {
                const active = selectedWeekdays.has(wd.day);
                return (
                  <button
                    key={wd.day}
                    onClick={() => toggleWeekday(wd.day)}
                    className="rounded-lg px-1.5 py-1.5 text-[10.5px] font-semibold transition-colors"
                    style={{
                      background: active ? "rgba(6,182,212,0.18)" : "rgba(var(--overlay-rgb),0.04)",
                      color: active ? "#06B6D4" : "var(--text-muted)",
                      border: active ? "1px solid rgba(6,182,212,0.45)" : "1px solid transparent",
                    }}
                  >
                    {wd.label}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10.5px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
            {resolvedDayNumbers.length > 0
              ? `📅 ${resolvedDayNumbers.length} gün etkilenecek.`
              : "Etkilenecek gün yok — kapsam seçimini kontrol et."}
          </p>
        </div>

        {/* Widget / Özellik Seçici */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#06B6D4" }}>
            2. Widget / Özellik Seç
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

      <div className="px-3.5 py-3 border-t" style={{ borderColor: "var(--border-default)" }}>
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
          Onayla ve Günlere Uygula
        </button>
      </div>
    </PopoverPortal>
  );
}
