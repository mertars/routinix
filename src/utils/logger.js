// Merkezi, hafif logging/error-tracking katmanı. Uygulama genelinde çıplak
// console.log/error kullanımının yerini alır:
//   - development'ta renkli/etiketli ([INFO] [SCOPE]) konsol çıktısı verir.
//   - production'da yalnızca warn/error seviyesi konsola düşer (debug/info
//     gizlenir), ve bunlar sendToExternalService üzerinden Supabase'deki
//     `logs` tablosuna kalıcı olarak yazılır (bkz. src/services/logService.js).
import { insertLog } from "../services/logService";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// Aktif kullanıcı id'si — logger.js React'tan habersiz saf bir util olduğu
// için bu, App'in auth durumu değiştikçe setLogUser ile senkronladığı modül
// seviyesinde bir değişken. Kalıcılaşan loglara (logs.user_id) hangi
// kullanıcının oturumunda oluştuğunu ekler; misafirler için null kalır.
let currentUserId = null;
export function setLogUser(userId) {
  currentUserId = userId || null;
}

const isDev = typeof import.meta !== "undefined" && !!import.meta.env?.DEV;
// Production'da yalnızca warn (30) ve üzeri işlenir; debug/info sessizce yutulur.
const MIN_LEVEL = isDev ? LEVELS.debug : LEVELS.warn;

const LEVEL_STYLE = {
  debug: "color:#8695A3;font-weight:600",
  info: "color:#6E7BFF;font-weight:600",
  warn: "color:#F0B37E;font-weight:700",
  error: "color:#FF6E92;font-weight:700",
};
const SCOPE_STYLE = "color:#55636F;font-weight:500";
const RESET_STYLE = "color:inherit;font-weight:normal";

// --- Production / Harici Servis Bağlantısı --------------------------------
// warn/error seviyesindeki her log burada Supabase'deki `logs` tablosuna
// (src/services/logService.js -> insertLog) kalıcı olarak yazılır. İleride
// Sentry/LogRocket gibi üçüncü parti bir servise geçmek istersen, aşağıdaki
// örnek bloğu açıp/insertLog çağrısının yanına ekleyebilirsin — imza (logEntry
// şekli) zaten hazır.
function sendToExternalService(logEntry) {
  // Örnek Sentry entegrasyonu (ileride açılabilir):
  //
  // if (typeof window !== "undefined" && window.Sentry) {
  //   if (logEntry.level === "error") {
  //     window.Sentry.captureException(logEntry.data?.error ?? new Error(logEntry.message), { extra: logEntry });
  //   } else {
  //     window.Sentry.captureMessage(logEntry.message, { level: logEntry.level, extra: logEntry });
  //   }
  // }

  // insertLog kendi içinde hataları yutar (console.error ile) — burada tekrar
  // logger çağırmak sonsuz döngüye yol açar, bilerek yapılmıyor.
  insertLog({ ...logEntry, userId: currentUserId }).catch(() => {});
}

function emit(level, scope, message, data) {
  if (LEVELS[level] < MIN_LEVEL) return null;

  const entry = {
    level,
    scope: scope || "APP",
    message: String(message ?? ""),
    data: data !== undefined ? data : null,
    timestamp: new Date().toISOString(),
  };

  // eslint-disable-next-line no-console
  const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.log;

  if (isDev) {
    consoleFn(
      `%c[${level.toUpperCase()}]%c [${entry.scope}]%c ${entry.message}`,
      LEVEL_STYLE[level],
      SCOPE_STYLE,
      RESET_STYLE,
      entry.data ?? ""
    );
  } else if (level === "warn" || level === "error") {
    // Production'da sade (stilsiz) ama yine de görünür kalsın.
    consoleFn(`[${level.toUpperCase()}] [${entry.scope}]`, entry.message, entry.data ?? "");
  }

  if (level === "warn" || level === "error") sendToExternalService(entry);

  return entry;
}

const logger = {
  debug: (scope, message, data) => emit("debug", scope, message, data),
  info: (scope, message, data) => emit("info", scope, message, data),
  warn: (scope, message, data) => emit("warn", scope, message, data),
  error: (scope, message, data) => emit("error", scope, message, data),
};

export default logger;
