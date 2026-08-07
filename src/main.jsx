import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { MusicProvider } from "./context/MusicContext.jsx";

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
