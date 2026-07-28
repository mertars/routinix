// Hafif dokunsal geri bildirim (mikro titreşim). Prop-drilling olmadan her
// yerden çağrılabilsin diye modül seviyesinde bir "enabled" bayrağı tutar;
// DrawerMenu'deki "Ses & Dokunsal Geri Bildirim" toggle'ı bu bayrağı ayarlar.
// navigator.vibrate yalnızca destekleyen cihazlarda (çoğunlukla Android) çalışır;
// diğer platformlarda sessizce yok sayılır.
let enabled = true;

export function setHapticsEnabled(value) {
  enabled = !!value;
}

export function isHapticsEnabled() {
  return enabled;
}

// Kısa "tık" hissi (buton dokunuşları için).
export function tapFeedback(pattern = 8) {
  if (!enabled) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* yok say */
  }
}
