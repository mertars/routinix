import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Merkezi model routing — hangi operasyonun hangi Gemini modeliyle ve hangi
// maxOutputTokens tavanıyla çalışacağını TEK yerden belirler. Önceden
// planPrompt.js/coachPrompt.js/rhythmPrompt.js'in HER BİRİ kendi getModel()'ini
// ayrı ayrı tanımlıyordu (üçü de birebir aynı, model adı hardcoded) — model
// değiştirmek/ayarlamak için 3 dosyayı ayrı ayrı düzenlemek gerekiyordu.
//
// MODEL SEÇİMİ GEREKÇESİ (gerçek A/B ölçümüyle doğrulandı — bkz. proje
// sohbet geçmişi/commit mesajı): gemini-flash-lite-latest, gemini-flash-latest
// ile AYNI yapısal JSON doğruluğunu koruyarak:
//   - Karmaşık görevde (plan oluşturma): 3910 -> 2243 toplam token (%43 düşüş)
//   - Basit görevde (niyet sınıflandırma): 454 -> 155 toplam token (%66 düşüş)
// Fark BÜYÜK ÖLÇÜDE "thinking" (gizli akıl yürütme) token'larından geliyor —
// flash-lite bu modelde HİÇ extended-thinking yapmıyor (thoughtsTokenCount
// alanı tamamen yok), flash ise her çağrıda 250-2700 arası gizli token
// harcıyor. thinkingBudget=0 ile flash'ta bunu kapatmayı denedik, model
// REDDETTİ (400 Bad Request) — flash-lite'a geçmek bu maliyeti kapatmanın
// TEK güvenilir yolu.
//
// EN YÜKSEK RİSKLİ ROTA: "plan.create" (ilk plan üretimi, kullanıcının İLK
// izlenimi + en yüksek birim maliyet). Gerçek testte flash-lite çıktısı
// yapısal olarak SAĞLAM ve içerik olarak zengin geldi, ama bu tek bir
// örnek — üretime almadan önce bir süre gerçek kullanıcı çıktılarını
// gözden geçirmen (ya da bir feature flag ile kademeli açman) önerilir.
// Kaliteden şüphelenirsen TEK satır (aşağıdaki ROUTES["plan.create"].model)
// değiştirerek anında flash'a geri dönebilirsin.
const FLASH = "gemini-flash-latest";
const FLASH_LITE = "gemini-flash-lite-latest";

// maxOutputTokens değerleri gerçek ölçülen çıktı boyutlarının ÜZERİNE
// güvenli bir pay (~2-3x) eklenerek belirlendi — amaç günlük kullanımı
// kısıtlamak değil, model bir sebeple (hata/döngü/aşırı ayrıntı) normalin
// çok üzerinde üretmeye kalkarsa faturanın kontrolsüz büyümesini önlemek.
// ÖNCEDEN HİÇBİR ÇAĞRIDA maxOutputTokens YOKTU — varsayılan tavan bu
// modellerde 65536 (gemini-flash-latest) / 65536 (flash-lite) idi, yani
// pratikte SINIRSIZDI.

// api/parse-file.js'in çıktı şeması — kullanıcının içeriği "title" + "days"
// (her biri dayNumber/title/tasks taşıyan) dizisine indirgenir. priority
// enum'u BİLEREK İngilizce (high/medium/low) — istemci tarafı (ManualPlanBuilder)
// bunu kendi Türkçe rozet karşılığına (Yüksek/Orta/Düşük) çevirir.
const FILE_PARSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    days: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          dayNumber: { type: SchemaType.INTEGER },
          title: { type: SchemaType.STRING },
          tasks: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                priority: { type: SchemaType.STRING, format: "enum", enum: ["high", "medium", "low"] },
              },
              required: ["title"],
            },
          },
        },
        required: ["dayNumber", "tasks"],
      },
    },
  },
  required: ["title", "days"],
};

const ROUTES = {
  // AI Koç serbest metin — hem basit sınıflandırma hem karmaşık mutasyon
  // (plan küçültme/görev silme) AYNI çağrıda kararlaştırılıyor, bu yüzden
  // mesaj türüne göre ÖNCEDEN ikiye ayrılamıyor (bkz. coachPrompt.js).
  // Gerçek testte flash-lite HER İKİ karmaşıklık seviyesinde de sağlam.
  "coach.intent": { model: FLASH_LITE, maxOutputTokens: 3072 },

  // Günlük Ritim Raporu — küçük, sabit şemalı (summary + <=3 madde) çıktı.
  "rhythm.report": { model: FLASH_LITE, maxOutputTokens: 512 },

  // Onboarding anketi — 4-6 soru, küçük şema.
  "plan.onboarding_questions": { model: FLASH_LITE, maxOutputTokens: 1024 },

  // İlk plan üretimi — bkz. yukarıdaki risk notu.
  "plan.create": { model: FLASH_LITE, maxOutputTokens: 8192 },

  // Sonraki hafta (haftalık program revizesi) — tek haftalık (7 gün) çıktı,
  // plan.create'in first_week_tasks'ıyla aynı büyüklük mertebesinde.
  "plan.next_week": { model: FLASH_LITE, maxOutputTokens: 4096 },

  // Evrensel dosya içe aktarma (api/parse-file.js) — kullanıcının yüklediği
  // JSON/Markdown/TXT/CSV/PDF-metni/ICS'i sabit bir plan şemasına çevirir.
  // responseSchema ile Structured Output ZORUNLU kılınır (bkz. FILE_PARSE_SCHEMA
  // altında) — model şemanın DIŞINA çıkamaz, çıktı JSON.parse'ı asla tip
  // hatasıyla başarısız olmaz. maxOutputTokens plan.create ile aynı mertebede
  // (kaynak dosya çok günlü/kalabalık bir plan içerebilir).
  "file.parse": { model: FLASH_LITE, maxOutputTokens: 8192, responseSchema: FILE_PARSE_SCHEMA },
};

let cachedClient = null;
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ortam değişkeni tanımlı değil (sunucu).");
  // Sıcak (warm) fonksiyon örnekleri arasında istemciyi yeniden kullan —
  // her çağrıda yeniden oluşturmak gereksiz bir maliyet DEĞİL (SDK istemcisi
  // ağ isteği yapmaz) ama gereksiz nesne çöpü de üretmemek için tek satır.
  if (!cachedClient) cachedClient = new GoogleGenerativeAI(apiKey);
  return cachedClient;
}

// operation: yukarıdaki ROUTES anahtarlarından biri. responseSchema route'ta
// TANIMLIYSA (bkz. "file.parse") generationConfig'e eklenir — Gemini'nin
// Structured Output modu, yalnızca responseMimeType değil AYRICA katı bir
// şemayla ZORUNLU kılınmış olur.
export function getRoutedModel(operation, systemInstruction) {
  const route = ROUTES[operation];
  if (!route) throw new Error(`Bilinmeyen model route: "${operation}"`);
  const generationConfig = { responseMimeType: "application/json", maxOutputTokens: route.maxOutputTokens };
  if (route.responseSchema) generationConfig.responseSchema = route.responseSchema;
  return getClient().getGenerativeModel({
    model: route.model,
    systemInstruction,
    generationConfig,
  });
}
