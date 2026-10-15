import { useCallback, useEffect, useState } from "react";
import { KESEM_BASE } from "../config";

// Modül içi mini yönlendirici (Routinix'te react-router yok). Yollar gerçek
// URL'dir (/kesem/harcamalar/...), geri tuşu doğal çalışır, vercel.json zaten
// tüm yolları index.html'e yönlendiriyor → yenileyince/PWA'yı yeniden
// açınca aynı sayfa açılır.
const parse = () => {
  const p = window.location.pathname.replace(/\/+$/, "");
  const rest = p.startsWith(KESEM_BASE) ? p.slice(KESEM_BASE.length) : "";
  return rest.split("/").filter(Boolean).map(decodeURIComponent);
};

export function useKesemRoute() {
  const [segs, setSegs] = useState(parse);
  useEffect(() => {
    const on = () => setSegs(parse());
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const navigate = useCallback((path, { replace = false } = {}) => {
    const url = KESEM_BASE + (path ? "/" + path.replace(/^\/+/, "") : "");
    if (url === window.location.pathname) return;
    const depth = (window.history.state?.depth ?? 0) + (replace ? 0 : 1);
    window.history[replace ? "replaceState" : "pushState"]({ kesem: true, depth }, "", url);
    setSegs(parse());
  }, []);
  // Modül içinde bir adım geri; derin bağlantıyla doğrudan açıldıysa (geri
  // gidilecek modül sayfası yok) `fallback` sayfasına geçer.
  const goBack = useCallback(
    (fallback = "") => {
      if ((window.history.state?.depth ?? 0) > 0) window.history.back();
      else navigate(fallback, { replace: true });
    },
    [navigate]
  );
  return { segs, navigate, goBack };
}

export function useMediaQuery(query) {
  const [m, setM] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}
export const useIsTablet = () => useMediaQuery("(min-width: 768px)");
