import { useState } from "react";
import { Search, X, CheckCircle2, Circle } from "lucide-react";
import { categoryOf } from "../constants";
import Accordion from "./Accordion";

// 🔍 Görev Seçim Penceresi — Pomodoro'nun ana ekranını kalabalıklaştırmasın
// diye görev listesi artık burada, ayrı bir açılır pencerede yaşıyor.
// Masaüstünde (md: ≥768px) ekranın ORTASINDA merkezi bir Modal, mobilde
// alttan yukarı kayan bir Bottom Sheet olarak açılır (bkz. GlobalStyles.jsx
// ".task-picker-modal"). Bir göreve tıklanınca kısa bir çıkış animasyonuyla
// kendiliğinden kapanır.
export default function TaskPickerModal({ open, onClose, plans, selectedTaskId, onSelectTask }) {
  const [closing, setClosing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("pending"); // "pending" | "completed"

  if (!open) return null;

  const requestClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  const handleSelect = (taskId) => {
    onSelectTask(taskId);
    requestClose();
  };

  const term = search.trim().toLocaleLowerCase("tr");
  const groups = plans
    .map((p) => {
      const tasks = (p.tasks || []).filter((t) => {
        const matchesStatus = statusTab === "completed" ? t.is_completed : !t.is_completed;
        const matchesSearch = !term || (t.title || "").toLocaleLowerCase("tr").includes(term);
        return matchesStatus && matchesSearch;
      });
      return { ...p, filteredTasks: tasks };
    })
    .filter((p) => p.filteredTasks.length > 0);
  const totalMatches = groups.reduce((n, p) => n + p.filteredTasks.length, 0);

  return (
    <div className="fixed inset-0 z-[96] flex items-end md:items-center justify-center">
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${closing ? "" : "animate-[fadeIn_0.2s_ease]"}`}
        onClick={requestClose}
      />
      <div
        className={`relative w-full md:max-w-[480px] md:mx-4 max-h-[85vh] md:max-h-[640px] flex flex-col rounded-t-3xl md:rounded-3xl overflow-hidden ${
          closing ? "task-picker-modal-exit" : "task-picker-modal"
        }`}
        style={{
          background: "rgba(var(--glass-rgb), var(--alpha-modal))",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          border: "1px solid var(--modal-border)",
          boxShadow: "0 -8px 40px -12px rgba(0,0,0,0.4), 0 24px 60px -18px rgba(0,0,0,0.4)",
        }}
      >
        {/* Mobilde bottom-sheet tutamacı */}
        <div className="md:hidden shrink-0 flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "var(--modal-border)" }} />
        </div>

        {/* Başlık */}
        <div className="shrink-0 px-5 pt-3 md:pt-5 pb-3 flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Görev Seç</h3>
          <button
            onClick={requestClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            style={{ background: "rgba(var(--overlay-rgb),0.06)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Arama çubuğu */}
        <div className="shrink-0 px-5 pb-3">
          <div
            className="input-glow glass flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ borderColor: "var(--modal-border)" }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Görev ara..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Aramayı temizle" className="shrink-0" style={{ color: "var(--text-faint)" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Devam Eden / Tamamlanmış sekmeleri */}
        <div className="shrink-0 px-5 pb-3 flex gap-2">
          {[
            { key: "pending", label: "Devam Eden", icon: Circle },
            { key: "completed", label: "Tamamlanmış", icon: CheckCircle2 },
          ].map((t) => {
            const Icon = t.icon;
            const active = statusTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setStatusTab(t.key)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold transition-all"
                style={{
                  background: active ? "rgba(178,107,255,0.16)" : "rgba(var(--overlay-rgb),0.05)",
                  color: active ? "var(--pomo-work-accent)" : "var(--text-muted)",
                  border: `1px solid ${active ? "rgba(178,107,255,0.4)" : "var(--modal-border)"}`,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Plan bazlı akordeon liste */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pb-5 flex flex-col gap-2.5">
          {totalMatches === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
              {search ? "Aramanla eşleşen görev bulunamadı." : statusTab === "completed" ? "Tamamlanmış görev yok." : "Devam eden görev yok."}
            </p>
          ) : (
            groups.map((p) => {
              const cat = categoryOf(p.mode);
              return (
                <Accordion
                  key={p.id}
                  title={p.title || "Plan"}
                  icon={cat.emoji}
                  accent={cat.accent}
                  defaultOpen={groups.length <= 2}
                  right={
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full mr-1"
                      style={{ background: cat.accentSoft, color: cat.accent }}
                    >
                      {p.filteredTasks.length}
                    </span>
                  }
                >
                  <div className="flex flex-col gap-1.5">
                    {p.filteredTasks.map((t) => {
                      const active = t.id === selectedTaskId;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelect(t.id)}
                          className="task-row text-left text-[12.5px] font-medium rounded-lg px-3 py-2 truncate transition-colors card-glow flex items-center gap-2"
                          style={{
                            background: active ? "rgba(178,107,255,0.14)" : "rgba(var(--overlay-rgb),0.04)",
                            color: active ? "var(--pomo-work-accent)" : "var(--text-primary)",
                            border: `1px solid ${active ? "rgba(178,107,255,0.4)" : "var(--modal-border)"}`,
                            textDecoration: t.is_completed ? "line-through" : "none",
                            opacity: t.is_completed ? 0.7 : 1,
                          }}
                        >
                          {active ? "📌" : t.is_completed ? "✓" : ""}
                          <span className="truncate">{t.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </Accordion>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
