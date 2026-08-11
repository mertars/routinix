import { useState } from "react";
import { X } from "lucide-react";
import { useMusic, SPOTIFY_PRESET_PLAYLISTS } from "../context/MusicContext";

const SPOTIFY_PLAYLIST_URL_RE = /playlist\/([a-zA-Z0-9]+)/;
const SPOTIFY_TINT = "#1DB954";

const CONTROL_CLASS =
  "rounded-xl px-2.5 py-2 text-[12px] font-semibold bg-white/[0.04] border border-white/10 text-white/80 placeholder:text-white/25 focus:outline-none focus:border-cyan-400/50";

// Routinix'in sağdan kayan, ışıltılı kenarlıklı GLOBAL müzik paneli — App
// kökünde (bkz. app.jsx) TEK SEFER, KOŞULSUZ monte edilir; kapanınca
// unmount OLMAZ, yalnızca CSS ile görünmezleşir (bkz. dosya altındaki
// açık/kapalı sınıfları). Bu yüzden:
//   - Müzik panel kapansa/açılsa da KESİNTİYE UĞRAMAZ (asıl iframe/
//     controller zaten burada değil, useMusic()'in kendi spotifyMountRef'inde
//     — bu bileşen SADECE onun etrafına konumlanmış bir "vitrin").
//   - ARKA PLAN KARARTMASI YOK (backdrop/overlay div'i BİLEREK YOK) — panel
//     yalnızca kendi kartı, arkasındaki ekran (zamanlayıcı/görevler/butonlar)
//     panel açıkken de TAMAMEN tıklanabilir kalır.
//   - z-index BİLEREK z-[95] (İSTENEN "z-40" değil) — Focus Studio'nun
//     kendi tam ekran katmanı z-[90] (bkz. PomodoroStudio.jsx); z-40 ile bu
//     panel Focus Studio açıkken GÖRÜNMEZ/tıklanmaz kalırdı, ki tetikleyici
//     Spotify butonu TAM DA orada.
//
// PİL/ISINMA NOTU: bu bileşen ASLA unmount olmadığı için (yukarıdaki not),
// dönen kenarlık animasyonu ve ağır `backdrop-blur-2xl` panel KAPALIYKEN de
// GPU'da çalışmaya devam ediyordu — canlı testte doğrulanan gerçek bir arka
// plan pil tüketimi kaynağı. İkisi de artık `m.panelOpen`'a KOŞULLU: panel
// görünmezken (opacity-0/pointer-events-none) animasyon durur ve blur
// kaldırılır, `will-change` yalnızca animasyon AKTİFKEN tarayıcıya
// GPU-katman ipucu verir.
export default function GlobalMusicPlayer() {
  const m = useMusic();
  const tint = SPOTIFY_TINT;

  return (
    // MOBİL FORMAT: masaüstündeki gibi TAM DİKEY kart — `left-0 right-0
    // w-[92%] max-w-md mx-auto` ile ORTALANMIŞ, sabit genişlikte bir modal
    // (eskiden `left-4 right-4` kenar boşluklu/gerilmiş bir şeritti). Kenar
    // boşluğu (left/right) DEĞİL genişlik (w-[92%]) + otomatik yatay margin
    // (mx-auto) merkezliyor. Masaüstü (md:) davranışı BİREBİR korunuyor
    // (right-6/bottom-8/w-420px, sağdan kayan panel).
    <div
      className={`fixed left-0 right-0 top-20 z-[95] w-[92%] max-w-md mx-auto md:left-auto md:right-6 md:w-[420px] md:max-w-[calc(100vw-3rem)] md:mx-0 md:bottom-8 transition-all duration-300 ease-out ${
        m.panelOpen ? "translate-x-0 opacity-100 pointer-events-auto" : "translate-x-10 opacity-0 pointer-events-none"
      }`}
      aria-hidden={!m.panelOpen}
    >
      {/* Dış kutu — dönen conic-gradient ışıklı kenarlık. İç kutu (p-[2px]
          boşluk BIRAKARAK) üstüne oturuyor, geriye yalnızca 2px'lik dönen
          bir "ışık halkası" görünür kalıyor. */}
      <div className="relative w-full rounded-[30px] p-[2px] overflow-hidden md:h-full" style={{ boxShadow: `0 24px 70px -20px ${tint}55` }}>
        <div
          className={`absolute ${m.panelOpen ? "motion-safe:animate-[spin_4s_linear_infinite]" : ""}`}
          style={{
            top: "-100%",
            left: "-100%",
            width: "300%",
            height: "300%",
            background: "conic-gradient(from 0deg, #06b6d4, #3b82f6, #00f2fe, #06b6d4)",
            willChange: m.panelOpen ? "transform" : "auto",
          }}
        />
        <div
          className={`relative w-full rounded-[28px] bg-slate-950/90 p-4 md:h-full md:p-6 flex flex-col overflow-hidden ${m.panelOpen ? "backdrop-blur-2xl" : ""}`}
        >
          {/* Üst başlık: kapat */}
          <div className="shrink-0 flex items-center justify-between gap-2 mb-3 md:mb-4">
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold" style={{ background: `${tint}26`, color: tint }}>
              🎵 Spotify
            </span>
            <button
              onClick={m.closePanel}
              aria-label="Kapat"
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <SpotifyControls />

          {/* Oynatıcı alanı — mount noktası HER ZAMAN DOM'da (bkz.
              MusicContext.jsx). display:none KULLANILMAZ — bazı tarayıcılar
              display:none'lı bir iframe'i Page Visibility API üzerinden
              "hidden" sayıp arkadaki oynatmayı durdurabilir.
              YÜKSEKLİK NOTU: burası bir ÇALMA LİSTESİ embed'i (spotify:
              playlist:..., bkz. MusicContext.jsx, width:"100%" height:"100%"
              + theme:"0" ile oluşturuluyor) — Spotify'ın tek şarkı/bölüm
              için kullandığı ultra-kompakt "bar" formatı bir PLAYLIST için
              yetersiz kalıp içeriği (kapak+başlık+şarkı listesi) kırpıyordu.
              Spotify'ın resmi playlist embed'i 380px'te (masaüstündeki AYNI
              kart formatı) kapak+başlık+kontroller+şarkı listesini kenarlardan
              kırpılmadan TAM gösterir — mobilde artık bu yükseklik kullanılıyor.
              Masaüstünde (md:) eski flex-1 davranışı aynen korunuyor. */}
          <div
            className="relative w-full max-w-full h-[380px] shrink-0 md:flex-1 md:h-auto md:min-h-0 rounded-xl overflow-hidden border"
            style={{ borderColor: `${tint}33` }}
          >
            <div ref={m.spotifyMountRef} className="absolute inset-0" />
          </div>

          <p className="hidden md:block mt-3 shrink-0 text-[11px] leading-relaxed text-white/35">
            Spotify'ın kendi oynatıcısı — kontrolü doğrudan burada ya da üst bardaki mini widget'tan yap.
          </p>
        </div>
      </div>
    </div>
  );
}

