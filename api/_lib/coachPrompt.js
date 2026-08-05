import { wrapGeminiError } from "./aiErrors.js";
import { getCachedCoachModel } from "./coachCache.js";

// AI Koç'un serbest metin niyet tespiti — SUNUCU TARAFI port'u. Eskiden
// src/services/aiPipelineService.js içinde tarayıcıdan VITE_GEMINI_API_KEY ile
// doğrudan çağrılıyordu (anahtar client bundle'ına gömülüyordu — güvensiz).
// Artık yalnızca burada, process.env.GEMINI_API_KEY (VITE_ önekSİZ, yalnızca
// sunucuda okunur) ile çalışır. Model = gemini-flash-lite-latest, GEMİNİ
// CONTEXT CACHING ile (bkz. coachCache.js) — bu system instruction (~1426
// token) projedeki 5 Gemini çağrısı arasında Gemini'nin caching alt sınırını
// (1024 token) geçen TEK'i olduğu için caching yalnızca burada uygulanır.

// plans: [{ id, title, mode, total_days, tasks: [...] }] — service_role ile
// önceden kullanıcıya ait olduğu doğrulanmış planlar (bkz. api/coach-action.js).
// selectedPlanId: widget'ın üstündeki "Konuştuğun Plan" seçicisinden gelen,
// İSTEMCİNİN ZATEN BİLDİĞİ hedef — önceden buraya hiç ulaşmıyordu, bu yüzden
// AI her mesajda planlar arasında körlemesine tahmin yapmak zorunda kalıyor,
// emin olamayınca da (özellikle aynı total_days'e sahip birden fazla plan
// varken) sürekli "hangi planı kastettin?" diye sormaya geri dönüyordu —
// konuşma hafızası da olmadığından bu sonsuz bir döngüye dönüşüyordu.
//
// TOKEN MİMARİSİ: yalnızca hedef plan (seçili olan, ya da tek planı varsa o)
// GÖREV SEVİYESİNDE (task_id dahil) serileştirilir; kullanıcının DİĞER
// TÜM planları yalnızca tek satırlık bir ÖZET (başlık/mod/gün/tamamlanma)
// olarak verilir — tam görev listesi DEĞİL. Böylece prompt boyutu kullanıcının
// TOPLAM plan sayısıyla değil (artık üst limit de yok, bkz. constants.js),
// yalnızca TEK bir planın görev sayısıyla ölçeklenir.
export async function runCoachIntent({ message, plans = [], selectedPlanId = null }) {
  const targetPlan = plans.find((p) => p.id === selectedPlanId) || (plans.length === 1 ? plans[0] : null);
  const otherPlans = plans.filter((p) => p.id !== targetPlan?.id);

  const describeTargetPlan = (p) => {
    const tasks = (p.tasks || [])
      .slice()
      .sort((a, b) => (a.is_completed === b.is_completed ? a.day_number - b.day_number : a.is_completed ? 1 : -1))
      .slice(0, 40)
      .map((t) => `${t.day_number}|${t.id}|${t.title}|${t.duration_min ?? "-"}dk|${t.priority ?? "-"}|${t.is_completed ? "tamam" : "bekliyor"}`)
      .join("\n");
    return `PLAN[${p.id}] "${p.title}" (${p.mode || "general"}, ${p.total_days ?? "?"} gün) — ŞU AN SEÇİLİ/HEDEF PLAN\nformat → gün|task_id|başlık|süre|öncelik|durum\n${tasks || "(görev yok)"}`;
  };

  const describeOtherPlan = (p) => {
    const total = p.tasks?.length || 0;
    const done = (p.tasks || []).filter((t) => t.is_completed).length;
    return `PLAN[${p.id}] "${p.title}" (${p.mode || "general"}, ${p.total_days ?? "?"} gün, ${done}/${total} görev tamam) — özet, görev id'leri YOK`;
  };

  const context =
    [targetPlan ? describeTargetPlan(targetPlan) : null, ...otherPlans.map(describeOtherPlan)].filter(Boolean).join("\n\n") ||
    "(kullanıcının hiç planı yok)";

  const systemInstruction = `Sen Routinix uygulamasının kişisel AI Koçusun — şık, özgüvenli, odaklı bir beyaz yakalı performans dili kullanırsın (asla soğuk mühendislik jargonu ya da abartılı savaş ağzı değil).

Sana kullanıcının planları veriliyor. TAM OLARAK BİR tanesi "ŞU AN SEÇİLİ/HEDEF PLAN" olarak işaretli ve görev (task) id'leriyle birlikte veriliyor — bu, kullanıcının uygulamadaki plan seçicisinden ZATEN seçtiği plandır. Diğer planlar yalnızca kısa bir özet olarak (görev id'si OLMADAN) verilir, sadece bağlam/isim eşleştirmesi için.

KESİN KURALLAR:
- VARSAYILAN DAVRANIŞ: kullanıcının mesajı hangi plandan bahsettiğini AÇIKÇA belirtmiyorsa (başka bir planın adını/temasını anmıyorsa), HER ZAMAN "ŞU AN SEÇİLİ/HEDEF PLAN" olanı hedefle (target_plan_id = o planın id'si). Bunun için kullanıcıya SORMA — zaten ekranda o planı seçmiş durumda.
- Kullanıcı AÇIKÇA özet listedeki BAŞKA bir planı (isim/tema ile) kastediyorsa: target_plan_id'yi o plana ayarla, ama o planın görev id'leri sende YOK — bu yüzden mutations/new_tasks/deleted_task_ids'i KESİNLİKLE BOŞ bırak, plan_total_days'i null bırak, reply'de kullanıcıdan üstteki plan seçiciden o planı seçmesini nazikçe iste.
- "süreyi azalt / hafiflet / kolaylaştır" → hedef planın (belirtilmemişse tamamlanmamış) görevlerinin duration_min'ini makul bir oranda (örn %20-40) düşür.
- "yoğunlaştır / sıkılaştır / hızlandır" → duration_min'i hafifçe düşür (örn %10-20) ve/veya priority'yi bir kademe yükselt (Düşük→Orta→Yüksek).
- "planı N güne indir/kısalt/sıkılaştır (ör. 7 günden 5 güne)" → BİRLİKTE uygula: (1) plan_total_days'i N yap. (2) Görev sayısı N günlük yeni programa göre fazlaysa, öncelik sırasına göre en az kritik olanları (priority "Düşük" olanlar, tekrar eden/opsiyonel nitelikte görünenler, "çok önemli olmayan" diye tarif edilenler) deleted_task_ids'e ekleyerek KALDIR — kullanıcı açıkça "kaldır/sil/çıkar" dediyse bu adımı MUTLAKA uygula, sadece görmezden gelip gün numarasını değiştirmekle YETİNME. (3) Geriye kalan görevleri mutations'ta fields.day_number ile 1..N aralığına yeniden dağıt (bir güne birden fazla görev düşebilir). Tamamlanmış (is_completed: true) görevleri SİLME, yalnızca bekleyenler arasından seç.
- "bir görevi/aktiviteyi kaldır / sil / çıkar / gereksiz" (plan süresi değişmeden) → yalnızca o görev(ler)i deleted_task_ids'e ekle, plan_total_days'e dokunma.
- "X görevi/aktivitesi ekle" → new_tasks içine title + kısa detail + gerçekçi duration_min + uygun bir day_number ile yeni görev tanımla (day_number belirtilmemişse plandaki en yakın uygun güne ya da son güne ekle).
- "günü kaydır / ertele / yarına al" → ilgili günün tamamlanmamış görevlerinin mutations[].fields.day_number'ını hedef güne taşı.
- "planı N güne uzat / genişlet" → plan_total_days'i N yap, gerekirse new_tasks ile yeni günlere makul görevler ekle.
- "muadil öner" gibi tamamen bilgilendirici/istişari isteklerde mutations/new_tasks/deleted_task_ids BOŞ kalabilir, plan_total_days null kalabilir, yalnızca reply doldurulur — bu geçerli bir yanıttır.
- deleted_task_ids/mutations[].task_id alanlarında YALNIZCA sana verilen context'teki gerçek id'leri kullan. Böyle bir id yoksa veya emin değilsen o görevi ekleme, UYDURMA.
- Plan bağlamıyla alakasız (genel sohbet, konu dışı soru) ya da ne istendiği gerçekten anlaşılmayan isteklerde intent'i "unclear" yap, mutations/new_tasks/deleted_task_ids'i boş bırak, reply'de kısaca ne yapabileceğini hatırlat.
- reply KISA olsun (1-3 cümle), sıcak ve motive edici ama abartısız bir üslupla, Türkçe yaz.

Yanıtın SADECE ve KESİNLİKLE şu JSON şeması olmalı, şema dışına hiçbir metin ekleme:
{
  "reply": "kullanıcıya gösterilecek kısa Türkçe yanıt",
  "intent": "lighten" | "intensify" | "postpone" | "add_task" | "delete_task" | "resize_plan" | "info" | "unclear",
  "target_plan_id": "uuid ya da null",
  "plan_total_days": 5,
  "mutations": [ { "task_id": "context'teki gerçek id", "fields": { "duration_min": 30, "priority": "Yüksek", "day_number": 5 } } ],
  "new_tasks": [ { "day_number": 3, "title": "...", "detail": "...", "duration_min": 30, "priority": "Orta" } ],
  "deleted_task_ids": [ "context'teki gerçek id" ]
}
fields ve new_tasks nesnelerinde yalnızca gerçekten değişen/gerekli alanları doldur. plan_total_days'i DEĞİŞTİRMİYORSAN null bırak (0 ya da mevcut değer değil, null — aksi halde gereksiz bir güncelleme tetiklenir).`;

  const userPrompt = `Kullanıcının planları:\n${context}\n\nKullanıcının mesajı: "${String(message || "").trim()}"`;

  const model = await getCachedCoachModel(systemInstruction);
  let text;
  try {
    const result = await model.generateContent(userPrompt);
    text = result.response.text();
  } catch (err) {
    throw wrapGeminiError(err, "Yapay zeka isteği başarısız oldu.");
  }

  let parsed;
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Yapay zeka yanıtı geçerli JSON değil.");
  }

  const planTotalDays = Number(parsed?.plan_total_days);

  return {
    reply: String(parsed?.reply || "").trim() || "Anladım, hemen ilgileniyorum.",
    intent: parsed?.intent || "unclear",
    targetPlanId: parsed?.target_plan_id || null,
    mutations: Array.isArray(parsed?.mutations) ? parsed.mutations.slice(0, 50) : [],
    newTasks: Array.isArray(parsed?.new_tasks) ? parsed.new_tasks.slice(0, 20) : [],
    deletedTaskIds: Array.isArray(parsed?.deleted_task_ids) ? parsed.deleted_task_ids.slice(0, 50) : [],
    planTotalDays: Number.isFinite(planTotalDays) && planTotalDays > 0 ? planTotalDays : null,
  };
}
