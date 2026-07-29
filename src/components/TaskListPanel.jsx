import { useState } from "react";
import { Search, X, CheckCircle2, Circle } from "lucide-react";
import { categoryOf } from "../constants";
import Accordion from "./Accordion";

// Pomodoro Studio'nun "Görevler" içeriği — artık ayrı bir açılır pencere
// (modal/bottom sheet) DEĞİL, sekme mimarisinin bir parçası olarak doğrudan
// gömülü: mobilde alt sekme çubuğundaki "Görevler" sekmesinin içeriği,
// masaüstünde ise sağ sütunda sürekli görünür. Arama + Devam Eden/Tamamlanmış
// ayrımı + plan bazlı akordeon aynen korunuyor (eski TaskPickerModal.jsx'ten
// taşındı — modal çatısı kaldırıldı, bileşenin kendisi silinmedi).
export default function TaskListPanel({ plans, selectedTaskId, onSelectTask }) {
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("pending"); // "pending" | "completed"

  const term = search.trim().toLocaleLowerCase("tr");
  const groups = (plans || [])
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
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Arama çubuğu */}
      <div
        className="input-glow shrink-0 flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "rgba(var(--overlay-rgb),0.045)" }}
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

      {/* Devam Eden / Tamamlanmış sekmeleri */}
      <div className="shrink-0 flex gap-2">
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
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold transition-colors"
              style={{
                background: active ? "rgba(178,107,255,0.16)" : "rgba(var(--overlay-rgb),0.045)",
                color: active ? "var(--pomo-work-accent)" : "var(--text-muted)",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Plan bazlı akordeon liste */}
      <div className="task-grid flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-2.5 pb-2">
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
                        onClick={() => onSelectTask(t.id)}
                        className="task-row text-left text-[12.5px] font-medium rounded-lg px-3 py-2 truncate transition-colors card-glow flex items-center gap-2"
                        style={{
                          background: active ? "rgba(178,107,255,0.14)" : "rgba(var(--overlay-rgb),0.035)",
                          color: active ? "var(--pomo-work-accent)" : "var(--text-primary)",
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
  );
}
