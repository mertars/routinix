import { useState, useEffect, useCallback } from "react";

// PWA "Ana Ekrana Ekle" tetikleyicisi. Tarayıcı `beforeinstallprompt`
// event'ini SADECE uygulama zaten yüklü DEĞİLSE ve bir web app manifest +
// service worker (installability) kriterlerini karşılıyorsa ateşler — bu
// yüzden event'i yakalayıp SAKLAMAK (deferredPrompt) gerekiyor: `prompt()`
// yalnızca bu orijinal event nesnesi üzerinden, kullanıcı bir tıklamasıyla
// senkron bir jest içinde çağrılabilir, sonradan yeniden üretilemez.
export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  });

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Event tek kullanımlık — kabul edilse de reddedilse de tekrar
    // kullanılamaz, bir sonraki `beforeinstallprompt`'a kadar butonu gizle.
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return { canInstall: !installed && !!deferredPrompt, promptInstall };
}
