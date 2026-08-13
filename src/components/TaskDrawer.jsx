import { useState, useEffect, useCallback, memo } from "react";
import { Search, X, CheckCircle2, Circle, ChevronDown, ClipboardList, BarChart3 } from "lucide-react";
import { categoryOf } from "../constants";
import { fetchDashboardData, setTaskCompleted } from "../services/planService";
import { runWhenIdle } from "../utils/idle";
import logger from "../utils/logger";

// Genel "marka" vurgusu (neon cyan koyu temada, okunur camgöbeği açık temada)
// — bkz. index.css --pomo-accent. PomodoroStudio.jsx ile PAYLAŞILAN aynı token.
const BRAND = "var(--pomo-accent)";

// Bir plan grubu — kendi aç/kapa durumunu tutan minimal, bağımsız akordeon.
// Tema-duyarlı: koyu temada neon-cam, açık temada temiz beyaz/gri (bkz.
// index.css tokenları — bu drawer hem Ana Sayfa'da hem Pomodoro Studio'da,
// HER İKİ TEMADA da doğru görünmeli).
function PlanGroup({ plan, cat, defaultOpen, children, count }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left" aria-expanded={open}>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] shrink-0" style={{ background: `${cat.accent}22` }}>
          {cat.emoji}
        </span>
        <span className="flex-1 min-w-0 truncate text-[12.5px] font-bold uppercase tracking-[0.05em]" style={{ color: cat.accent }}>
          {plan.title || "Plan"}
        </span>
        <span
          className="shrink-0 text-[10.5px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)`, color: BRAND }}
        >
          {count}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-3 pb-3 flex flex-col gap-1.5">{children}</div>}
    </div>
  );
}

// Tek görev satırı — memo'lu: `task` referansı (bkz. toggleTask'ın cerrahi
// güncellemesi — yalnızca dokunulan görev yeni bir obje olur, diğerleri AYNEN
// korunur) + `active`/`onToggle`/`onSelect` sabit kaldığı sürece, bir
// checkbox tıklamasında listedeki DİĞER satırlar HİÇ yeniden render olmaz —
// uzun listede scroll/tik atma anındaki FPS düşüşünün kök nedeni buydu.
const TaskRow = memo(function TaskRow({ task, active, onSelectTask, onToggle, onSelect }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      style={active ? { background: `color-mix(in srgb, ${BRAND} 12%, transparent)` } : undefined}
    >
      <button
        onClick={() => onToggle(task.id, !task.is_completed)}
        className="w-5 h-5 rounded-[6px] border flex items-center justify-center text-[10px] shrink-0"
        style={{
          borderColor: task.is_completed ? "#2ED9A3" : "rgba(var(--overlay-rgb),0.25)",
          background: task.is_completed ? "rgba(46,217,163,0.16)" : "transparent",
          color: "#2ED9A3",
        }}
        aria-label="Tamamlandı olarak işaretle"
      >
        {task.is_completed ? "✓" : ""}
      </button>
      {onSelectTask ? (
        <button
          onClick={() => onSelect(task)}
          className="flex-1 min-w-0 text-left text-[12.5px] font-medium truncate whitespace-nowrap"
          style={{
            color: active ? BRAND : "var(--text-secondary)",
            textDecoration: task.is_completed ? "line-through" : "none",
            opacity: task.is_completed ? 0.55 : 1,
          }}
        >
          {active ? "📌 " : ""}
          {task.title}
        </button>
      ) : (
        <span
          className="flex-1 min-w-0 text-[12.5px] font-medium truncate whitespace-nowrap text-gray-700 dark:text-white/80"
          style={{ textDecoration: task.is_completed ? "line-through" : "none", opacity: task.is_completed ? 0.55 : 1 }}
        >
          {task.title}
        </span>
      )}
    </div>
  );
});

