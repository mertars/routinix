import { createContext, useContext } from "react";

// Kabuk (KesemApp) → sayfalar arası paylaşılan eylemler.
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
