import { useState, useMemo, useRef, useDeferredValue, startTransition, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ChevronDown,
  Copy,
  Download,
  Upload,
  Clock,
  Tag,
  Timer,
  CalendarClock,
  Target,
  MapPin,
  Zap,
  Coffee,
  CheckSquare,
  Square,
  ListChecks,
  ClipboardPaste,
  ClipboardX,
} from "lucide-react";
import { categoryOf, MONO_FONT } from "../constants";
import usePerfMode from "../hooks/usePerfMode";
import { parseTextualPlan, parseCsvPlan } from "../utils/planImportParsers";
import { extractTextFromPdf } from "../utils/pdfTextExtract";
import { buildIcsCalendar, downloadIcsFile } from "../utils/icsExport";
import ImportFormatModal from "./ImportFormatModal";
import ExportFormatModal from "./ExportFormatModal";

const PrintablePlan = lazy(() => import("./PrintablePlan"));

const DAY_COUNT_CHOICES = [3, 5, 7, 14, 30];

const PRIORITY_STYLE = {
  Yüksek: { color: "#FF6E92", bg: "rgba(244,64,107,0.14)" },
  Orta: { color: "var(--amber-accent)", bg: "rgba(240,179,126,0.14)" },
  Düşük: { color: "#6FCF97", bg: "rgba(111,207,151,0.14)" },
};
const PRIORITIES = ["Yüksek", "Orta", "Düşük"];

const ENERGY_STYLE = {
  "Yüksek Odak": { color: "#B26BFF", bg: "rgba(178,107,255,0.14)", icon: "🧠" },
  "Düşük Odak": { color: "#7DA2FF", bg: "rgba(125,162,255,0.14)", icon: "😌" },
};
const ENERGY_LEVELS = ["Yüksek Odak", "Düşük Odak"];

