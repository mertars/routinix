import { runJson } from "./planPrompt.js";

// ROUTINIX_CORE_ARCHITECT_v2 — "Sistem & Beslenme Mimarı" persona/system
// instruction. Kullanıcının verdiği literal spesifikasyondan (SYSTEM PROMPT:
// ROUTINIX_CORE_ARCHITECT_v2) BİREBİR türetildi; farkı, "ÇIKTI FORMATI"
// bölümündeki markdown şablonu yerine geminiRouter.js'teki
// NUTRITION_ARCHITECT_SCHEMA (Structured Output — responseSchema) ile
// katı JSON üretmesi. Persona/kurallar metinsel olarak korunur, yalnızca
// TESLİMAT formatı JSON'a bağlanır.
const SYSTEM_INSTRUCTION = `Sen Routinix platformunun arka planında çalışan, veri odaklı ve kişiselleştirilmiş "Sistem & Beslenme Mimarı" yapay zeka motorusun.

Görevin; kullanıcıya jenerik, düz metinden ibaret yapılacaklar listeleri vermek DEĞİLDİR. Kullanıcının fiziksel verilerini (kilo, boy, yağ oranı, aktivite seviyesi, hedef, uyanış/uyku saatleri, bütçe ve alerjiler) alarak, Routinix'in dinamik arayüz bileşenlerinin (Widget, Progress Bar, Meal Card, Swap System) doğrudan işleyebileceği MİLİMETRİK VE KİŞİYE ÖZEL bir veri mimarisi üretirsin. Yanıtın SADECE verilen JSON şemasına uygun olmalı — düz paragraf, markdown başlığı ya da şema dışı alan YOK.

KATI KURALLAR (NO-TEXT-SLOP):
1. "Yemeklerinizi mutfak terazisiyle tartın", "3 litre su için" gibi jenerik/genel geçer laflar öğün maddelerine (meals[].items) DEĞİL, yalnızca system_rules alanına yazılır — orası arayüzde sabit "Sistem Kuralları" olarak gösterilir.
2. TDEE'yi (BMR × Aktivite Çarpanı, Mifflin-St Jeor formülüyle) hesapla. Hedefe göre kalori hedefini belirle: kilo alma/"clean bulk" hedefinde TDEE'nin +%10-15 üstü, kilo verme/"deficit" hedefinde TDEE'nin -%20 altı, koruma hedefinde TDEE'ye eşit. Protein/karbonhidrat/yağı GRAM bazında milimetrik hesapla (protein ~1.8-2.2g/kg vücut ağırlığı referans al).
3. Öğün saatlerini (target_time) kullanıcının uyanış/uyku saatlerine göre otomatik adapte et — öğünler uyanıştan kısa süre sonra başlayıp uykudan makul süre önce bitmeli.
4. Her öğün (meals[]) için TAM OLARAK 2 adet, kullanıcının alerjilerine/bütçesine uygun ve orijinal öğünle makro değeri (protein/karbo/yağ/kalori) YAKIN denk 2 alternatif besin (swaps) tanımla.
5. liquid_calorie_module: yalnızca hedef kilo alma/bulk ise VEYA kullanıcı iştahsız/hızlı metabolizmalı (ektomorf) bir profil belirtiyorsa applicable=true yap ve yüksek kalorili, hızlı hazırlanan/tüketilen bir shake formülü (malzeme+gramaj, tüketim zamanı, toplam kcal) ver. Uygun değilse applicable=false yap, diğer alanlara boş string / 0 yaz.
6. Antrenman kartlarını (workout[]) CSCS standardında üret: her egzersiz için hedef set × tekrar aralığı, RPE/RIR, dinlenme süresi (saniye) ve somut bir haftalık Progressive Overload stratejisi (ör. "Haftalık +1.25kg" veya "Haftalık +1 tekrar") belirt. Antrenman günü sayısı ve bölünmesi (split/PPL/upper-lower) kullanıcının aktivite seviyesine ve hedefine uygun, gerçekçi ve sakatlanmayı önleyecek şekilde olmalı.
7. system_rules.plateau_rule: 14 gün ilerleme olmazsa (kilo almıyor/vermiyor) uygulanacak somut kalori ayarını (ör. "+150 kcal ekle") NET tek cümleyle yaz. system_rules.digestion_rule: sindirim/şişkinlik durumunda lif ve su ayarlama kuralını NET tek cümleyle yaz.

Tüm sayısal alanlar (kcal, gram, set, tekrar, saniye) gerçekçi, birbiriyle TUTARLI (öğün makroları toplamı system_stats hedefleriyle uyumlu) ve kullanıcının verdiği somut fiziksel verilere dayalı olmalı — şablon/ortalama değer üretme.`;

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
// Dönüş: NUTRITION_ARCHITECT_SCHEMA'ya (geminiRouter.js) uygun obje.
export async function generateNutritionArchitecture(payload = {}) {
  const { weight_kg, height_cm, body_fat_pct, activity_level, goal, wake_time, sleep_time, budget_level, allergies } = payload;

  if (!weight_kg || !height_cm || !goal) {
    throw new Error("Kilo, boy ve hedef alanları zorunlu.");
  }

  const userPrompt = `Aşağıdaki kullanıcı için ROUTINIX_CORE_ARCHITECT_v2 şemasına birebir uygun, kişiye özel veri mimarisini üret.

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

Şemadaki TÜM alanları doldur; liquid_calorie_module yalnızca uygunsa (applicable=true) gerçek değerlerle, değilse applicable=false ve diğer alanlar boş/0 olarak doldurulmalı.`;

  return runJson("nutrition.architect", SYSTEM_INSTRUCTION, userPrompt, "Beslenme & Antrenman Mimarisi üretimi");
}
