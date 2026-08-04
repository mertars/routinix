import { Component } from "react";
import logger from "../utils/logger";

// Uygulamadaki tüm yakalanmamış React hatalarını yakalar ve logger.error ile
// structured (JSON) olarak kaydeder — hatanın oluştuğu bileşen zincirini
// (component stack) da içerir. Kullanıcıya OLED tema ile tutarlı, sade bir
// kurtarma ekranı gösterir.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("REACT_BOUNDARY", error?.message || "Yakalanmamış React hatası", {
      error: { name: error?.name, message: error?.message, stack: error?.stack },
      componentStack: errorInfo?.componentStack,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen w-full flex items-center justify-center px-6 text-center" style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
        <div className="max-w-sm">
          <p className="text-[17px] font-bold mb-2">Bir şeyler ters gitti.</p>
          <p className="text-[13px] leading-relaxed mb-5" style={{ color: "var(--text-muted)" }}>
            Beklenmedik bir hata oluştu. Sayfayı yenilemeyi dene; sorun devam ederse bize bildir.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl px-5 py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: "#B26BFF", color: "#030304" }}
          >
            Sayfayı Yenile
          </button>
        </div>
      </div>
    );
  }
}
