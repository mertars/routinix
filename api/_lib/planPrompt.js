import { wrapGeminiError } from "./aiErrors.js";
import { getRoutedModel } from "./geminiRouter.js";
import { hydratePlanTemplate, hydrateWeekTemplate } from "./planHydration.js";

// AI plan üretim pipeline'ının SUNUCU TARAFI portu. Eskiden bu dosyanın
// içeriği src/services/aiPipelineService.js'te idi ve VITE_GEMINI_API_KEY ile
// tarayıcıdan doğrudan Gemini'yi çağırıyordu — anahtar client bundle'ına
// gömülüyordu (güvensiz). Artık yalnızca burada, process.env.GEMINI_API_KEY
// (VITE_ önekSİZ, yalnızca sunucu okur) ile çalışır. Persona/prompt metinleri
// birebir korunmuştur; davranış değişmez.
//
//   1) Dynamic Personas: kategoriye göre uzman "şapkası" (system instruction).
//   2) Token Tasarrufu (Lazy Loading): tüm plan tek seferde İSTENMEZ. İlk çağrı
//      sadece genel rutinleri + 1. haftanın görevlerini üretir; sonraki
//      haftalar ayrı isteklerle (fetchNextWeekTasks) üretilir.
//   3) Model + maxOutputTokens seçimi artık BURADA DEĞİL, geminiRouter.js'te
//      merkezi — hangi operasyonun hangi modeli/tavanı kullandığını görmek/
//      değiştirmek için oraya bak.

// ---------------------------------------------------------------------------
// Persona Haritası — kategori → uzman şapkası (system instruction)
// ---------------------------------------------------------------------------
const PERSONAS = {
  software: `Sen 15+ yıllık deneyime sahip bir Principal Software Architect'sin. Ürettiğin her plan ve görev; SOLID prensipleri, Tasarım Desenleri (Design Patterns), Bellek Yönetimi (Memory Management), Asenkron Yapılar (async/await, event loop, concurrency) ve Clean Architecture farkındalığıyla şekillenmeli. Görevler soyut değil somut, ölçülebilir ve profesyonel mühendislik pratiğine uygun olmalı. Her görevin "description" alanında hangi prensibi/deseni/kavramı pekiştirdiğini kısaca belirt. İlerleme mantıklı bir öğrenme eğrisi izlesin (önce temel, sonra ileri).`,

  fitness: `Sen CSCS (Certified Strength and Conditioning Specialist) sertifikalı bir Baş Antrenörsün. Planların Progressive Overload (kademeli aşırı yükleme) ilkesi üzerine kurulu olmalı; uygun antrenman bölünmesini (Split ya da Push/Pull/Legs) kur, her egzersiz için hedef set x tekrar aralığını ve RPE/RIR (Rate of Perceived Exertion / Reps In Reserve) değerini belirt, kısa bir biyomekanik/form ipucu ekle. Dinlenme ve aktif toparlanma (recovery) günlerini planlamayı ihmal etme. Sakatlanmayı önleyecek şekilde gerçekçi ol.`,

  vacation: `Sen deneyimli, profesyonel bir Seyahat Rehberisin. Günleri coğrafi yakınlığa göre grupla (aynı gün birbirine yakın noktalar), saat sırasına göre mantıklı bir rota kur. Her aktivite için: gerçek ve Google Maps'te aratıldığında doğru sonucu verecek somut bir "map_search_query" (mekan adı + şehir), ve para birimiyle gerçekçi bir "estimated_cost" ("Ücretsiz" olabilir) ver. Yeme-içme, ulaşım ve dinlenme molalarını da rotaya yedir.`,

  general: `Kullanıcının hedefi software/fitness/vacation kategorilerinin dışında bir alansa (örn. dil öğrenimi, finans, müzik, sanat, kişisel gelişim, sınav hazırlığı vb.), sen o alanın DÜNYACA ÜNLÜ Baş Uzmanı ve aynı zamanda bir Öğrenme Bilimcisi (Meta-Learning Specialist) oluyorsun. Önce hedefin hangi disipline ait olduğunu tespit et ve o disiplinin gerçek jargonuna, terminolojisine ve en iyi pratiklerine (best practices) uygun, derinlikli bir müfredat kur. Bilimsel öğrenme metotlarını AKTİF olarak uygula: Feynman Tekniği (öğrenileni basitçe anlatarak pekiştirme), Aralıklı Tekrar (Spaced Repetition — önceki günlerin konularını planlı aralıklarla tekrar ettir) ve 80/20 Pareto İlkesi (sonucun %80'ini getiren kritik %20'lik çekirdeğe önce ve ağırlıklı odaklan). Her görevin "description" alanında, mümkünse hangi öğrenme metodunu kullandığını ya da o adımın disiplindeki yerini kısaca belirt. İlerleme, temelden ustalığa doğru bilimsel bir öğrenme eğrisi izlesin.`,
};