function SpotifyControls() {
  const m = useMusic();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [customUrlError, setCustomUrlError] = useState(null);

  const isKnownPlaylist =
    SPOTIFY_PRESET_PLAYLISTS.some((p) => p.id === m.spotifyPlaylistId) || m.spotifyUserPlaylists.some((p) => p.id === m.spotifyPlaylistId);

  const handleLoadCustomUrl = () => {
    const match = SPOTIFY_PLAYLIST_URL_RE.exec(customUrlInput.trim());
    if (!match) {
      setCustomUrlError("Geçerli bir Spotify çalma listesi linki değil.");
      return;
    }
    m.setSpotifyPlaylistId(match[1]);
    setCustomUrlError(null);
    setCustomUrlInput("");
    setShowCustomInput(false);
  };

  return (
    // Hesap bağlama (OAuth "Spotify Hesabını Bağla") satırı BİLEREK KALDIRILDI:
    // bu, harici bir Spotify yönlendirmesiydi ve butona basar basmaz doğrudan
    // oynatıcının açılması gereken bir akışta gereksiz bir ara adımdı. Çalma
    // (aşağıdaki embed) zaten hesap bağlamadan da çalışıyor — connectSpotify/
    // spotifyProfile context'te (MusicContext.jsx) DOKUNULMADAN duruyor,
    // yalnızca bu panelin UI'ından çıkarıldı.
    <div className="shrink-0 flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-1.5">
        <select
          value={isKnownPlaylist ? m.spotifyPlaylistId : "custom"}
          onChange={(e) => m.setSpotifyPlaylistId(e.target.value)}
          aria-label="Çalma listesi seç"
          className={`flex-1 min-w-0 ${CONTROL_CLASS}`}
        >
          {!isKnownPlaylist && (
            <option value="custom" disabled>
              Özel Liste
            </option>
          )}
          <optgroup label="Hazır Odak Listeleri">
            {SPOTIFY_PRESET_PLAYLISTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
          {m.spotifyUserPlaylists.length > 0 && (
            <optgroup label="Kütüphanem">
              {m.spotifyUserPlaylists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          onClick={() => {
            setShowCustomInput((v) => !v);
            setCustomUrlError(null);
          }}
          className={`shrink-0 whitespace-nowrap transition-colors hover:bg-white/[0.08] ${CONTROL_CLASS}`}
        >
          {showCustomInput ? "Vazgeç" : "+ Kendi Linkini Ekle"}
        </button>
      </div>

      {showCustomInput && (
        <div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customUrlInput}
              onChange={(e) => {
                setCustomUrlInput(e.target.value);
                setCustomUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLoadCustomUrl();
              }}
              placeholder="https://open.spotify.com/playlist/..."
              className={`flex-1 min-w-0 ${CONTROL_CLASS}`}
            />
            <button
              onClick={handleLoadCustomUrl}
              className="shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-bold transition-colors bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
            >
              Yükle
            </button>
          </div>
          {customUrlError && <p className="mt-1.5 text-[11px] text-rose-400">{customUrlError}</p>}
        </div>
      )}
    </div>
  );
}
