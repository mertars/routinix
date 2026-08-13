import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { MusicProvider } from "./context/MusicContext.jsx";

// PWA "Ekrana Ekle" (beforeinstallprompt) için Chrome'un ZORUNLU tuttuğu
// kayıtlı service worker — bkz. public/sw.js dosya başı notu (içerik
// cache'lenmiyor, sadece yüklenebilirlik kriterini karşılıyor).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <MusicProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MusicProvider>
    </ThemeProvider>
  </StrictMode>
);
