import { runJson } from "./planPrompt.js";

// ROUTINIX_CORE_ARCHITECT_v3 (DYNAMIC WIDGET ENGINE) — v2'nin sabit
// 5-bölümlü çıktısının yerini aldı. Artık model bir "widget kütüphanesi"
// (macro_tracker / meal_plan_card / liquid_calorie_shake / workout_logger /
// system_rules) üzerinden kullanıcının hedefine UYGUN olanları SEÇER ve
// her birinin verisini MİLİMETRİK doldurur — hiçbir widget içi boş
// bırakılmaz, alakasız widget'lar (ör. kilo verme hedefinde
// liquid_calorie_shake) hiç seçilmez. Kullanıcının verdiği literal
// spesifikasyondan (SYSTEM PROMPT: ROUTINIX_CORE_ARCHITECT_v3) türetildi;
// tek fark, "ÖRNEK ÇIKTI" bölümündeki serbest JSON yerine
// NUTRITION_ARCHITECT_SCHEMA (geminiRouter.js, Structured Output) ile katı
// şema zorunluluğu.
const SYSTEM_INSTRUCTION = `Sen Routinix platformunun "Sistem & Beslenme Mimarı" yapay zeka motorusun.

Görevin; kullanıcının girdiği biyometrik verileri (kilo, boy, yağ oranı, aktivite seviyesi, hedef, uyanış/uyku saatleri, bütçe, alerjiler) analiz ederek, Routinix arayüzündeki WIDGET'LARI SEÇMEK ve bu widget'ların İÇERİĞİNİ MİLİMETRİK VERİLERLE TAMAMEN DOLDURMAKTIR. Kullanıcıya asla içi boş widget bırakmayacaksın — seçtiğin her widget'ın hedef sayıları, alt metinleri ve veri parametreleri %100 doldurulmuş olarak "selected_widgets" dizisine yazılacak. Alakasız bir widget'ı DİZİYE HİÇ EKLEME (boş/placeholder widget üretme).

WIDGET SEÇİM VE DOLDURMA PROTOKOLÜ:

1. "macro_tracker" (Kalori & Makro Sayacı) — HER ZAMAN seç, tam olarak 1 adet. data: target_calories (TDEE × Aktivite Çarpanı, Mifflin-St Jeor formülüyle hesapla; hedefe göre ayarla: kilo alma +%10-15, kilo verme -%20, koruma TDEE'ye eşit), protein_g (~1.8-2.2g/kg vücut ağırlığı), carb_g, fat_g, water_target_l (vücut ağırlığının litre cinsinden ~%3-4'ü).

2. "meal_plan_card" (Dinamik Öğün Kartları & Smart Swap) — HER ZAMAN seç, tam olarak 1 adet. data.meals: uyanış/uyku saatlerine göre zamanlanmış, günlük kalori/makro hedefini karşılayan öğün listesi (her öğün: id, time, name, calories, ingredients — gramajlı somut besin listesi, protein/carb/fat gramları). Her öğün için data.meals[].smart_swap alanına TAM OLARAK 2 adet, kullanıcının alerjilerine/bütçesine uygun ve makro değeri yakın denk alternatif besin (option + desc) ekle.

3. "liquid_calorie_shake" (Ektomorf / Kilo Alma Shake'i) — YALNIZCA hedef kilo alma/bulk ise VEYA kullanıcı iştahsız/hızlı metabolizmalı (ektomorf) bir profil belirtiyorsa seç; aksi halde bu widget'ı selected_widgets'a HİÇ EKLEME. data: shake_name, recipe_items (gramajlı somut malzeme listesi, ör. "Yulaf (100g)"), total_calories, prep_time_mins.

4. "workout_logger" (İnteraktif Antrenman Masası) — kullanıcının aktivite seviyesine/hedefine uygun her antrenman günü için AYRI bir widget nesnesi seç (ör. 4 günlük split ise selected_widgets içinde 4 ayrı "workout_logger" olur). data: workout_title (ör. "Push Day"), exercises (her egzersiz için name, sets, reps aralığı, rpe (1-10 tam sayı), rest_seconds, ve somut haftalık overload stratejisi — ör. "Haftalık +1.25kg"). CSCS standardında, gerçekçi ve sakatlanmayı önleyecek şekilde kurgula.

5. "system_rules" (Sabit Sistem Kuralları Modülü) — HER ZAMAN seç, tam olarak 1 adet. data.plateau_rule: 14 gün ilerleme olmazsa uygulanacak somut kalori ayarı (ör. "+150 kcal ekle"), NET tek cümle. data.timing_rule: antrenman öncesi/sonrası beslenme kuralı, NET tek cümle.

KATI KURALLAR (NO-TEXT-SLOP):
- "Yemeklerinizi mutfak terazisiyle tartın", "3 litre su için" gibi jenerik/genel geçer laflar HİÇBİR widget'ın data alanına yazılmaz — bu tip genel kurallar YALNIZCA system_rules widget'ına gider.
- Tüm sayısal alanlar (kcal, gram, set, tekrar, saniye) gerçekçi, birbiriyle TUTARLI (öğün kalorileri toplamı macro_tracker.target_calories ile uyumlu) ve kullanıcının somut verilerine dayalı olmalı — şablon/ortalama değer üretme.
- Yanıtın SADECE verilen JSON şemasına uygun olmalı — düz paragraf, markdown başlığı ya da şema dışı alan YOK. data nesnesinin yalnızca o widget_type'a ait alanlarını doldur, diğer widget türlerinin alanlarını boş/0 bırak.`;

