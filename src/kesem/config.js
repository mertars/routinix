// Kesem (Harcama Takibi) — modül yapılandırması. Hamburger menüdeki ad BURADAN
// (ya da kullanıcı Daha Fazla > Ayarlar'dan) değiştirilebilir; kod başka
// hiçbir yerde "Kesem"/"Harcama Takibi" yazısını sabitlemez.
//
// Bu dosya BİLEREK küçük ve bağımlılıksız: DrawerMenu (ana pakette) menü adını
// buradan okur, ağır modül (KesemApp) ise yalnızca açılınca lazy yüklenir.
import { useSyncExternalStore } from "react";

export const KESEM_BASE = "/kesem";
export const KESEM_DEFAULT_MENU_LABEL = "Harcama Takibi";

const LABEL_KEY = "kesem_menu_label";
const LABEL_EVENT = "kesem:menulabel";

export function getMenuLabel() {
  try {
    const v = localStorage.getItem(LABEL_KEY);
    if (v && v.trim()) return v.trim().slice(0, 28);
  } catch {
    /* localStorage erişilemez — varsayılan ad */
  }
  return KESEM_DEFAULT_MENU_LABEL;
}

export function setMenuLabel(value) {
  const v = (value || "").trim().slice(0, 28);
  try {
    if (v && v !== KESEM_DEFAULT_MENU_LABEL) localStorage.setItem(LABEL_KEY, v);
    else localStorage.removeItem(LABEL_KEY);
  } catch {
    /* sessizce yut — ad bu oturumda yine de güncellenir */
  }
  window.dispatchEvent(new Event(LABEL_EVENT));
}

function subscribe(cb) {
  window.addEventListener(LABEL_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(LABEL_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useMenuLabel() {
  return useSyncExternalStore(subscribe, getMenuLabel, () => KESEM_DEFAULT_MENU_LABEL);
}

export function isKesemPath(pathname) {
  return pathname === KESEM_BASE || pathname.startsWith(KESEM_BASE + "/");
}