function personaFor(category) {
  return PERSONAS[category] || PERSONAS.general;
}

// Kategoriye göre bir görevin (task) hangi ekstra alanları taşıması gerektiğini
// tarif eden ortak yönerge — hem ilk hafta hem sonraki haftalarda kullanılır.
//
// TEMPLATE HYDRATION (çıktı token tasarrufu): Her task artık bir JSON NESNESİ
// DEĞİL, SABİT SIRALI bir dizi ("tuple") olarak isteniyor — bkz. planHydration.js
// TASK_SHAPE (buradaki alan sırasıyla BİREBİR eşleşmeli). Tekrarlayan anahtar
// isimleri ("title":, "description":, "duration_min": ...) her görevde YENİDEN
// yazılmak yerine bir kez, şemada tarif edilir. Ayrıca ÖNCEDEN "sets"/"reps"/
// "rpe" (fitness) ve "focus" (software) AYRI JSON alanları olarak isteniyordu
// ama planService.js'in flattenWeek()'i bunları HİÇBİR ZAMAN okumuyordu —
// model bu alanları üretiyor, Gemini bunun için ücret alıyor, backend
// SESSİZCE ÇÖPE ATIYORDU (UI'da da hiç gösterilmiyordu, bkz. TaskCard.jsx).
// Artık bu bilgi description'ın İÇİNE gömülüyor — hem israf kalkıyor hem
// kullanıcı bu bilgiyi GERÇEKTEN görüyor (önceden hiç görmüyordu).
function taskFieldGuide(category) {
  if (category === "vacation") {
    return `Token tasarrufu için her günün "tasks" alanı NESNE DİZİSİ DEĞİL, tam olarak şu SIRADA 5 elemanlı bir dizi-içinde-dizi olmalı: [title, description, duration_min, estimated_cost, map_search_query]. title: aktivite/mekan adı. description: kısa açıklama. duration_min: tahmini süre (dakika). estimated_cost: örn. "250 TL" ya da "Ücretsiz". map_search_query: Google Maps'te aratıldığında doğru sonucu verecek somut bir sorgu (mekan adı + şehir).`;
  }
  if (category === "fitness") {
    return `Token tasarrufu için her günün "tasks" alanı NESNE DİZİSİ DEĞİL, tam olarak şu SIRADA 4 elemanlı bir dizi-içinde-dizi olmalı: [title, description, duration_min, priority]. title: egzersiz/aktivite adı. description: kısa form/biyomekanik ipucu — set sayısını, tekrar aralığını (örn. "8-12") VE hedef RPE/RIR'ı (örn. "RPE 8") DOĞAL bir cümleye göm, ayrı alan AÇMA (örn. "3x10, RPE 8 - dirsekleri sabit tut, kontrollü indir"). duration_min: tahmini süre (dakika). priority: "Yüksek"|"Orta"|"Düşük" (egzersizin programdaki önemine göre).`;
  }
  if (category === "software") {
    return `Token tasarrufu için her günün "tasks" alanı NESNE DİZİSİ DEĞİL, tam olarak şu SIRADA 4 elemanlı bir dizi-içinde-dizi olmalı: [title, description, duration_min, priority]. title: görev başlığı. description: hangi prensip/desen/kavramın (SOLID/Async/Memory vb.) pekiştirildiğini DOĞAL bir cümle içinde belirt, ayrı alan AÇMA (örn. "Repository pattern ile SOLID - SRP prensibini pekiştirir"). duration_min: tahmini süre (dakika). priority: "Yüksek"|"Orta"|"Düşük".`;
  }
  return `Token tasarrufu için her günün "tasks" alanı NESNE DİZİSİ DEĞİL, tam olarak şu SIRADA 4 elemanlı bir dizi-içinde-dizi olmalı: [title, description, duration_min, priority]. title: görev başlığı. description: kısa açıklama. duration_min: tahmini süre (dakika). priority: "Yüksek"|"Orta"|"Düşük".`;
}

