// Gemini SDK hatasını KULLANICIYA gösterilebilir, güvenli bir mesaja çevirir
// — ham err.message İSTEMCİYE HİÇ yansıtılmaz (bkz. generate-plan.js'teki
// aynı güvenlik ilkesi: SDK hata metni teorik olarak iç yapı/istek detayı
// taşıyabilir). Yalnızca BURADA sınıflandırılıp sabit, önceden yazılmış
// Türkçe mesajlardan biri seçilir; tam ham hata (status + message + stack)
// YALNIZCA sunucu logunda kalır (console.error/logger, çağıran dosyada).
//
// planPrompt.js/coachPrompt.js/rhythmPrompt.js'in kendi try/catch'leri
// err.status'u KORUYARAK yeniden fırlatır (bkz. o dosyalardaki wrapGeminiError)
// — bu fonksiyon o status'a bakarak doğru mesajı/HTTP kodunu seçer.
export function classifyGeminiError(err) {
  const status = err?.status || err?.response?.status;

  // 429 — Gemini tarafında kota/bütçe/prepayment tükenmiş (ör. "Your
  // prepayment credits are depleted"). Bizim KENDİ freemium kotamızdan
  // (quota.js/planRateLimit.js) TAMAMEN FARKLI bir durum — kullanıcının
  // hakkı değil, Google tarafındaki proje bütçesi/kota sorunu.
  if (status === 429) {
    return { httpStatus: 503, message: "Yapay zeka servisi şu anda kota/bütçe sınırına ulaştı. Lütfen daha sonra tekrar dene." };
  }
  // 401/403 — API anahtarı geçersiz/iptal edilmiş/yanlış proje.
  if (status === 401 || status === 403) {
    return { httpStatus: 503, message: "Yapay zeka servisine bağlanılamadı. Lütfen daha sonra tekrar dene." };
  }
  // 5xx — Gemini tarafında geçici bir sorun.
  if (status >= 500) {
    return { httpStatus: 503, message: "Yapay zeka servisi şu anda yanıt vermiyor. Lütfen birkaç dakika sonra tekrar dene." };
  }
  // Bilinmeyen/status'suz hata (ör. JSON parse hatası, ağ hatası) — genel.
  return { httpStatus: 500, message: "Beklenmedik bir hata oluştu. Lütfen tekrar dene." };
}

// planPrompt.js/coachPrompt.js/rhythmPrompt.js'teki Gemini çağrısı
// try/catch'lerinde kullanılır — orijinal err.status'u KORUYARAK, güvenli/
// sabit bir üst mesajla yeniden fırlatır.
export function wrapGeminiError(err, fallbackMessage) {
  const wrapped = new Error(err?.message || fallbackMessage);
  wrapped.status = err?.status;
  return wrapped;
}
