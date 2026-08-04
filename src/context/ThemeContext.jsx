import { createContext, useContext, useEffect, useState } from "react";

// Routinix tema yönetimi: 'light' | 'dark'. localStorage'da kalıcılaşır; hiç
// tercih kaydedilmemişse tarayıcı/sistem tercihi (prefers-color-scheme)
// kontrol edilir. index.html'deki küçük anti-flash script bu mantığın
// aynısını sayfa boyanmadan ÖNCE senkron çalıştırır (bkz. index.html) — bu
// context, React tarafında aynı kaynağı okuyup state'i devralır ve sonraki
// değişiklikleri (toggle) hem <html> class/attribute'una hem localStorage'a yazar.
const ThemeContext = createContext(null);
const STORAGE_KEY = "routinix_theme";

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* localStorage erişilemez (gizli sekme/kota) — sistem tercihine düş */
  }
  if (typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

function applyThemeToDocument(theme) {
  const root = document.documentElement;
  // Tailwind'in dark: varyantı .dark class'ının varlığına bakar (bkz.
  // index.css @custom-variant); data-theme ise bizim CSS token'larımızı sürer.
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.setAttribute("data-theme", theme);

  // iOS Safari toolbar rengi (bkz. index.html <meta name="theme-color">) tema
  // ile birlikte güncellensin.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#030304" : "#f8fafc");
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* sessizce yut — tema yine de bu oturumda çalışmaya devam eder */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme, <ThemeProvider> içinde kullanılmalı.");
  return ctx;
}
