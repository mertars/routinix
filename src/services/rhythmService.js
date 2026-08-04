import { supabase } from "../lib/supabaseClient";
import logger from "../utils/logger";

// "Rhythm & Insights" modülünün client-side katmanı. İki tür veri yolu var:
//
//   1) AI/mutasyon gerektiren aksiyonlar ("generate" rapor üretimi, "endDay"
//      erteleme) — service_role ile /api/rhythm-report üzerinden (bkz.
//      api/rhythm-report.js). Desen coachActionService.js ile BİREBİR aynı.
//
//   2) Salt-okunur geçmiş + odak seansı KAYDI — doğrudan authenticated
//      Supabase client'ı (RLS "kendi satırın" politikasıyla korunur, bkz.
//      supabase/migration.sql 7-8 numaralı bölümler). logService.js'nin
//      logs tablosuna doğrudan insert deseniyle aynı.

// Sunucu fonksiyonundan (Vercel) daha erken, KONTROLLÜ bir zaman aşımı —
// coachActionService.js/aiPipelineService.js ile AYNI gerekçe.
const REQUEST_TIMEOUT_MS = 25_000;

// action: "generate" | "endDay"
export async function callRhythmAction({ action, lapsedRoutineTitles }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { ok: false, message: "Devam etmek için giriş yapmalısın." };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch("/api/rhythm-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, lapsedRoutineTitles }),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    logger.error("RHYTHM", timedOut ? "İstek zaman aşımına uğradı" : "Sunucuya ulaşılamadı", { action, error: err?.message });
    return {
      ok: false,
      message: timedOut ? "Yapay zeka yanıt vermekte gecikti, lütfen tekrar dener misin?" : "Sunucuya ulaşılamadı — bağlantını kontrol edip tekrar dener misin?",
    };
  } finally {
    clearTimeout(timeoutId);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    logger.warn("RHYTHM", "rhythm-report isteği başarısız", { action, status: res.status, message: body?.message });
  }

  // Sunucu artık HER durumda geçerli JSON döner (bkz. api/_lib/aiErrors.js);
  // `body` yalnızca gerçekten anormal bir durumda null olur.
  return body || { ok: false, message: "Sistem şu an hizmet veremiyor, lütfen birazdan tekrar dener misin?" };
}

// Tamamlanmış (yarıda bırakılmamış) bir Pomodoro odak aralığını kaydeder —
// kendi kendine yeterli, fire-and-forget (çağıran yer .catch ile ele alır,
// bir odak seansının kaydedilememesi kullanıcının akışını KESMEMELİ).
export async function logFocusSession({ userId, taskId, planId, startedAt, endedAt, durationMin }) {
  const { error } = await supabase.from("focus_sessions").insert({
    user_id: userId,
    task_id: taskId ?? null,
    plan_id: planId ?? null,
    started_at: startedAt,
    ended_at: endedAt,
    duration_min: durationMin,
  });
  if (error) {
    logger.error("RHYTHM", "Odak seansı kaydedilemedi", { userId, taskId, planId, durationMin, error: error?.message });
    throw error;
  }
}

// Geçmiş günlük raporları (tarih şeridi + arşiv görünümü için) — en yeni önce.
export async function fetchReportHistory(userId, { limit = 60 } = {}) {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("user_id", userId)
    .order("report_date", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error("RHYTHM", "Rapor geçmişi getirilemedi", { userId, error: error?.message });
    throw error;
  }
  return data || [];
}

// Analitik grafikler için ham odak seansları — belirli bir tarih aralığında
// (haftalık/aylık/yıllık filtre). `fromISO`/`toISO`: ISO 8601 zaman damgası.
export async function fetchFocusSessions(userId, { fromISO, toISO } = {}) {
  let query = supabase.from("focus_sessions").select("*").eq("user_id", userId).order("started_at", { ascending: true });
  if (fromISO) query = query.gte("started_at", fromISO);
  if (toISO) query = query.lte("started_at", toISO);
  const { data, error } = await query;
  if (error) {
    logger.error("RHYTHM", "Odak seansları getirilemedi", { userId, error: error?.message });
    throw error;
  }
  return data || [];
}