// Verilen system instruction ile modeli çalıştırıp katı JSON'ı parse eder.
// operation: geminiRouter.js'teki ROUTES anahtarlarından biri.
// export EDİLDİ: nutritionPrompt.js de (ROUTINIX_CORE_ARCHITECT_v2) AYNI
// çağrı/parse mantığını kullanıyor — burada tekrar yazmak yerine paylaşılıyor.
export async function runJson(operation, systemInstruction, userPrompt, label = "AI isteği") {
  const model = getRoutedModel(operation, systemInstruction);

  let text;
  try {
    const result = await model.generateContent(userPrompt);
    text = result.response.text();
  } catch (err) {
    throw wrapGeminiError(err, `${label} başarısız oldu (Gemini SDK hatası).`);
  }

  try {
    // responseMimeType json olsa da olası kod-bloğu sarmalarına karşı güvenli parse.
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`${label} yanıtı geçerli JSON değil.`);
  }
}

// Kullanıcı girdisini (anket cevapları dahil) okunabilir bir metne çevirir.
function describeUserInput(userInput = {}) {
  const { goal, durationText, startDate, answers } = userInput;
  const lines = [];
  if (goal) lines.push(`Hedef: "${String(goal).trim()}"`);
  if (durationText) lines.push(`Kullanıcının belirttiği süre: ${durationText}`);
  if (startDate) lines.push(`Başlangıç tarihi: ${startDate}`);
  if (Array.isArray(answers) && answers.length) {
    lines.push("Anket cevapları:");
    for (const a of answers) {
      const q = a?.question ?? a?.q ?? "";
      const v = a?.answer ?? a?.a ?? "";
      lines.push(`- ${q} → ${v || "(cevapsız)"}`);
    }
  } else if (answers && typeof answers === "object") {
    lines.push("Anket cevapları:");
    for (const [k, v] of Object.entries(answers)) lines.push(`- ${k} → ${v || "(cevapsız)"}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 0) Dinamik Onboarding — kategoriye + hedefe özel anket soruları
// ---------------------------------------------------------------------------
export async function generateOnboardingQuestions({ category = "general", goal = "" } = {}) {
  const persona = personaFor(category);
  const systemInstruction = `${persona}

Şu an plan ÜRETMİYORSUN. Görevin, kullanıcıyı daha iyi tanıyıp sonradan kişiselleştirilmiş bir plan üretebilmek için, onun hedefine ve alanına ÖZEL 4-6 kısa onboarding sorusu hazırlamak.

Sorular bu boyutları kapsamalı (hedefe göre uyarlayarak): mevcut seviye/deneyim, haftalık/günlük ayırabileceği zaman, öncelik/odak, ve alana özgü kritik bir kısıt. Kategoriye göre örnek: vacation → bütçe aralığı, kiminle gidiliyor, konaklama tarzı; fitness → ekipman erişimi, sakatlık/kısıt, antrenman geçmişi; software → hedef teknoloji/dil, mevcut kod deneyimi; general → öğrenme tarzı, günlük çalışma alışkanlığı.

Soru tipleri:
- "choice": 3-4 kısa, tek seçilebilir şık (options doldur).
- "text": serbest metin cevap (options boş dizi). Bütçe, özel kısıtlamalar, "eklemek istediğin bir şey" gibi durumlarda kullan. En az 1 soru "text" tipinde, sonda "özel kısıtlama/istek" için olsun.

Yanıtın SADECE şu JSON olmalı, şema dışına metin ekleme, Türkçe:
{ "questions": [ { "title": "soru", "type": "choice", "options": ["şık1","şık2","şık3"] } ] }`;

  const userPrompt = `Kategori: ${category}\nKullanıcının hedefi: "${(goal || "").trim()}"`;

  const parsed = await runJson("plan.onboarding_questions", systemInstruction, userPrompt, "Onboarding soruları üretimi");
  const questions = parsed?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Onboarding soruları üretilemedi.");
  }
  return questions.map((q) => ({
    title: String(q.title || "").trim() || "Soru",
    type: q.type === "text" ? "text" : "choice",
    options: Array.isArray(q.options) ? q.options.filter(Boolean).map(String) : [],
  }));
}

// ---------------------------------------------------------------------------
// 1) İlk üretim — genel rutinler + SADECE 1. haftanın görevleri (lazy load)
// ---------------------------------------------------------------------------
export async function createEnrichedPlan(userInput = {}) {
  const category = userInput.category || "general";
  const persona = personaFor(category);

  const systemInstruction = `${persona}

ÇOK ÖNEMLİ — TOKEN TASARRUFU: Kullanıcının hedefi uzun vadeli (haftalar/aylar) olsa bile ŞU AN sadece genel rutinleri ve YALNIZCA 1. HAFTANIN (7 gün) görevlerini DETAYLI üret. Sonraki haftaların GÖREVLERİ ayrı isteklerle üretilecek, bu yüzden ileri haftaların görev DETAYINI üretme.

TOPLAM SÜRE: Hedefte belirtilen ya da hedefe uygun toplam plan süresini GÜN cinsinden hesapla ve "total_days" olarak ver. Kullanıcı açık bir süre belirttiyse ona sadık kal (örn. "6 gün" → 6, "3 hafta" → 21, "6 ay" → ~180, "1 yıl" → ~365). Belirtmemişse hedefe uygun gerçekçi bir toplam gün sayısı seç. total_days pozitif bir tam sayı olmalı.

HAFTALIK İSKELET (week_topics): total_days'i 7'ye bölüp KAÇ HAFTA olduğunu hesapla (örn. 30 gün → 5 hafta, son hafta eksik günlü olabilir) ve HER hafta için kısa (4-8 kelime) bir konu başlığı üret — bu, planın BAŞTAN SONA kaba bir yol haritası/taslağıdır, sonraki haftalar üretilirken tutarlılığı korumak için kullanılacak. week_topics[0], first_week_tasks'ın GERÇEKTE işlediği konuyla uyumlu olmalı (birbirini yalanlamasın). Bu yalnızca kısa başlıklardır, DETAY İÇERMEZ — token maliyeti ihmal edilebilir düzeyde.

${taskFieldGuide(category)}

Yanıtın SADECE ve KESİNLİKLE aşağıdaki JSON yapısında olmalı, şema dışına hiçbir açıklama/metin ekleme. Tüm metinler Türkçe olmalı:
{
  "plan_title": "kısa plan başlığı",
  "plan_summary": "planın 1-2 cümlelik özeti ve genel stratejisi (sonraki haftalar bu özete göre üretilecek)",
  "category": "${category}",
  "total_days": 30,
  "week_topics": ["1. hafta konu başlığı", "2. hafta konu başlığı", "..."],
  "routines": ["genel rutin/prensip 1", "..."],
  "first_week_tasks": [
    { "day": 1, "title": "günün teması", "tasks": [ ["...", "...", 30, "Orta"] ] }
  ]
}
"tasks" dizisindeki her elemanın SIRASI/uzunluğu için yukarıdaki task şeması geçerli (nesne DEĞİL, dizi). first_week_tasks, total_days 7'den küçükse tam olarak total_days kadar gün; değilse tam olarak 7 gün (day 1..7) içermeli. Dinlenme günleri de bir gündür (fitness'ta boş bırakma, "dinlenme" görevi ver). week_topics dizisinin eleman sayısı, total_days'ten hesapladığın toplam hafta sayısına eşit olmalı.`;

  const userPrompt = `${describeUserInput(userInput)}\n\nYukarıdaki bilgilere göre planın toplam süresini (total_days), tüm planın haftalık iskeletini (week_topics), genel rutinlerini ve 1. haftasının detayını üret.`;

  const rawParsed = await runJson("plan.create", systemInstruction, userPrompt, "Plan oluşturma");
  if (!rawParsed?.plan_title || !Array.isArray(rawParsed?.first_week_tasks)) {
    throw new Error("Yapay zeka yanıtında beklenen plan alanları eksik.");
  }
  // Template Hydration: task'lar modelden kompakt tuple olarak geldi
  // (bkz. taskFieldGuide) — flattenWeek/savePlanToSupabase'in beklediği
  // {title, description, duration_min, priority/estimated_cost/...} nesne
  // şekline burada geri çevrilir. Bu satırdan SONRASI (validasyon, return)
  // ESKİDEN OLDUĞU GİBİ nesne şekliyle çalışır — çağıran kod hiç değişmedi.
  const parsed = hydratePlanTemplate(rawParsed, category);
  // week_topics OPSİYONEL kabul edilir (model bazen atlayabilir) — eksikse
  // sessizce boş dizi bırakılır, YENİ akış BOZULMAZ: fetchNextWeekTasks zaten
  // week_topics'i "varsa kullan" mantığıyla ele alıyor (bkz. aşağısı).
  parsed.week_topics = Array.isArray(parsed?.week_topics) ? parsed.week_topics.map((t) => String(t || "").trim()).filter(Boolean) : [];
  return parsed;
}

// ---------------------------------------------------------------------------
// 2) Sonraki hafta — SADECE hedef haftanın görevleri (lazy load devamı)
// ---------------------------------------------------------------------------
// weekTopic / lastTaskTitle: OPSİYONEL devamlılık bağlamı (bkz. plans.week_topics
// sütunu + usePlanStudio.js loadNextWeek). İKİSİ DE undefined/null olabilir —
// bu, "week_topics'i olmayan ESKİ bir plan" ya da bu alanı henüz göndermeyen
// bir client anlamına gelir; bu durumda prompt AŞAĞIDAKİ satırları hiç
// içermez ve fonksiyon TAM OLARAK eskisi gibi (bu alanlar hiç eklenmemiş
// gibi) davranır — GERİYE DÖNÜK UYUMLULUK burada garanti edilir.
export async function fetchNextWeekTasks({ planTitle, planSummary, mode, targetWeekNumber, weekTopic, lastTaskTitle } = {}) {
  const category = mode || "general";
  const persona = personaFor(category);
  const week = Number(targetWeekNumber) || 1;
  const startDay = (week - 1) * 7 + 1;
  const endDay = startDay + 6;

  const continuityLines = [
    weekTopic ? `Bu haftanın planın BAŞINDA belirlenen taslak konusu: "${weekTopic}" — görevler bu temaya sadık kalsın, konu dışına çıkma.` : "",
    lastTaskTitle ? `Önceki hafta EN SON şu konu/görevle bitti: "${lastTaskTitle}". Bu haftaya DOĞRUDAN buradan devam ederek başla — aynı konuyu tekrar etme, konuyu atlayıp ileri gitme.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemInstruction = `${persona}

ÇOK ÖNEMLİ — TOKEN TASARRUFU: Sana planın SADECE başlığı ve genel özeti veriliyor; tüm plan geçmişi değil. Görevin YALNIZCA ${week}. haftanın (gün ${startDay}..${endDay}, toplam 7 gün) görevlerini üretmek. Başka hafta ÜRETME. Bu hafta, planın genel akışında ${week}. haftaya denk gelen mantıklı bir ilerleme/zorluk seviyesinde olmalı (önceki haftaların üzerine ekleyen, tekrar etmeyen bir tempo).
${continuityLines ? `\n${continuityLines}\n` : ""}
${taskFieldGuide(category)}

Yanıtın SADECE ve KESİNLİKLE şu JSON yapısında olmalı, şema dışına hiçbir metin ekleme. Tüm metinler Türkçe olmalı:
{
  "week_number": ${week},
  "week_tasks": [
    { "day": ${startDay}, "title": "günün teması", "tasks": [ ["...", "...", 30, "Orta"] ] }
  ]
}
"tasks" dizisindeki her elemanın SIRASI/uzunluğu için yukarıdaki task şeması geçerli (nesne DEĞİL, dizi). week_tasks tam olarak 7 gün (day ${startDay}..${endDay}) içermeli.`;

  const userPrompt = `Plan başlığı: "${planTitle || ""}"
Plan özeti / genel strateji: "${planSummary || ""}"
Üretilecek hafta: ${week}. hafta (gün ${startDay}-${endDay}).`;

  const rawParsed = await runJson("plan.next_week", systemInstruction, userPrompt, `${week}. hafta üretimi`);
  if (!Array.isArray(rawParsed?.week_tasks) || rawParsed.week_tasks.length === 0) {
    throw new Error("Yapay zeka yanıtında beklenen hafta görevleri eksik.");
  }
  // Template Hydration — bkz. createEnrichedPlan'daki aynı yorum.
  const parsed = hydrateWeekTemplate(rawParsed, category);
  return parsed;
}