// 📋 TaskDrawer — Ana Sayfa'nın eski "Bugünün Görevleri" popover'ının VE
// Pomodoro Studio'nun eski gömülü sol panelinin (TaskListPanel) yerini alan
// TEK, paylaşılan, ekrandan/layout'tan bağımsız Slide-Over çekmece. Soldan
// kayan `fixed inset-y-0 left-0` bir kutu olduğu için (viewport'a göre
// konumlanır), etrafındaki hiçbir flex/grid zincirine bağımlı DEĞİL —
// önceki hatanın (kaydırmanın ata zincirindeki flex hesaplamalarına bağlı
// olması) kökten önüne geçer. Kaydırma, native `overflow-y:auto` + inline
// style ile garanti edilir (bkz. içerik alanı).
//
// Tema-duyarlı: index.css'teki genel uygulama token'larını (--text-primary,
// --text-muted, --text-faint, --overlay-rgb, --pomo-bg) ve --pomo-accent'i
// kullanır — koyu temada Pomodoro Studio'yla aynı neon-cam, açık temada
// uygulamanın kendi temiz beyaz/gri temasıyla birebir uyumlu.
//
// Tamamlama tikleme HER İKİ bağlamda da mevcut ve TAMAMEN kendi kendine
// yeterli (kendi planlarını çeker, kendi optimistik güncellemesini yapar,
// kalıcılığı kendi üstlenir — dışarıdan bir callback GEREKMEZ).
//
// İki kullanım bağlamı TEK bileşende:
//   - Ana Sayfa: yalnızca `userId` verilir — satıra dokunmak bir şey yapmaz,
//     yalnızca checkbox tamamlama durumunu değiştirir.
//   - Pomodoro Studio: `selectedTaskId` + `onSelectTask` DA verilir — satıra
//     dokunmak o görevi "Aktif Görev" yapar ve drawer kendiliğinden kapanır.
export default function TaskDrawer({ open, userId, onClose, selectedTaskId, onSelectTask, onOpenRhythm }) {
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("pending"); // "pending" | "completed"

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    fetchDashboardData(userId)
      .then((data) => !cancelled && setPlans(data))
      .catch((err) => logger.error("TASK_DRAWER", "Planlar getirilemedi", { userId, error: err?.message }));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Kendi kendine yeterli tamamlama tikleme: yerel `plans`'ı hemen (optimistik)
  // günceller, kalıcılığı boşta kalan ana thread'e ertelenmiş şekilde yapar
  // (bkz. utils/idle.js) — bu drawer'ın kendi çektiği veriyi doğrudan
  // güncellediği için dışarıdan bir callback'e ihtiyaç yok. YALNIZCA dokunulan
  // planın/görevin nesnesi yeniden oluşturulur (bkz. usePlanStudio.toggleTask
  // ile AYNI cerrahi güncelleme deseni) — diğer planların/görevlerin referansı
  // AYNEN korunur ki aşağıdaki memoized TaskRow'lar bir tık sırasında
  // dokunulmayan satırları render ETMESİN.
  //
  // NOT: Bu iki useCallback, aşağıdaki `if (!open) return null;`'DAN ÖNCE
  // tanımlı olmak ZORUNDA — React hook'ları HER render'da AYNI sırada
  // çağrılmalı. Daha önce bu ikisi early return'ün ALTINDAYDI: drawer kapalı
  // (open=false) ilk render'da hiç çağrılmıyorlardı, açılınca (open=true)
  // birden çağrılmaya başlıyorlardı — "Rendered more hooks than during the
  // previous render" hatasıyla uygulamayı ANINDA çökertiyordu (Görevler/Görev
  // Seçin butonuna her basışta). Kök neden buydu.
  const toggleTask = useCallback((taskId, nextVal) => {
    setPlans((prev) => {
      const planIdx = prev.findIndex((p) => (p.tasks || []).some((t) => t.id === taskId));
      if (planIdx === -1) return prev;
      const plan = prev[planIdx];
      const nextTasks = plan.tasks.map((t) => (t.id === taskId ? { ...t, is_completed: nextVal } : t));
      const next = prev.slice();
      next[planIdx] = { ...plan, tasks: nextTasks };
      return next;
    });
    runWhenIdle(() => {
      setTaskCompleted(taskId, nextVal).catch((err) => logger.error("TASK_DRAWER", "Görev durumu güncellenemedi", { taskId, error: err?.message }));
    });
  }, []);

  const selectTask = useCallback(
    (task) => {
      if (!onSelectTask) return;
      onSelectTask(task);
      onClose();
    },
    [onSelectTask, onClose]
  );

  if (!open) return null;

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
    <>
      {/* Arka plan karartması — açık temada daha hafif, koyu temada belirgin */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-sm z-[98]" onClick={onClose} />

      {/* Mobilde alttan yukarı kayan Bottom Sheet, md'den itibaren soldan kayan
          tam-yükseklik Drawer'a dönüşür (bkz. GlobalStyles.jsx .task-sheet —
          FocusSidePanel'in .focus-panel'iyle AYNI duyarlı desen). Pomodoro
          Studio'nun müzik popover'larından (z-96/97) DA yüksek: ikisi aynı
          anda açık olabildiği için TaskDrawer'ın her zaman en üstte kalması
          gerekir. */}
      <div
        data-tour-id="tour-tasks-panel"
        className="task-sheet md:max-w-md w-full border-t md:border-t-0 md:border-r border-black/10 dark:border-white/10 shadow-2xl transform-gpu flex flex-col z-[99]"
        style={{ background: "var(--pomo-bg)" }}
      >
        {/* 1. Başlık — sabit yükseklik */}
        <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between flex-none">
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5" style={{ color: BRAND }} />
            Görevler ve Planlar
          </h3>
          <div className="flex items-center gap-1">
            {/* 📊 Ritim & Gün Sonu — kısayol; TaskDrawer'ı kapatıp RhythmStudio'yu açar. */}
            {onOpenRhythm && (
              <button
                onClick={onOpenRhythm}
                aria-label="Ritim ve Gün Sonu Analizi"
                title="Ritim & Gün Sonu"
                className="p-2 rounded-lg text-gray-400 hover:text-[#A78BFA] dark:text-white/40 dark:hover:text-[#A78BFA] transition-colors"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:text-white/40 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Arama + sekmeler — sabit yükseklik */}
        <div className="p-4 border-b border-black/5 dark:border-white/5 flex-none space-y-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 focus-within:border-[var(--pomo-accent)]/40 transition-colors">
            <Search className="w-4 h-4 shrink-0 text-gray-400 dark:text-white/35" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Görev veya plan ara..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Aramayı temizle"
                className="shrink-0 text-gray-400 hover:text-gray-700 dark:text-white/35 dark:hover:text-white/70"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold whitespace-nowrap transition-all border ${
                    active ? "" : "bg-black/[0.03] dark:bg-white/[0.03] text-gray-500 dark:text-white/45 border-black/10 dark:border-white/10"
                  }`}
                  style={
                    active
                      ? {
                          background: `color-mix(in srgb, ${BRAND} 14%, transparent)`,
                          color: BRAND,
                          borderColor: `color-mix(in srgb, ${BRAND} 30%, transparent)`,
                        }
                      : undefined
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Kaydırılabilir içerik alanı — ZORUNLU native scroll, doğrudan
            inline style ile (Tailwind sınıfına/flex zincirine bağımlı değil). */}
        <div
          style={{ overflowY: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch" }}
          className="flex-1 p-4 pb-mobile-safe custom-neon-scroll space-y-3"
        >
          {totalMatches === 0 ? (
            <p className="text-[13px] text-gray-400 dark:text-white/35 text-center py-8">
              {search ? "Aramanla eşleşen görev bulunamadı." : statusTab === "completed" ? "Tamamlanmış görev yok." : "Devam eden görev yok."}
            </p>
          ) : (
            groups.map((p) => {
              const cat = categoryOf(p.mode);
              return (
                <PlanGroup key={p.id} plan={p} cat={cat} defaultOpen={groups.length <= 2} count={p.filteredTasks.length}>
                  {p.filteredTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      active={t.id === selectedTaskId}
                      onSelectTask={onSelectTask}
                      onToggle={toggleTask}
                      onSelect={selectTask}
                    />
                  ))}
                </PlanGroup>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