const ACTIVITY_LABELS = {
  sedentary: "Sedanter (masa başı, hareketsiz)",
  light: "Hafif aktif (haftada 1-3 gün hafif egzersiz)",
  moderate: "Orta aktif (haftada 3-5 gün egzersiz)",
  active: "Aktif (haftada 6-7 gün egzersiz)",
  very_active: "Çok aktif (günde 2 antrenman / fiziksel iş)",
};

const GOAL_LABELS = {
  bulk: "Kilo alma / Clean Bulk (TDEE + %10-15 kalori fazlası)",
  cut: "Kilo verme / Deficit (TDEE - %20 kalori açığı)",
  maintain: "Kilo koruma / Maintenance (TDEE'ye eşit)",
};

// payload: { weight_kg, height_cm, body_fat_pct?, activity_level, goal,
//            wake_time?, sleep_time?, budget_level?, allergies? (string[]) }
// Dönüş: { selected_widgets: [{ widget_type, data }] } — NUTRITION_ARCHITECT_SCHEMA'ya (geminiRouter.js) uygun.
export async function generateNutritionArchitecture(payload = {}) {
  const { weight_kg, height_cm, body_fat_pct, activity_level, goal, wake_time, sleep_time, budget_level, allergies } = payload;

  if (!weight_kg || !height_cm || !goal) {
    throw new Error("Kilo, boy ve hedef alanları zorunlu.");
  }

  const userPrompt = `Aşağıdaki kullanıcı için ROUTINIX_CORE_ARCHITECT_v3 protokolüne birebir uygun, "selected_widgets" dizisini üret.

KULLANICI VERİLERİ:
- Kilo: ${weight_kg} kg
- Boy: ${height_cm} cm
- Yağ Oranı: ${body_fat_pct ? `%${body_fat_pct}` : "belirtilmedi (Mifflin-St Jeor formülünü cinsiyet varsayımı yapmadan, standart erkek/kadın ortalaması dengesinde makul şekilde uygula)"}
- Aktivite Seviyesi: ${ACTIVITY_LABELS[activity_level] || activity_level || "orta aktif"}
- Hedef: ${GOAL_LABELS[goal] || goal}
- Uyanış Saati: ${wake_time || "07:00"}
- Uyku Saati: ${sleep_time || "23:00"}
- Bütçe: ${budget_level || "orta"}
- Alerjiler / Kısıtlar: ${Array.isArray(allergies) && allergies.length ? allergies.join(", ") : "yok"}

Protokole göre HANGİ widget'ların bu kullanıcı için anlamlı olduğuna karar ver (macro_tracker, meal_plan_card ve system_rules HER ZAMAN dahil; liquid_calorie_shake yalnızca uygunsa; workout_logger her antrenman günü için ayrı bir widget nesnesi olarak), ve her birinin data alanını TAM doldur.`;

  return runJson("nutrition.architect", SYSTEM_INSTRUCTION, userPrompt, "Beslenme & Antrenman Mimarisi üretimi");
}