// "Manuel Builder" kimliği — 4 AI-persona kategorisinden BİLEREK ayrışan,
// kendine özel hibrit neon paleti. Magenta artık yalnızca arka plandaki
// Aurora Mesh'te (ambiyans) kullanılır — UI kromu/butonlar SADECE
// violet+cyan üzerine kurulu: "baskın düz pembe/mavi neon buton" geri
// bildirimi üzerine, dolgu yerine cam efektli (glassmorphism), ince
// kenarlıklı, yumuşak parıltılı bir dokuya geçildi.
const NEON = { cyan: "#00F3FF", magenta: "#FF007F", violet: "#8B5CF6", emerald: "#10B981" };
const GRADIENT = `linear-gradient(90deg, transparent, ${NEON.violet}, ${NEON.cyan}, transparent)`;
// İkincil aktif durum (gün/gün-sayısı sekmeleri, özellik çipleri, hızlı
// ekle butonu) — cam efekti + ince violet kenarlık + yumuşak çift-renk glow.
const GLOW_ACTIVE_STYLE = {
  background: `linear-gradient(135deg, rgba(139,92,246,0.2), rgba(0,243,255,0.14))`,
  color: "#ECE7FF",
  border: `1px solid rgba(139,92,246,0.5)`,
  boxShadow: `0 0 18px -6px rgba(139,92,246,0.55), 0 0 10px -4px rgba(0,243,255,0.35)`,
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
};
// Birincil aksiyon (Planı Kaydet, Görevlere Geç) — aynı ailenin biraz daha
// dolgun/parlak hali, tıklama hissiyatı için daha güçlü gölge.
const PRIMARY_BUTTON_STYLE = {
  background: `linear-gradient(135deg, rgba(139,92,246,0.34), rgba(0,243,255,0.22))`,
  color: "#fff",
  border: `1px solid rgba(139,92,246,0.62)`,
  boxShadow: `0 10px 30px -12px rgba(139,92,246,0.6), 0 0 18px -4px rgba(0,243,255,0.4)`,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

// Dinamik Görev Özellik Seçici — hangi alanların Hızlı Ekle formunda ve
// görev kartlarında GÖRÜNECEĞİ, kullanıcının bu çip'leri açıp kapamasına
// bağlı. GERÇEKTEN VAR OLAN sütunlara (duration_min/estimated_cost/
// map_search_query) doğrudan yazılan üç tanesi ("duration"/"budget"/
// "location") DIŞINDA kalan üçü (pomodoro/time/goal) tasks tablosunda AYRI
// bir sütuna sahip DEĞİL — bkz. aşağıdaki composeDetail() ve dosya sonu notu.
const ATTRIBUTE_TOGGLES = [
  { key: "duration", label: "Süre", icon: Clock },
  { key: "budget", label: "Bütçe (₺)", icon: Tag },
  { key: "pomodoro", label: "Pomodoro Sayacı", icon: Timer },
  { key: "time", label: "Tarih & Saat", icon: CalendarClock },
  { key: "goal", label: "Hedef / Metrik", icon: Target },
  { key: "location", label: "Konum (📍)", icon: MapPin },
  { key: "energy", label: "Enerji Etiketi", icon: Zap },
];

// Rutin Kartları'ndaki sıklık seçenekleri — routineText.js'in FREQUENCY_META
// sözlüğündeki GERÇEK anahtarlar (routines.frequency'ye AYNEN yazılır),
// PlanBoard/RoutinesPopover'daki rutin rozetleri bunları zaten tanır.
const ROUTINE_FREQUENCY_CHOICES = [
  { key: "daily", label: "Her Gün" },
  { key: "weekdays", label: "Hafta İçi" },
];

const IMPORT_ACCEPT = {
  json: "application/json,.json",
  markdown: ".md,text/markdown",
  txt: ".txt,text/plain",
  csv: ".csv,text/csv",
  pdf: "application/pdf,.pdf",
};

let localIdCounter = 0;
function newLocalId() {
  localIdCounter += 1;
  return `local-${Date.now()}-${localIdCounter}`;
}

function emptyExtras() {
  return { pomodoroCount: null, timeOfDay: "", goalMetric: "", energyLevel: null, mapQuery: "" };
}

// tasks.detail zaten serbest-metin bir sütun (TaskCard.jsx detay
// çekmecesinde okunaklı şekilde gösteriliyor) — pomodoro/saat/hedef/enerji
// için AYRI bir sütun YOKTUR, bu yüzden bunlar burada GÖRÜNÜR, düzenlenebilir
// bir açıklama satırına dönüştürülür (sessizce/gizlice "veri kaybı" olmaz,
// kullanıcı ne kaydedildiğini tam olarak görür).
function composeDetail(freeText, extras) {
  const parts = [];
  if (freeText?.trim()) parts.push(freeText.trim());
  if (extras.timeOfDay) parts.push(`🕐 ${extras.timeOfDay}`);
  if (extras.goalMetric) parts.push(`🎯 Hedef: ${extras.goalMetric}`);
  if (extras.energyLevel) parts.push(`${ENERGY_STYLE[extras.energyLevel].icon} ${extras.energyLevel}`);
  return parts.join(" · ") || null;
}

// "Claude'un önerisi": gün toplamı 4 saati (240 dk) geçtiğinde bir mola
// GÖREVİ zaten eklenmiş mi kontrol eder — aynı öneriyi tekrar tekrar
// göstermemek için ("Mola" başlıklı bir görev varsa öneriyi gizle).
function needsRestSuggestion(tasks) {
  const totalMin = tasks.reduce((n, t) => n + (Number(t.duration_min) || 0), 0);
  const hasRest = tasks.some((t) => /mola|dinlenme|break/i.test(t.title || ""));
  return totalMin > 240 && !hasRest;
}

// "Kendi Planını Hazırla" / Plan Studio & Editor Engine — Gemini'ye HİÇ
// gitmeyen, tamamen elle plan oluşturma VE düzenleme akışı. Kaydedince aynı
// `plans`/`tasks`/`routines` şemasına yazılır — PlanBoard/PDF/AI Koç dahil
// TÜM mevcut plan özellikleri, bu planın AI mi elle mi oluşturulduğunu hiç
// bilmeden aynen çalışır.
//
// editingPlan: null ise "yeni plan" modu (eski davranış). Doluysa —
// { plan, tasks, routines } (bkz. planService.fetchPlanDetail'in dönüşü,
// usePlanStudio.openManualBuilder tarafından TAM/eksiksiz çekilir) — Plan
// Studio bu planın GÜNCEL haliyle önceden doldurulmuş açılır, "Kaydet"
// butonu "Değişiklikleri Kaydet"e döner ve kayıt updateManualPlanInSupabase
// (sunucu, service_role) üzerinden GİDER (bkz. usePlanStudio.saveManualPlan).
export default function ManualPlanBuilder({ open, category, editingPlan, onClose, onSave }) {
  const isEditMode = !!editingPlan;
  const cat = categoryOf(editingPlan?.plan?.mode || category);
  // GPU/pil bütçesi kısıtlı senaryolarda (dar viewport, arka plandaki sekme,
  // prefers-reduced-motion) Aurora Mesh'in maliyetini düşürür — bkz. aşağıdaki
  // kullanım. BackgroundScene.jsx'teki AYNI, kanıtlanmış sinyallerin paylaşılan
  // hali (usePerfMode.js).
  const { lowPower } = usePerfMode();

  const [title, setTitle] = useState(() => editingPlan?.plan?.title || "");
  const [totalDays, setTotalDays] = useState(() => {
    if (!editingPlan) return 7;
    const fromTasks = editingPlan.tasks.reduce((m, t) => Math.max(m, Number(t.day_number) || 1), 1);
    return Math.max(Number(editingPlan.plan.total_days) || 1, fromTasks);
  });
  const [customOpen, setCustomOpen] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [activeDay, setActiveDay] = useState(1);
  // { [dayNumber]: task[] } — düzenleme modunda editingPlan.tasks'tan (id
  // OLMADAN, yalnızca yerel state'in beklediği alanlarla) önceden doldurulur.
  // is_completed BİLEREK taşınır (görüntülenmez/düzenlenmez ama korunur) —
  // bkz. api/_lib/planReplace.js'teki "kullanıcının ilerlemesi KORUNUR" notu.
  const [daysData, setDaysData] = useState(() => {
    if (!editingPlan) return {};
    const grouped = {};
    const sorted = [...editingPlan.tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    for (const t of sorted) {
      const d = Math.max(1, Number(t.day_number) || 1);
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push({
        localId: newLocalId(),
        title: t.title || "",
        detail: t.detail ?? null,
        duration_min: t.duration_min ?? null,
        priority: t.priority ?? null,
        estimated_cost: t.estimated_cost ?? null,
        map_search_query: t.map_search_query ?? null,
        is_completed: t.is_completed ?? false,
      });
    }
    return grouped;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [mobileStep, setMobileStep] = useState(1); // yalnızca <lg ekranlarda anlamlı
  const [dragIndex, setDragIndex] = useState(null);
  const fileInputRef = useRef(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pendingImportFormat, setPendingImportFormat] = useState(null);

  // Rutin Kartları — Modüler Rutinler Bölümü. Serbest metin kutusu YERİNE
  // her rutin ayrı, silinebilir/sürüklenebilir/sıklık-seçilebilir bir kart.
  // Kaydedince GERÇEK routines tablosuna yazılır (bkz. planService.js +
  // api/_lib/planReplace.js) — sort_order kart sırasını, frequency
  // "Her Gün"/"Hafta İçi" seçimini taşır.
  const [routineItems, setRoutineItems] = useState(() => {
    if (!editingPlan) return [];
    return [...editingPlan.routines]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((r) => ({ localId: newLocalId(), content: r.content || "", frequency: r.frequency || "daily" }));
  });
  const [routineInput, setRoutineInput] = useState("");
  const [routineDragIndex, setRoutineDragIndex] = useState(null);

  // Evrensel Görev Panosu (Task Clipboard) — "her senaryoya özel fonksiyon"
  // yerine tek genel mekanizma: seç -> panoya kopyala -> istediğin güne/
  // günlere yapıştır. Eski "Günü Kopyala" (tüm günü ÜZERİNE yazan) menüsünün
  // yerini alır — panoya kopyalanan görevler hedef güne EKLENİR (üzerine
  // yazmaz), bu yüzden aynı görevleri birden çok güne biriktirerek de
  // ekleyebilirsin.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [clipboard, setClipboard] = useState([]); // task şablonları (localId hariç)
  const [pasteMenuOpen, setPasteMenuOpen] = useState(false);

  // Dinamik Görev Özellik Seçici — hangi alanlar görünür. Gezi kategorisinde
  // bütçe/konum, VARSAYILAN olarak açık (eski davranışla tutarlı UX), diğer
  // kategorilerde kullanıcı isterse kendisi açar. Düzenleme modunda mevcut
  // görevlerde GERÇEKTEN kullanılan alanlar otomatik açılır — kullanıcı
  // "bütçe girmiştim ama alan görünmüyor" şaşkınlığı yaşamasın diye.
  const [enabledAttrs, setEnabledAttrs] = useState(() => {
    if (editingPlan) {
      const s = new Set(["duration"]);
      if (editingPlan.tasks.some((t) => t.estimated_cost != null && String(t.estimated_cost).trim() !== "")) s.add("budget");
      if (editingPlan.tasks.some((t) => t.map_search_query)) s.add("location");
      return s;
    }
    return new Set(category === "vacation" ? ["duration", "budget", "location"] : ["duration"]);
  });
  const hasAttr = (key) => enabledAttrs.has(key);
  const toggleAttr = (key) => {
    setEnabledAttrs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Hızlı Görev Ekle satırının kendi yerel state'i.
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDuration, setQuickDuration] = useState("");
  const [quickPriority, setQuickPriority] = useState(null);
  const [quickCost, setQuickCost] = useState("");
  const [quickExtras, setQuickExtras] = useState(emptyExtras());

  const dayNumbers = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays]);
  const activeTasks = daysData[activeDay] || [];
  // Büyük planlarda (çok gün × çok görev) Hızlı Ekle'ye her tuş vuruşu TÜM
  // bileşeni yeniden render eder — bu da activeTasks listesinin (aşağıdaki
  // draggable kart map'i) yeniden çizilmesini TETİKLER, ilgisiz bir alana
  // yazarken bile. useDeferredValue, bu render'ı "acil olmayan" olarak
  // işaretler: React önce yazma girdisini (acil) günceller, liste render'ı
  // bir kare geriden gelir — input ASLA tıkanmaz. Küçük planlarda fark
  // edilmez (React aynı tick'te bitirir), yalnızca gerçekten pahalı
  // render'larda devreye girer.
  const deferredActiveTasks = useDeferredValue(activeTasks);
  const isTaskListStale = deferredActiveTasks !== activeTasks;
  const totalTaskCount = useMemo(() => Object.values(daysData).reduce((n, arr) => n + (arr?.length || 0), 0), [daysData]);
  const showRestSuggestion = hasAttr("duration") && needsRestSuggestion(activeTasks);

  // Studio Builder'ın YEREL (henüz kaydedilmemiş olabilir) durumunu
  // PrintablePlan'ın beklediği {plan, routines, weeks} şekline çevirir —
  // "Şık PDF Çıktısı" bu sayede plan HENÜZ kaydedilmeden de üretilebilir.
  // Hook olduğu için (useMemo) `if (!open) return null` SATIRINDAN ÖNCE
  // tanımlı olmak ZORUNDA (bkz. PlanBoard.jsx'teki AYNI kısıt notu).
  const printShape = useMemo(
    () => ({
      plan: { title: title.trim() || "Kendi Planım", total_days: totalDays, summary: null },
      routines: routineItems.map((r) => ({ id: r.localId, content: r.content, frequency: r.frequency })),
      weeks: [
        {
          weekNumber: 1,
          days: Object.entries(daysData)
            .map(([day, tasks]) => ({
              dayNumber: Number(day),
              tasks: tasks.filter((t) => t.title.trim()).map((t) => ({ ...t, id: t.localId })),
            }))
            .sort((a, b) => a.dayNumber - b.dayNumber),
        },
      ],
    }),
    [title, totalDays, routineItems, daysData]
  );

  // Mobil BottomSheet'i esnek (rubber-band) sürükle-bırak ile kapatma — tutamaç
  // (aşağıdaki pill) daha önce SADECE görseldi, hiçbir dokunma etkileşimine
  // bağlı DEĞİLDİ. Yukarı sürüklemede direnç uygulanır (sheet zaten en üstte,
  // daha fazla yukarı gitmek doğal değil), aşağı sürüklemede 1:1 parmağı
  // takip eder; bırakınca eşiği (120px) geçtiyse mevcut konumdan ekran
  // dışına akıcıca devam edip kapanır, geçmediyse yay-fizikli bir geri
  // dönüşle (aynı spring bezier, bkz. GlobalStyles.jsx .spring-lift) yerine
  // oturur. `closing` durumu ayrıca X/backdrop ile kapatmayı da KULLANILMAYAN
  // (dormant) slideDownSheet keyframe'ine bağlar — üç kapatma yolu da artık
  // aynı tutarlı çıkış hissini paylaşır.
  const DISMISS_THRESHOLD_PX = 120;
  const [sheetDragY, setSheetDragY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [closing, setClosing] = useState(false);
  const sheetDragStartRef = useRef(null);

  if (!open) return null;

  const setDayTasks = (dayNumber, updater) => {
    setDaysData((prev) => ({ ...prev, [dayNumber]: updater(prev[dayNumber] || []) }));
  };

  const updateTask = (localId, patch) => {
    setDayTasks(activeDay, (list) => list.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));
  };

  const removeTask = (localId) => {
    setDayTasks(activeDay, (list) => list.filter((t) => t.localId !== localId));
  };

  const addRestBreak = () => {
    setDayTasks(activeDay, (list) => [...list, { localId: newLocalId(), title: "☕ Mola", duration_min: 15, priority: null, estimated_cost: null, detail: null, is_completed: false }]);
  };

  const submitQuickAdd = () => {
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    const pomodoroDuration = hasAttr("pomodoro") && quickExtras.pomodoroCount ? Number(quickExtras.pomodoroCount) * 25 : null;
    setDayTasks(activeDay, (list) => [
      ...list,
      {
        localId: newLocalId(),
        title: trimmed,
        duration_min: pomodoroDuration ?? (hasAttr("duration") && quickDuration ? Number(quickDuration) : null),
        priority: quickPriority,
        estimated_cost: hasAttr("budget") && quickCost.trim() ? quickCost.trim() : null,
        map_search_query: hasAttr("location") && quickExtras.mapQuery.trim() ? quickExtras.mapQuery.trim() : null,
        detail: composeDetail(null, quickExtras),
        is_completed: false,
      },
    ]);
    setQuickTitle("");
    setQuickDuration("");
    setQuickPriority(null);
    setQuickCost("");
    setQuickExtras(emptyExtras());
  };

  const handleDayCountPick = (n) => {
    setTotalDays(n);
    setCustomOpen(false);
    if (activeDay > n) setActiveDay(1);
  };

  const applyCustomDays = () => {
    const n = Math.max(1, Math.min(365, parseInt(customVal, 10) || 0));
    if (!n) return;
    handleDayCountPick(n);
  };

  // --- Sürükle-Bırak sıralama (native HTML5 DnD, ek bağımlılık YOK) ---
  const handleDrop = (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    // Bırakma anındaki görsel geri bildirim (sürüklenen kartın eski
    // konumdan ayrılması) ANINDA olsun diye dragIndex sıfırlama transition
    // DIŞINDA kalır; asıl liste yeniden sıralaması (potansiyel olarak uzun
    // bir günün TÜMÜNÜN yeniden render edilmesi) startTransition ile
    // "acil olmayan" işaretlenir — parmak/imleç kalktığı an tıklama tepkisi
    // beklemez.
    startTransition(() => {
      setDayTasks(activeDay, (list) => {
        const next = list.slice();
        const [moved] = next.splice(dragIndex, 1);
        next.splice(dropIndex, 0, moved);
        return next;
      });
    });
    setDragIndex(null);
  };

  // --- Evrensel Görev Panosu: Seç -> Kopyala -> Yapıştır ---
  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  };
  const toggleSelectTask = (localId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(localId) ? next.delete(localId) : next.add(localId);
      return next;
    });
  };
  const copySelectedToClipboard = () => {
    const selected = activeTasks.filter((t) => selectedIds.has(t.localId));
    if (selected.length === 0) return;
    // localId BİLEREK atılır — panodan yapıştırılan her kopya, yapıştırıldığı
    // anda taze bir localId alır (bkz. pasteClipboardTo), aksi halde aynı
    // görevi birden çok güne yapıştırınca React key çakışması olurdu.
    setClipboard(selected.map(({ localId, ...rest }) => rest));
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const deleteSelected = () => {
    setDayTasks(activeDay, (list) => list.filter((t) => !selectedIds.has(t.localId)));
    setSelectedIds(new Set());
    setSelectMode(false);
  };
  const pasteClipboardTo = (targetDays) => {
    if (clipboard.length === 0) return;
    // "Tüm Günlere Çoğalt" 100+ güne kadar TÜM daysData'yı tek seferde
    // yeniden yazabilir — startTransition bu potansiyel olarak büyük
    // güncellemeyi düşük öncelikli işaretler, menü kapanışı/tıklama tepkisi
    // ANINDA kalır (aşağıdaki setPasteMenuOpen transition dışında).
    startTransition(() => {
      setDaysData((prev) => {
        const next = { ...prev };
        for (const d of targetDays) {
          // is_completed HER ZAMAN false'a döner: yapıştırılan bir kopya, o
          // günün YENİ bir örneğidir — kaynak görev tamamlanmış olsa bile
          // kopyası "henüz yapılmadı" olarak başlar.
          const cloned = clipboard.map((t) => ({ ...t, localId: newLocalId(), is_completed: false }));
          next[d] = [...(next[d] || []), ...cloned]; // ÜZERİNE YAZMAZ, mevcut görevlere EKLER
        }
        return next;
      });
    });
    setPasteMenuOpen(false);
  };
  const pasteToActiveDay = () => pasteClipboardTo([activeDay]);
  const pasteToAllDays = () => pasteClipboardTo(dayNumbers);
  const pasteToWeekdays = () => pasteClipboardTo(dayNumbers.filter((d) => (d - 1) % 7 < 5)); // her 7 günlük blokta 1-5. günler
  const clearClipboard = () => {
    setClipboard([]);
    setPasteMenuOpen(false);
  };

  // --- Rutin Kartları: ekle / güncelle / sil / sürükle-sırala ---
  const addRoutine = () => {
    const trimmed = routineInput.trim();
    if (!trimmed) return;
    setRoutineItems((prev) => [...prev, { localId: newLocalId(), content: trimmed, frequency: "daily" }]);
    setRoutineInput("");
  };
  const updateRoutine = (localId, patch) => {
    setRoutineItems((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  };
  const removeRoutine = (localId) => {
    setRoutineItems((prev) => prev.filter((r) => r.localId !== localId));
  };
  const handleRoutineDrop = (dropIndex) => {
    if (routineDragIndex === null || routineDragIndex === dropIndex) return;
    setRoutineItems((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(routineDragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setRoutineDragIndex(null);
  };

  // --- Şablon Dışa Aktar: JSON / .ics Takvim / Şık PDF ---
  const exportJson = () => {
    const payload = {
      routinixManualPlan: true,
      version: 2, // v2: routines artık {content,frequency}[] (v1: düz metin) — handleImportFile ikisini de okur.
      title,
      totalDays,
      category,
      days: daysData,
      routines: routineItems.map((r) => ({ content: r.content, frequency: r.frequency })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "kendi-planim").toString().trim().replace(/\s+/g, "-").toLowerCase() || "kendi-planim"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportFormatPicked = (format) => {
    setExportModalOpen(false);
    if (format === "json") {
      exportJson();
    } else if (format === "ics") {
      const ics = buildIcsCalendar({ title, days: daysData });
      downloadIcsFile(title, ics);
    } else if (format === "pdf") {
      // PrintablePlan HER ZAMAN (aşağıda, portal ile) güncel builder
      // verisiyle mount edilmiş durumda — app.jsx'teki "PDF/Yazdır" İLE
      // AYNI desen: DOM'un güncel veriyle çizilmesi için kısa bir gecikme,
      // sonra tarayıcının kendi yazdır/PDF-kaydet diyaloğu.
      setTimeout(() => window.print(), 60);
    }
  };

  // --- Şablon İçe Aktar: JSON / Markdown / TXT / CSV / PDF ---
  // applyImportedData, TÜM formatların ORTAK sonuç şekli için tek giriş
  // noktası — hangi formattan geldiğinden bağımsız olarak builder state'ini
  // (title/totalDays/daysData/routineItems) günceller. Mevcut planın
  // TAMAMININ yerini alır (eskisiyle AYNI davranış, yalnızca JSON'a özel
  // değil artık).
  const applyImportedData = ({ title: newTitle, totalDays: newTotalDays, days, routines: newRoutines }) => {
    if (newTitle) setTitle(newTitle);
    const dayNumbers = Object.keys(days || {}).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    const maxDay = dayNumbers.length ? Math.max(...dayNumbers) : totalDays;
    setTotalDays(Math.max(1, Math.min(365, Number(newTotalDays) || maxDay)));
    const fresh = {};
    for (const [day, tasks] of Object.entries(days || {})) {
      fresh[day] = (Array.isArray(tasks) ? tasks : []).map((t) => ({
        localId: newLocalId(),
        title: t.title || "",
        detail: t.detail ?? null,
        duration_min: t.duration_min ?? null,
        priority: t.priority ?? null,
        estimated_cost: t.estimated_cost ?? null,
        map_search_query: t.map_search_query ?? null,
        is_completed: false,
      }));
    }
    setDaysData(fresh);
    if (Array.isArray(newRoutines)) {
      setRoutineItems(newRoutines.map((r) => ({ localId: newLocalId(), content: r.content, frequency: r.frequency || "daily" })));
    }
    setActiveDay(1);
    setMobileStep(2);
  };

  const handleFormatPicked = (format) => {
    setImportModalOpen(false);
    setPendingImportFormat(format);
    // input'un `accept`'i state'e bağlı — React DOM'a yansıtana kadar bir
    // sonraki animasyon karesini bekleyip TIKLA, aksi halde eski `accept`
    // ile açılabilir.
    requestAnimationFrame(() => fileInputRef.current?.click());
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // aynı dosyayı arka arkaya seçebilmek için input'u sıfırla
    const format = pendingImportFormat;
    if (!file || !format) return;
    setError("");
    setImporting(true);
    try {
      if (format === "json") {
        const parsed = JSON.parse(await file.text());
        if (!parsed || typeof parsed !== "object" || !parsed.days) throw new Error("Geçersiz dosya");
        // v1 (routines: düz metin, satır satır) ve v2 (routines: {content,
        // frequency}[]) dışa aktarımlarının İKİSİ de okunabilir.
        const normalizedRoutines = Array.isArray(parsed.routines)
          ? parsed.routines.map((r) => ({ content: String((typeof r === "object" ? r.content : r) ?? "").trim(), frequency: (typeof r === "object" && r.frequency) || "daily" })).filter((r) => r.content)
          : typeof parsed.routines === "string"
          ? parsed.routines.split("\n").map((l) => l.trim()).filter(Boolean).map((content) => ({ content, frequency: "daily" }))
          : [];
        applyImportedData({ title: parsed.title, totalDays: parsed.totalDays, days: parsed.days, routines: normalizedRoutines });
      } else if (format === "markdown" || format === "txt") {
        const text = await file.text();
        const { title: parsedTitle, days, routines } = parseTextualPlan(text);
        applyImportedData({ title: parsedTitle, days, routines });
      } else if (format === "csv") {
        const text = await file.text();
        const { days } = parseCsvPlan(text);
        if (Object.keys(days).length === 0) throw new Error("CSV ayrıştırılamadı");
        applyImportedData({ days, routines: [] });
      } else if (format === "pdf") {
        const text = await extractTextFromPdf(file);
        const { title: parsedTitle, days, routines } = parseTextualPlan(text);
        applyImportedData({ title: parsedTitle, days, routines });
      }
    } catch {
      setError("Dosya okunamadı/ayrıştırılamadı — dosyanın seçtiğin formata ve beklenen düzene uygun olduğundan emin ol.");
    } finally {
      setImporting(false);
      setPendingImportFormat(null);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setError("");
    // Görev adı zorunlu değil olarak bırakılan satırları temizle — boş bir
    // "Görev Başlığı" alanıyla kayıt denemesi kullanıcıyı şaşırtmasın diye
    // sessizce ATLANIR (hata gösterip akışı KESMEK yerine).
    const cleanedDays = Object.fromEntries(
      Object.entries(daysData)
        .map(([day, tasks]) => [day, tasks.filter((t) => t.title.trim())])
        .filter(([, tasks]) => tasks.length > 0)
    );
    const routines = routineItems
      .map((r) => ({ content: r.content.trim(), frequency: r.frequency || "daily" }))
      .filter((r) => r.content);
    setSaving(true);
    try {
      await onSave({
        title: title.trim() || "Kendi Planım",
        totalDays,
        days: cleanedDays,
        category,
        routines,
        editingPlanId: editingPlan?.plan?.id || null,
      });
    } catch (err) {
      setError(err?.message || "Plan kaydedilirken bir sorun oluştu. Tekrar dener misin?");
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 260);
  };

  const handleSheetTouchStart = (e) => {
    if (closing) return;
    sheetDragStartRef.current = e.touches[0].clientY;
    setIsDraggingSheet(true);
  };
  const handleSheetTouchMove = (e) => {
    if (sheetDragStartRef.current == null) return;
    const delta = e.touches[0].clientY - sheetDragStartRef.current;
    setSheetDragY(delta < 0 ? delta * 0.25 : delta);
  };
  const handleSheetTouchEnd = () => {
    setIsDraggingSheet(false);
    sheetDragStartRef.current = null;
    if (sheetDragY > DISMISS_THRESHOLD_PX) {
      setClosing(true);
      setSheetDragY(typeof window !== "undefined" ? window.innerHeight : 800);
      setTimeout(onClose, 300);
    } else {
      setSheetDragY(0);
    }
  };

  const sheetAnimateClass = closing
    ? sheetDragY === 0
      ? "animate-[slideDownSheet_0.26s_ease_forwards]"
      : ""
    : "animate-[slideUpSheet_0.3s_ease] lg:animate-[fullScreenIn_0.25s_ease]";

  return (
    <>
      <div className="fixed inset-0 z-[109] bg-black/60 backdrop-blur-sm lg:hidden" onClick={requestClose} />

      <div
        className={`fixed inset-x-0 bottom-0 z-[110] max-h-[90vh] rounded-t-3xl flex flex-col overflow-hidden lg:inset-0 lg:max-h-none lg:rounded-none ${sheetAnimateClass}`}
        style={{
          background: "var(--bg-app)",
          ...(sheetDragY !== 0
            ? { transform: `translateY(${sheetDragY}px)`, transition: isDraggingSheet ? "none" : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }
            : {}),
        }}
      >
        {/* Aurora Mesh — dört rengin radial-gradient'leri TEK katmanda üst
            üste bindirilir (tarayıcı otomatik harmanlar), önceki turun 4
            ayrı/net-sınırlı dairesi yerine akıcı, derinlik katan tek bir
            ortam ışığı verir. Tema-duyarlı yoğunluk index.css'teki
            --blob-opacity'den gelir (dark 0.32 / light 0.18) — hem Dark hem
            Light Mode'da gözü yormayan, premium bir zemin.
            GPU MALİYETİ: bu katmandaki asıl maliyet transform animasyonu
            DEĞİL (o zaten compositor thread'inde, ucuz) — filter:blur()'un
            KENDİSİ (büyük yarıçaplı blur, rasterizasyon gerektirir, mobil
            GPU'larda ısınmanın asıl kaynağı budur). lowPower'da hem animasyon
            duraklatılır hem blur yarıçapı düşürülür — "SVG shader"a geçmek
            DEĞİL, gerçek maliyeti (blur radius × alan) küçültmek asıl çözüm. */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className={lowPower ? "absolute -inset-[15%]" : "absolute -inset-[15%] motion-safe:animate-[auroraDrift_38s_ease-in-out_infinite]"}
            style={{
              opacity: "var(--blob-opacity)",
              filter: lowPower ? "blur(60px)" : "blur(110px)",
              willChange: "transform",
              background: `radial-gradient(38% 32% at 15% 18%, ${NEON.magenta}, transparent 70%),
                radial-gradient(36% 34% at 88% 12%, ${NEON.cyan}, transparent 70%),
                radial-gradient(40% 38% at 22% 92%, ${NEON.violet}, transparent 70%),
                radial-gradient(34% 32% at 90% 88%, ${NEON.emerald}, transparent 70%)`,
            }}
          />
        </div>

        <div
          className="relative z-10 shrink-0 pt-2.5 pb-3 flex justify-center lg:hidden touch-none"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full" style={{ background: "var(--border-strong)" }} />
        </div>
        <div className="relative z-10 h-[3px] shrink-0 hidden lg:block" style={{ background: GRADIENT, boxShadow: `0 0 12px -2px ${NEON.violet}88` }} />

        {/* Başlık */}
        <div className="relative z-10 shrink-0 px-4 md:px-8 lg:px-10 pt-2 lg:pt-5 pb-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-lg" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(0,243,255,0.16))" }}>
              {cat.emoji}
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] md:text-[19px] font-bold text-[var(--text-primary)] leading-tight truncate">{isEditMode ? "Planı Düzenle" : "Kendi Planını Hazırla"}</h1>
              <p className="text-[11px] md:text-[12.5px] text-[var(--text-faint)]">
                {cat.label} · <span className="lg:hidden">{mobileStep === 1 ? "1/2 · Süre" : "2/2 · Görevler"}</span>
                <span className="hidden lg:inline">elle oluşturulan plan, yapay zeka kullanılmaz</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Akıllı İçe/Dışa Aktar — küçük, ikon-yalnız, başlığın yanında;
                format seçimi ImportFormatModal/ExportFormatModal'da yapılır. */}
            <input ref={fileInputRef} type="file" accept={IMPORT_ACCEPT[pendingImportFormat] || "*"} className="hidden" onChange={handleImportFile} />
            <button onClick={() => setImportModalOpen(true)} aria-label="Plan dosyası içe aktar" title="İçe Aktar" className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" style={{ background: "rgba(var(--overlay-rgb), 0.06)" }}>
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={() => setExportModalOpen(true)} aria-label="Planı dışa aktar" title="Dışa Aktar" className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" style={{ background: "rgba(var(--overlay-rgb), 0.06)" }}>
              <Download className="w-4 h-4" />
            </button>
            <button onClick={requestClose} aria-label="Kapat" className="w-11 h-11 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" style={{ background: "rgba(var(--overlay-rgb), 0.06)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gövde */}
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 md:px-8 lg:px-10 py-5 lg:py-8">
          <div className="max-w-[1600px] mx-auto flex flex-col lg:grid lg:grid-cols-[380px_1fr] lg:gap-8 lg:items-start">
            {/* SOL SÜTUN (lg+) / ADIM 1 — Plan Ayarları + Özellik Seçici */}
            <section className={`${mobileStep === 1 ? "block" : "hidden"} lg:block lg:sticky lg:top-0`}>
              <div className="glass rounded-3xl p-5 lg:p-6 flex flex-col gap-5">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-2" style={{ fontFamily: MONO_FONT }}>
                    Plan Başlığı
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Kendi Disiplin Rutinim"
                    className="input-glow w-full rounded-2xl px-4 py-3.5 lg:py-3 text-[14.5px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)] outline-none border"
                    style={{ background: "var(--bg-input)", borderColor: "var(--border-default)" }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-2" style={{ fontFamily: MONO_FONT }}>
                    Gün Sayısı
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {DAY_COUNT_CHOICES.map((n) => {
                      const active = !customOpen && totalDays === n;
                      return (
                        <button
                          key={n}
                          onClick={() => handleDayCountPick(n)}
                          className="min-h-[48px] lg:min-h-0 rounded-full px-4 lg:py-2 text-[13px] font-semibold transition-all duration-200 border"
                          style={active ? GLOW_ACTIVE_STYLE : { borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-secondary)" }}
                        >
                          {n} Gün
                        </button>
                      );
                    })}
                    {!customOpen ? (
                      <button
                        onClick={() => {
                          setCustomOpen(true);
                          setCustomVal(String(totalDays));
                        }}
                        className="min-h-[48px] lg:min-h-0 rounded-full px-4 lg:py-2 text-[13px] font-semibold border transition-all duration-200"
                        style={!DAY_COUNT_CHOICES.includes(totalDays) ? GLOW_ACTIVE_STYLE : { borderColor: "var(--border-default)", background: "var(--bg-input)", color: "var(--text-secondary)" }}
                      >
                        {!DAY_COUNT_CHOICES.includes(totalDays) ? `${totalDays} Gün (Özel)` : "Özel"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          autoFocus
                          value={customVal}
                          onChange={(e) => setCustomVal(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && applyCustomDays()}
                          className="min-h-[48px] lg:min-h-0 w-20 rounded-full border px-3 lg:py-2 text-[13px] text-center outline-none bg-transparent text-[var(--text-primary)]"
                          style={{ borderColor: "var(--border-default)", background: "var(--bg-input)" }}
                        />
                        <button onClick={applyCustomDays} className="min-h-[48px] lg:min-h-0 rounded-full px-3.5 lg:py-2 text-[12.5px] font-semibold" style={GLOW_ACTIVE_STYLE}>
                          Uygula
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dinamik Görev Özellik Seçici — burada AÇILAN her alan, sağdaki
                    Hızlı Ekle formunda ve görev kartlarında BELİRİR; kapatılan
                    alan ekrandan tamamen kalkar. Bu, "tam ekranı dengeli
                    doldur, sıkışık olmasın" isteğinin doğrudan çözümü: 6-7
                    olası alanın HEPSİNİ her zaman göstermek yerine kullanıcı
                    yalnızca bu plan için gerçekten gereken alanları seçer. */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-2" style={{ fontFamily: MONO_FONT }}>
                    Görev Özellikleri
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ATTRIBUTE_TOGGLES.map(({ key, label, icon: Icon }) => {
                      const active = hasAttr(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleAttr(key)}
                          className="flex items-center gap-1.5 rounded-full pl-2.5 pr-3 min-h-[40px] lg:min-h-0 lg:py-1.5 text-[11.5px] font-semibold transition-all duration-200 border"
                          style={active ? GLOW_ACTIVE_STYLE : { background: "var(--bg-input)", color: "var(--text-secondary)", borderColor: "var(--border-default)" }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10.5px] text-[var(--text-muted)] leading-relaxed">
                    Açtığın özellikler Hızlı Ekle formunda ve görev kartlarında görünür.
                  </p>
                </div>

                {/* Rutin Kartları — günlük dinamik görevlerden AYRI, tek
                    seferde eklenen tekrarlı alışkanlıklar. Serbest metin
                    kutusu YERİNE her rutin kendi silinebilir/sürüklenebilir/
                    sıklık-seçilebilir kartı. Kaydedince routines tablosuna
                    gerçek satırlar olarak yazılır (bkz.
                    planService.saveManualPlanToSupabase) — AI akışının
                    "Genel Rutinler" panosuyla birebir aynı yapı, PlanBoard
                    bu planın elle mi AI'lı mı kurulduğunu bilmeden aynen
                    gösterir. */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] mb-2" style={{ fontFamily: MONO_FONT }}>
                    Genel Rutinler
                  </label>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <input
                      type="text"
                      value={routineInput}
                      onChange={(e) => setRoutineInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addRoutine()}
                      placeholder="Rutin adı yaz... (ör. Her sabah su iç)"
                      className="flex-1 min-w-0 min-h-[44px] rounded-xl px-3.5 outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                      style={{ background: "var(--bg-input)" }}
                    />
                    <button
                      onClick={addRoutine}
                      disabled={!routineInput.trim()}
                      aria-label="Rutin ekle"
                      className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl font-bold transition-all disabled:opacity-40"
                      style={GLOW_ACTIVE_STYLE}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {routineItems.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      Günlere bağlı değildir — plan boyunca her gün geçerli genel alışkanlıklar (ör. su içmek, esnemek).
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {routineItems.map((r, index) => (
                        <div
                          key={r.localId}
                          draggable
                          onDragStart={() => setRoutineDragIndex(index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleRoutineDrop(index)}
                          onDragEnd={() => setRoutineDragIndex(null)}
                          className="rounded-xl px-2.5 py-2 flex items-center gap-2 transition-opacity"
                          style={{ background: "var(--bg-input)", opacity: routineDragIndex === index ? 0.4 : 1 }}
                        >
                          <span className="shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-faint)]" aria-hidden="true" title="Sürükleyerek sırala">
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="text"
                            value={r.content}
                            onChange={(e) => updateRoutine(r.localId, { content: e.target.value })}
                            className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-[var(--text-primary)]"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            {ROUTINE_FREQUENCY_CHOICES.map((f) => {
                              const active = r.frequency === f.key;
                              return (
                                <button
                                  key={f.key}
                                  onClick={() => updateRoutine(r.localId, { frequency: f.key })}
                                  className="text-[10px] font-semibold px-2 py-1 rounded-full transition-colors whitespace-nowrap"
                                  style={active ? { background: `${NEON.violet}22`, color: NEON.violet } : { background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-faint)" }}
                                >
                                  {f.label}
                                </button>
                              );
                            })}
                          </div>
                          <button onClick={() => removeRoutine(r.localId)} aria-label="Rutini sil" className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-faint)] hover:text-[#FF6E92] transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setMobileStep(2)}
                className="lg:hidden mt-5 w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl text-[14px] font-bold"
                style={PRIMARY_BUTTON_STYLE}
              >
                Görevlere Geç <ChevronRight className="w-4 h-4" />
              </button>
            </section>

            {/* SAĞ SÜTUN (lg+) / ADIM 2 — Gün Sekmeleri + Kopyala + Sürükle-Bırak Editör */}
            <section className={`${mobileStep === 2 ? "block" : "hidden"} lg:block min-w-0`}>
              <button onClick={() => setMobileStep(1)} className="lg:hidden mb-4 flex items-center gap-1 text-[12.5px] font-semibold min-h-[44px]" style={{ color: "var(--text-muted)" }}>
                <ChevronLeft className="w-4 h-4" /> Ayarlara Dön
              </button>

              <div className="flex items-center justify-between mb-2 gap-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)] shrink-0" style={{ fontFamily: MONO_FONT }}>
                  Gün Gün Düzenle
                </label>
                <span className="text-[11px] text-[var(--text-faint)] shrink-0" style={{ fontFamily: MONO_FONT }}>
                  {totalTaskCount} görev
                </span>
              </div>

              {/* Gün sekmeleri + Seç modu + Pano (Clipboard) menüsü — aynı satır */}
              <div className="flex items-center gap-2 mb-3">
                <div className="edge-fade-x -mx-4 md:mx-0 px-4 md:px-0 flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {dayNumbers.map((d) => {
                    const active = d === activeDay;
                    const count = daysData[d]?.length || 0;
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          setActiveDay(d);
                          setSelectedIds(new Set());
                          setPasteMenuOpen(false);
                        }}
                        className={`spring-lift shrink-0 min-h-[48px] lg:min-h-0 flex items-center gap-1.5 rounded-xl px-3.5 lg:py-2 text-[12.5px] font-semibold ${totalDays > 30 ? "day-tab-cv" : ""}`}
                        style={active ? { ...GLOW_ACTIVE_STYLE, "--spring-glow": `${NEON.violet}66` } : { background: "rgba(var(--overlay-rgb),0.05)", color: "var(--text-secondary)", "--spring-glow": "rgba(0,243,255,0.2)" }}
                      >
                        {d}. Gün
                        {count > 0 && (
                          <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9.5px] font-bold" style={{ background: active ? "rgba(255,255,255,0.25)" : cat.accentSoft, color: active ? "#fff" : cat.accent }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Seç modu — Görev Seç / Toplu İşlemler'in giriş kapısı */}
                <button
                  onClick={toggleSelectMode}
                  disabled={activeTasks.length === 0 && !selectMode}
                  className="shrink-0 min-h-[48px] lg:min-h-0 lg:h-9 flex items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold transition-colors disabled:opacity-35"
                  style={selectMode ? GLOW_ACTIVE_STYLE : { background: "rgba(var(--overlay-rgb),0.06)", color: "var(--text-secondary)" }}
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{selectMode ? "İptal" : "Görev Seç"}</span>
                </button>

                {/* Pano — panoda görev varsa görünür, aktif güne/tüm günlere/hafta içine yapıştırma sunar */}
                {clipboard.length > 0 && (
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setPasteMenuOpen((v) => !v)}
                      className="min-h-[48px] lg:min-h-0 lg:h-9 flex items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold transition-colors"
                      style={{ background: `${NEON.violet}1c`, border: `1px solid ${NEON.violet}55`, color: "#C9B8FF" }}
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Pano ({clipboard.length})</span>
                      <span className="sm:hidden">{clipboard.length}</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {pasteMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPasteMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-2xl p-1.5 glass" style={{ boxShadow: "0 20px 50px -16px rgba(0,0,0,0.4)" }}>
                          <button onClick={pasteToActiveDay} className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-[var(--text-secondary)] hover:bg-[rgba(var(--overlay-rgb),0.06)] transition-colors">
                            📋 Kopyalananları Buraya Yapıştır ({activeDay}. gün)
                          </button>
                          <button onClick={pasteToWeekdays} className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-[var(--text-secondary)] hover:bg-[rgba(var(--overlay-rgb),0.06)] transition-colors">
                            Hafta İçi Günlerine Yapıştır
                          </button>
                          <button onClick={pasteToAllDays} className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-[var(--text-secondary)] hover:bg-[rgba(var(--overlay-rgb),0.06)] transition-colors">
                            Tüm Günlere Çoğalt ({totalDays} gün)
                          </button>
                          <div className="my-1 h-px" style={{ background: "var(--border-default)" }} />
                          <button onClick={clearClipboard} className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] font-medium flex items-center gap-2 transition-colors hover:bg-[rgba(var(--overlay-rgb),0.06)]" style={{ color: "#FF6E92" }}>
                            <ClipboardX className="w-3.5 h-3.5" /> Panoyu Temizle
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Seçim aksiyon çubuğu — yalnızca Seç modunda VE en az 1 görev işaretliyken */}
              {selectMode && (
                <div className="flex items-center gap-2 mb-3 rounded-2xl px-3.5 py-2.5" style={{ background: `${NEON.violet}12`, border: `1px solid ${NEON.violet}40` }}>
                  <span className="text-[12px] font-semibold flex-1" style={{ color: "#C9B8FF" }}>
                    {selectedIds.size > 0 ? `${selectedIds.size} görev seçildi` : "Panoya kopyalamak veya silmek istediğin görevleri işaretle"}
                  </span>
                  <button onClick={copySelectedToClipboard} disabled={selectedIds.size === 0} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-35" style={{ background: "rgba(var(--overlay-rgb),0.08)", color: "var(--text-secondary)" }}>
                    <Copy className="w-3.5 h-3.5" /> Panoya Kopyala
                  </button>
                  <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-35" style={{ background: "rgba(244,64,107,0.12)", color: "#FF6E92" }}>
                    <Trash2 className="w-3.5 h-3.5" /> Sil
                  </button>
                </div>
              )}

              {/* Akıllı Mola Önerisi — yalnızca Süre alanı açıkken ve gün
                  toplamı 4 saati geçtiğinde, aynı öneri zaten uygulanmadıysa. */}
              {showRestSuggestion && (
                <button
                  onClick={addRestBreak}
                  className="w-full mb-4 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left transition-transform hover:scale-[1.01]"
                  style={{ background: `${NEON.emerald}14`, border: `1px solid ${NEON.emerald}55`, boxShadow: `0 0 14px -4px ${NEON.emerald}66` }}
                >
                  <Coffee className="w-4 h-4 shrink-0" style={{ color: NEON.emerald }} />
                  <span className="flex-1 text-[12.5px] font-semibold" style={{ color: NEON.emerald }}>
                    Bu gün 4 saati geçti — araya 15 dk mola eklemek ister misin?
                  </span>
                  <Plus className="w-4 h-4 shrink-0" style={{ color: NEON.emerald }} />
                </button>
              )}

              {/* Hızlı Görev Ekle */}
              <div className="glass rounded-2xl p-3 mb-4 flex flex-col gap-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">
                  ✨ Hızlı Görev Ekle — {activeDay}. güne
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitQuickAdd()}
                    placeholder="Görev adı yaz... (ör. 45 Dk Derin Çalışma)"
                    className="flex-1 min-w-0 min-h-[48px] sm:min-h-0 rounded-xl px-3.5 py-2 outline-none text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                    style={{ background: "var(--bg-input)" }}
                  />
                  <button
                    onClick={submitQuickAdd}
                    disabled={!quickTitle.trim()}
                    aria-label="Görevi ekle"
                    className="min-h-[48px] sm:min-h-0 sm:w-11 sm:h-11 flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all disabled:opacity-40"
                    style={GLOW_ACTIVE_STYLE}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="sm:hidden text-[13px]">Ekle</span>
                  </button>
                </div>

                {/* Yalnızca AÇIK olan özellik alanları görünür. */}
                {(hasAttr("duration") || hasAttr("budget") || hasAttr("pomodoro") || hasAttr("time") || hasAttr("goal") || hasAttr("energy")) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {hasAttr("duration") && (
                      <MiniField icon="⏱" placeholder="dk" value={quickDuration} onChange={setQuickDuration} type="number" width="w-16" />
                    )}
                    {hasAttr("pomodoro") && (
                      <MiniField icon="🍅" placeholder="× 25dk" value={quickExtras.pomodoroCount ?? ""} onChange={(v) => setQuickExtras((p) => ({ ...p, pomodoroCount: v }))} type="number" width="w-20" />
                    )}
                    {hasAttr("budget") && <MiniField icon="🏷️" placeholder="Bütçe" value={quickCost} onChange={setQuickCost} width="w-24" />}
                    {hasAttr("time") && (
                      <MiniField icon="🕐" placeholder="14:30" value={quickExtras.timeOfDay} onChange={(v) => setQuickExtras((p) => ({ ...p, timeOfDay: v }))} width="w-20" />
                    )}
                    {hasAttr("goal") && (
                      <MiniField icon="🎯" placeholder="ör. 10 Sayfa" value={quickExtras.goalMetric} onChange={(v) => setQuickExtras((p) => ({ ...p, goalMetric: v }))} width="w-28" />
                    )}
                    {PRIORITIES.map((p) => {
                      const selected = quickPriority === p;
                      const st = PRIORITY_STYLE[p];
                      return (
                        <button key={p} onClick={() => setQuickPriority(selected ? null : p)} className="min-h-[40px] sm:min-h-0 text-[11px] font-semibold px-2.5 sm:py-1.5 rounded-full transition-colors" style={{ background: selected ? st.bg : "var(--bg-input)", color: selected ? st.color : "var(--text-secondary)", border: selected ? "1px solid transparent" : "1px solid var(--border-default)" }}>
                          {p}
                        </button>
                      );
                    })}
                    {hasAttr("energy") &&
                      ENERGY_LEVELS.map((lvl) => {
                        const selected = quickExtras.energyLevel === lvl;
                        const st = ENERGY_STYLE[lvl];
                        return (
                          <button key={lvl} onClick={() => setQuickExtras((p) => ({ ...p, energyLevel: selected ? null : lvl }))} className="min-h-[40px] sm:min-h-0 text-[11px] font-semibold px-2.5 sm:py-1.5 rounded-full transition-colors" style={{ background: selected ? st.bg : "var(--bg-input)", color: selected ? st.color : "var(--text-secondary)", border: selected ? "1px solid transparent" : "1px solid var(--border-default)" }}>
                            {st.icon} {lvl}
                          </button>
                        );
                      })}
                  </div>
                )}

                {/* Konum — "hemen altına şık bir input alanı açılsın" isteği
                    doğrultusunda kendi geniş satırında, mini-alan sırasının
                    HEMEN ALTINDA açılır. map_search_query GERÇEK bir sütun
                    (bkz. planService.js/TaskCard.jsx'in ZATEN var olan 📍
                    harita butonu) — burada yazılan değer doğrudan oraya gider. */}
                {hasAttr("location") && (
                  <div className="flex items-center gap-1.5 rounded-xl px-3 min-h-[48px] sm:min-h-0 sm:py-2" style={{ background: "var(--bg-input)" }}>
                    <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-faint)" }} />
                    <input
                      type="text"
                      value={quickExtras.mapQuery}
                      onChange={(e) => setQuickExtras((p) => ({ ...p, mapQuery: e.target.value }))}
                      placeholder="Konum / Google Maps URL (ör. Kadıköy Sahil ya da harita linki)"
                      className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                    />
                  </div>
                )}
              </div>

              {/* Aktif günün görev listesi — sürükle-bırak sıralanabilir.
                  deferredActiveTasks kullanır (bkz. yukarıdaki useDeferredValue
                  notu) — yazma/tıklama girdisi asla bu listenin render
                  maliyetine takılmaz; geciken karede hafif bir soluklaşma
                  (isTaskListStale) durumu görsel olarak sinyaller. */}
              <div className="flex flex-col gap-2.5 transition-opacity duration-150" style={{ opacity: isTaskListStale ? 0.6 : 1 }}>
                {activeTasks.length === 0 && (
                  <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: "var(--border-default)" }}>
                    <p className="text-[12.5px] text-[var(--text-faint)]">{activeDay}. gün için henüz görev yok — yukarıdaki hızlı ekle formunu kullan.</p>
                  </div>
                )}
                {deferredActiveTasks.map((t, index) => {
                  const checked = selectedIds.has(t.localId);
                  return (
                  <div
                    key={t.localId}
                    draggable={!selectMode}
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={() => setDragIndex(null)}
                    className="spring-lift glass rounded-2xl p-3 flex flex-col gap-2.5 transition-opacity"
                    style={{ opacity: dragIndex === index ? 0.4 : 1, "--spring-glow": `${NEON.cyan}40`, ...(checked ? { outline: `1px solid ${NEON.violet}70`, background: `${NEON.violet}0d` } : {}) }}
                  >
                    <div className="flex items-center gap-2">
                      {selectMode ? (
                        <button onClick={() => toggleSelectTask(t.localId)} aria-label={checked ? "Seçimi kaldır" : "Görevi seç"} className="shrink-0 flex items-center justify-center w-6 h-6" style={{ color: checked ? NEON.violet : "var(--text-faint)" }}>
                          {checked ? <CheckSquare className="w-[18px] h-[18px]" /> : <Square className="w-[18px] h-[18px]" />}
                        </button>
                      ) : (
                        <span className="shrink-0 cursor-grab active:cursor-grabbing text-[var(--text-faint)] hidden sm:flex" aria-hidden="true" title="Sürükleyerek sırala">
                          <GripVertical className="w-4 h-4" />
                        </span>
                      )}
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => updateTask(t.localId, { title: e.target.value })}
                        placeholder="Görev başlığı..."
                        className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--placeholder)]"
                      />
                      <button onClick={() => removeTask(t.localId)} aria-label="Görevi sil" className="shrink-0 w-11 h-11 md:w-7 md:h-7 rounded-lg flex items-center justify-center text-[var(--text-faint)] hover:text-[#FF6E92] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={t.detail ?? ""}
                      onChange={(e) => updateTask(t.localId, { detail: e.target.value || null })}
                      placeholder="Not / açıklama ekle..."
                      className="bg-transparent outline-none text-[11.5px] text-[var(--text-faint)] placeholder:text-[var(--placeholder)] pl-0 sm:pl-6"
                    />

                    <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-6">
                      {hasAttr("duration") && (
                        <MiniField icon="⏱" placeholder="dk" value={t.duration_min ?? ""} onChange={(v) => updateTask(t.localId, { duration_min: v ? Number(v) : null })} type="number" width="w-12" dense />
                      )}
                      {hasAttr("budget") && (
                        <MiniField icon="🏷️" placeholder="Bütçe" value={t.estimated_cost ?? ""} onChange={(v) => updateTask(t.localId, { estimated_cost: v || null })} width="w-24" dense />
                      )}
                      {hasAttr("location") && (
                        <MiniField icon="📍" placeholder="Konum / Maps URL" value={t.map_search_query ?? ""} onChange={(v) => updateTask(t.localId, { map_search_query: v || null })} width="w-40" dense />
                      )}
                      <div className="flex items-center gap-1">
                        {PRIORITIES.map((p) => {
                          const selected = t.priority === p;
                          const st = PRIORITY_STYLE[p];
                          return (
                            <button key={p} onClick={() => updateTask(t.localId, { priority: selected ? null : p })} className="min-h-[40px] md:min-h-0 text-[10.5px] font-semibold px-2.5 md:px-2 md:py-1 rounded-full transition-colors" style={{ background: selected ? st.bg : "var(--bg-input)", color: selected ? st.color : "var(--text-secondary)", border: selected ? "1px solid transparent" : "1px solid var(--border-default)" }}>
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        {/* Alt — sabit footer */}
        <div
          className={`relative z-10 shrink-0 px-4 md:px-8 lg:px-10 py-4 items-center justify-between gap-3 border-t ${mobileStep === 2 ? "flex" : "hidden lg:flex"}`}
          style={{
            borderColor: "var(--border-header)",
            background: "rgba(var(--glass-rgb), var(--alpha-chrome))",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="min-w-0 flex items-center gap-3">
            {(error || importing) && (
              <p className="text-[12px] font-medium truncate" style={{ color: importing ? "var(--text-muted)" : "#FF6E92" }}>
                {importing ? "Dosya işleniyor..." : error}
              </p>
            )}
            {/* Mobilde İçe/Dışa Aktar (başlıkta gizliydi, sm:hidden) buraya taşınır. */}
            <div className="flex sm:hidden items-center gap-1.5">
              <button onClick={() => setImportModalOpen(true)} aria-label="İçe aktar" className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(var(--overlay-rgb), 0.06)", color: "var(--text-muted)" }}>
                <Upload className="w-4 h-4" />
              </button>
              <button onClick={() => setExportModalOpen(true)} aria-label="Dışa aktar" className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(var(--overlay-rgb), 0.06)", color: "var(--text-muted)" }}>
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-2 rounded-2xl px-6 min-h-[48px] lg:py-3 text-[14px] font-bold transition-all disabled:opacity-60"
            style={PRIMARY_BUTTON_STYLE}
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {isEditMode ? "Değişiklikleri Kaydet" : "Planı Kaydet ve Başlat"}
              </>
            )}
          </button>
        </div>
      </div>

      <ImportFormatModal open={importModalOpen} onPick={handleFormatPicked} onClose={() => setImportModalOpen(false)} />
      <ExportFormatModal open={exportModalOpen} onPick={handleExportFormatPicked} onClose={() => setExportModalOpen(false)} />

      {/* "Şık PDF Çıktısı" — app.jsx'teki (kaydedilmiş plan) PDF akışıyla AYNI
          .print-root/@media print tekniği, ama Studio Builder'ın YEREL
          (henüz kaydedilmemiş olabilir) durumundan üretilir (bkz.
          printShape). React Portal İLE document.body'ye taşınır — bu modal
          `position:fixed` + `overflow:hidden` bir kapsayıcının İÇİNDE
          olduğundan, .print-root'u DOĞRUDAN burada bırakmak bazı
          tarayıcılarda baskı çıktısını kırpabilirdi; portal bu riski
          tamamen ortadan kaldırır (app.jsx'teki köke-yakın konumla AYNI). */}
      {createPortal(
        <Suspense fallback={null}>
          <PrintablePlan plan={printShape.plan} routines={printShape.routines} weeks={printShape.weeks} />
        </Suspense>,
        document.body
      )}
    </>
  );
}

// Küçük, tekrar kullanılabilir ikon+input çifti — Hızlı Ekle formu ve görev
// kartlarındaki opsiyonel alanlarda ortak kullanılır.
function MiniField({ icon, placeholder, value, onChange, type = "text", width = "w-20", dense = false }) {
  return (
    <div className={`flex items-center gap-1 rounded-lg px-2 ${dense ? "min-h-[40px] md:min-h-0 md:py-1" : "min-h-[48px] sm:min-h-0 py-2"}`} style={{ background: "var(--bg-input)" }}>
      <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{icon}</span>
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${width} bg-transparent outline-none text-[12px] text-[var(--text-primary)] placeholder:text-[var(--placeholder)]`}
      />
    </div>
  );
}

// TASARIM/VERİ NOTLARI:
// - Sürükle-Bırak GERÇEKTEN kalıcı: her görevin sırası kaydederken
//   tasks.sort_order'a yazılır (bkz. planService.saveManualPlanToSupabase +
//   supabase/task_sort_order.sql). Bu sütun/migration OLMADAN sürükle-bırak
//   yalnızca kaydetmeden ÖNCEKİ ekranda anlamlı olur, plan yeniden
//   açıldığında sıra KORUNMAZDI — bu yüzden yalnızca bir sürükleme ikonu
//   eklemek yeterli değildi, gerçek persistans gerekiyordu.
// - Pomodoro/Saat/Hedef/Enerji için AYRI bir DB sütunu YOK — tasks tablosu
//   yalnızca title/detail/duration_min/priority/estimated_cost/
//   map_search_query taşıyor. Pomodoro Sayacı bunun İSTİSNASI: doğrudan
//   duration_min'e (N×25dk) yazılır, bu sayede TaskCard.jsx'in ZATEN var
//   olan estimatePomodoros() mantığı bu görevi otomatik 🍅×N rozetiyle
//   gösterir — yeni kod GEREKMEDİ. Saat/Hedef/Enerji ise composeDetail()
//   ile GÖRÜNÜR, düzenlenebilir bir açıklama metnine dönüştürülür (sessizce
//   kaybolmaz, TaskCard'ın detay çekmecesinde okunur) — gerçek bir
//   zamanlayıcı/bildirim sistemi DEĞİLDİR, bunu iddia etmiyoruz.
// - Konum (📍) GERÇEK bir sütuna yazılır: tasks.map_search_query — hem
//   Hızlı Ekle'de hem her görev kartında aynı alan, TaskCard.jsx'in ZATEN
//   var olan harita butonuyla otomatik uyumlu (yeni gösterim kodu gerekmedi).
// - Genel Rutinler de GERÇEK: routines tablosuna, AI akışının
//   savePlanToSupabase'i ile AYNI insert deseniyle yazılır (yalnızca
//   frequency varsayılanı farklı — elle girilen rutinler "daily").
// - Pano (Task Clipboard) tamamen istemci tarafında — kaydedilene kadar
//   hiçbir sunucu isteği YAPILMAZ. Panoya kopyalanan görevler yapıştırıldığı
//   günün MEVCUT görevlerine EKLENİR, üzerine yazmaz — bu yüzden aynı görev
//   grubunu birden çok kez farklı günlere biriktirerek yapıştırabilirsin.
// - Planı Düzenle (editingPlan dolu): kayıt api/plan-edit.js üzerinden
//   GİDER (client anon key tasks satırlarını silemediği için, bkz. o
//   dosyanın yorumları) ve TÜM görevler/rutinler silinip builder'ın GÜNCEL
//   haliyle yeniden yazılır (kısmi diff değil). Kullanıcının is_completed
//   ilerlemesi KORUNUR: her görev editingPlan'dan yüklenirken bunu yolcu
//   olarak taşır, yalnızca panodan yapıştırılan/yeni eklenen görevler
//   false'la başlar.
// - Akıllı İçe Aktarma (JSON/Markdown/TXT/CSV/PDF): JSON en güvenilir
//   yoldur (Routinix'in kendi şeması). Markdown/TXT/PDF AYNI sezgisel
//   ayrıştırıcıyı (utils/planImportParsers.js) paylaşır — PDF önce
//   pdfjs-dist ile düz metne çevrilir. CSV yalnızca GÖREVLERİ içe aktarır
//   (rutinler CSV'nin satır/gün modeline uymadığından bilinçli olarak
//   dahil edilmez). Hiçbiri %100 doğruluk iddia etmez — kullanıcı sonucu
//   HER ZAMAN Builder'da görüp kaydetmeden önce düzeltebilir.
// - Dışa Aktarma: JSON (tam yedek) + .ics (utils/icsExport.js — Gün 1
//   bugüne bağlanır, saat notu yoksa 09:00 varsayılır, gerçek bir
//   zamanlayıcı DEĞİLDİR) + PDF (mevcut PrintablePlan/print altyapısının
//   builder'ın YEREL state'iyle yeniden kullanılması, plan kaydedilmeden
//   de çalışır).
