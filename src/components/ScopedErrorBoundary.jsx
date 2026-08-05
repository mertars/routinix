import { Component } from "react";
import logger from "../utils/logger";

// main.jsx'teki tek, uygulama-geneli ErrorBoundary HER hatayı (herhangi bir
// bileşende) TÜM UYGULAMAYI "Sayfayı Yenile" ekranına düşürerek yakalıyordu
// — kullanıcının açık olan başka bir planı, AI Koç sohbeti, hamburger menü
// state'i de kaybediliyordu. Bu, DAR kapsamlı bir sınır: yalnızca sardığı
// alt ağacı izole eder; "Yeniden Dene" YALNIZCA o alanı sıfırlar, tam
// sayfa yenilemesi (ve geri kalan her şeyin kaybı) GEREKMEZ.
export default class ScopedErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("SCOPED_BOUNDARY", error?.message || "Yakalanmamış React hatası", {
      scope: this.props.scope || "unknown",
      error: { name: error?.name, message: error?.message, stack: error?.stack },
      componentStack: errorInfo?.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="w-full flex flex-col items-center justify-center gap-3 text-center py-16 px-6 animate-[fadeIn_0.3s_ease]">
        <p className="text-[15px] font-bold text-[var(--text-primary)]">Bir şeyler ters gitti.</p>
        <p className="text-[13px] leading-relaxed max-w-xs" style={{ color: "var(--text-muted)" }}>
          {this.props.message || "Beklenmedik bir hata oluştu. Tekrar dener misin?"}
        </p>
        <button
          onClick={this.handleRetry}
          className="rounded-xl px-5 py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-90 mt-1"
          style={{ background: "#B26BFF", color: "#030304" }}
        >
          Yeniden Dene
        </button>
      </div>
    );
  }
}
