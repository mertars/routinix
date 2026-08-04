import { Plus, Trash2 } from "lucide-react";

const FREQUENCIES = [
  { value: "daily", label: "Her gün" },
  { value: "weekly", label: "Haftada 1" },
];

// "Eklemeden Önce Düzenle" formu — SharedTemplateView.jsx (paylaşım linki
// önizlemesi) VE TemplateDetailModal.jsx (Nexus içi detay) AYNI düzenleme
// deneyimini paylaşır; bu bileşen olmadan aynı ~150 satırlık liste UI'ı iki
// yerde birebir kopyalanırdı. Değer + setter çiftleri doğrudan alınır (state
// çağıran bileşende yaşar) — bu bileşen kendi state'ini TUTMAZ, saf bir
// "controlled" form gövdesidir.
export default function TemplateTaskEditor({ title, onTitleChange, totalDays, onTotalDaysChange, routines, onRoutinesChange, tasks, onTasksChange }) {
  const updateRoutine = (idx, patch) => onRoutinesChange(routines.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRoutine = (idx) => onRoutinesChange(routines.filter((_, i) => i !== idx));
  const addRoutine = () => onRoutinesChange([...routines, { content: "", frequency: "weekly" }]);

  const updateTask = (idx, patch) => onTasksChange(tasks.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  const removeTask = (idx) => onTasksChange(tasks.filter((_, i) => i !== idx));
  const addTask = () => onTasksChange([...tasks, { day_number: 1, week_number: 1, title: "", detail: "", duration_min: null, priority: null }]);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">Plan Başlığı</span>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-cyan-500/50"
        />
      </label>
      <label className="flex flex-col gap-1.5 w-28">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">Toplam Gün</span>
        <input
          type="number"
          min={1}
          value={totalDays}
          onChange={(e) => onTotalDaysChange(e.target.value)}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-cyan-500/50"
        />
      </label>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--text-muted)]">Rutinler</span>
          <button onClick={addRoutine} className="flex items-center gap-1 text-[11px] font-bold text-cyan-300">
            <Plus className="w-3 h-3" /> Ekle
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {routines.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r.content}
                onChange={(e) => updateRoutine(i, { content: e.target.value })}
                placeholder="Rutin açıklaması"
                className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-cyan-500/50"
              />
              <select
                value={r.frequency}
                onChange={(e) => updateRoutine(i, { frequency: e.target.value })}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-2 text-[11.5px] text-[var(--text-secondary)] outline-none"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button onClick={() => removeRoutine(i)} aria-label="Kaldır" className="text-[var(--text-faint)] hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {routines.length === 0 && <p className="text-[11.5px] text-[var(--text-faint)]">Henüz rutin yok.</p>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--text-muted)]">Görevler ({tasks.length})</span>
          <button onClick={addTask} className="flex items-center gap-1 text-[11px] font-bold text-cyan-300">
            <Plus className="w-3 h-3" /> Ekle
          </button>
        </div>
        <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto no-scrollbar pr-0.5">
          {tasks.map((t, i) => (
            <div key={i} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={t.day_number}
                  onChange={(e) => updateTask(i, { day_number: Number(e.target.value) || 1 })}
                  aria-label="Gün"
                  className="w-14 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-[11.5px] text-[var(--text-primary)] outline-none"
                />
                <input
                  value={t.title}
                  onChange={(e) => updateTask(i, { title: e.target.value })}
                  placeholder="Görev başlığı"
                  className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-cyan-500/50"
                />
                <input
                  type="number"
                  min={0}
                  value={t.duration_min || ""}
                  onChange={(e) => updateTask(i, { duration_min: Number(e.target.value) || null })}
                  placeholder="dk"
                  aria-label="Süre (dk)"
                  className="w-14 rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-[11.5px] text-[var(--text-primary)] outline-none"
                />
                <button onClick={() => removeTask(i)} aria-label="Kaldır" className="text-[var(--text-faint)] hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-[11.5px] text-[var(--text-faint)]">Henüz görev yok.</p>}
        </div>
      </div>
    </div>
  );
}
