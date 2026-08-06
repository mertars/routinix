import { useState, useEffect } from "react";

// Paylaşılan "zayıf donanım / düşük güç" sezgisel tespiti — BackgroundScene.jsx'in
// ZATEN kanıtlanmış (canlıda ısınma sorununu çözdüğü doğrulanmış) sinyallerinin
// AYNISI, tek bir yeniden kullanılabilir hook'a çıkarıldı: dar viewport (<768px)
// VEYA sekme arka planda (document.hidden) VEYA prefers-reduced-motion.
//
// DÜRÜSTLÜK NOTU: tarayıcıda "bu bir zayıf CPU/GPU" diye GÜVENİLİR şekilde
// sorgulayabileceğin standart bir API YOK — navigator.hardwareConcurrency/
// deviceMemory ya desteklenmiyor (Safari/iOS deviceMemory'yi hiç
// UYGULAMAZ) ya da parmak izi koruması için tarayıcı tarafından
// kısıtlanıyor/rastgeleleştiriliyor. Bu yüzden burada "CPU tespiti" İDDİA
// EDİLMİYOR — viewport genişliği + sekme görünürlüğü, GERÇEKTEN ısınmaya yol
// açan senaryoyu (küçük ekranlı/mobil cihaz, arka planda çalışan sekme)
// doğrudan ve güvenilir şekilde yakalayan, BackgroundScene'de zaten kanıtlanmış
// bir vekil (proxy).
export default function usePerfMode() {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return { lowPower: false, reducedMotion: false };
    return {
      lowPower: window.matchMedia("(max-width: 767px)").matches || document.hidden,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });

  useEffect(() => {
    const widthMq = window.matchMedia("(max-width: 767px)");
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setState({
        lowPower: widthMq.matches || document.hidden,
        reducedMotion: motionMq.matches,
      });
    update();
    widthMq.addEventListener("change", update);
    motionMq.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      widthMq.removeEventListener("change", update);
      motionMq.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return state;
}
