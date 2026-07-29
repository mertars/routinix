// AI Koç için günlük ücretsiz hak yönetimi (3 aksiyon/gün). Sunucu tarafı
// olmadığı için localStorage tabanlı, tarih + kullanıcı anahtarlı basit bir
// sayaç — gün değişince otomatik sıfırlanır (anahtarın kendisi güne göre değişir).
export const AI_COACH_DAILY_LIMIT = 3;

function todayKey(userId) {
  const day = new Date().toISOString().slice(0, 10);
  return `ai_coach_usage_${userId || "guest"}_${day}`;
}

export function getRemainingUses(userId) {
  try {
    const used = Number(localStorage.getItem(todayKey(userId))) || 0;
    return Math.max(0, AI_COACH_DAILY_LIMIT - used);
  } catch {
    // localStorage erişilemezse (gizli sekme/quota) kısıtlamayı kilitlemeyelim.
    return AI_COACH_DAILY_LIMIT;
  }
}

export function consumeUse(userId) {
  try {
    const key = todayKey(userId);
    const used = Number(localStorage.getItem(key)) || 0;
    localStorage.setItem(key, String(used + 1));
    return Math.max(0, AI_COACH_DAILY_LIMIT - (used + 1));
  } catch {
    return AI_COACH_DAILY_LIMIT;
  }
}
