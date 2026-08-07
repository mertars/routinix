import { useState } from "react";
import { X, Music2, ListMusic, LogIn, LogOut, RefreshCw, CircleUserRound } from "lucide-react";
import { useMusic, SPOTIFY_PRESET_PLAYLISTS, YOUTUBE_PRESET_VIDEOS } from "../context/MusicContext";

const SPOTIFY_PLAYLIST_URL_RE = /playlist\/([a-zA-Z0-9]+)/;
// youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, youtube.com/shorts/ID
const YOUTUBE_VIDEO_URL_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

const MUSIC_TABS = [
  { key: "spotify", label: "Spotify", tint: "#1DB954", icon: Music2 },
  { key: "youtube", label: "YouTube", tint: "#FF3B5C", icon: ListMusic },
];

const CONTROL_CLASS =
  "rounded-xl px-2.5 py-2 text-[12px] font-semibold bg-white/[0.04] border border-white/10 text-white/80 placeholder:text-white/25 focus:outline-none focus:border-cyan-400/50";

// Routinix'in sağdan kayan, ışıltılı kenarlıklı GLOBAL müzik paneli — App
// kökünde (bkz. app.jsx) TEK SEFER, KOŞULSUZ monte edilir; kapanınca
// unmount OLMAZ, yalnızca CSS ile görünmezleşir (bkz. dosya altındaki
// açık/kapalı sınıfları). Bu yüzden:
//   - Müzik panel kapansa/açılsa/sekme değişse de KESİNTİYE UĞRAMAZ (asıl
//     iframe/controller'lar zaten burada değil, useMusic()'in kendi
//     mountRef'lerinde — bu bileşen SADECE onların etrafına konumlanmış bir
//     "vitrin").
//   - ARKA PLAN KARARTMASI YOK (backdrop/overlay div'i BİLEREK YOK) — panel
//     yalnızca kendi kartı, arkasındaki ekran (zamanlayıcı/görevler/butonlar)
//     panel açıkken de TAMAMEN tıklanabilir kalır.
//   - z-index BİLEREK z-[95] (İSTENEN "z-40" değil) — Focus Studio'nun
//     kendi tam ekran katmanı z-[90] (bkz. PomodoroStudio.jsx); z-40 ile bu
//     panel Focus Studio açıkken GÖRÜNMEZ/tıklanmaz kalırdı, ki tetikleyici
//     Spotify/YouTube butonları TAM DA orada.
export default function GlobalMusicPlayer() {
  const m = useMusic();
  const tint = MUSIC_TABS.find((t) => t.key === m.activeTab)?.tint || "#06B6D4";

  return (
    <div
      className={`fixed right-6 top-20 bottom-8 z-[95] w-[420px] max-w-[calc(100vw-3rem)] transition-all duration-300 ease-out ${
        m.panelOpen ? "translate-x-0 opacity-100 pointer-events-auto" : "translate-x-10 opacity-0 pointer-events-none"
      }`}
      aria-hidden={!m.panelOpen}
    >
      {/* Dış kutu — dönen conic-gradient ışıklı kenarlık. İç kutu (p-[2px]
          boşluk BIRAKARAK) üstüne oturuyor, geriye yalnızca 2px'lik dönen
          bir "ışık halkası" görünür kalıyor. */}
      <div className="relative h-full w-full rounded-[30px] p-[2px] overflow-hidden" style={{ boxShadow: `0 24px 70px -20px ${tint}55` }}>
        <div
          className="absolute motion-safe:animate-[spin_4s_linear_infinite]"
          style={{
            top: "-100%",
            left: "-100%",
            width: "300%",
            height: "300%",
            background: "conic-gradient(from 0deg, #06b6d4, #3b82f6, #00f2fe, #06b6d4)",
          }}
        />
        <div className="relative h-full w-full rounded-[28px] bg-slate-950/90 backdrop-blur-2xl p-6 flex flex-col overflow-hidden">
          {/* Üst başlık: sekmeler + kapat */}
          <div className="shrink-0 flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-1 rounded-full p-1 bg-white/5 border border-white/10">
              {MUSIC_TABS.map((t) => {
                const Icon = t.icon;
                const active = m.activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => m.switchTab(t.key)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all"
                    style={{ background: active ? `${t.tint}26` : "transparent", color: active ? t.tint : "rgba(255,255,255,0.4)" }}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={m.closePanel}
              aria-label="Kapat"
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {m.activeTab === "spotify" ? <SpotifyControls /> : <YoutubeControls />}

          {/* Oynatıcı alanı — iki mount noktası da HER ZAMAN DOM'da (bkz.
              MusicContext.jsx); yalnızca aktif olmayanın opaklığı/pointer-
              events'i sıfırlanır. display:none KULLANILMAZ — bazı
              tarayıcılar display:none'lı bir iframe'i Page Visibility
              API üzerinden "hidden" sayıp arkadaki oynatmayı durdurabilir. */}
          <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden border" style={{ borderColor: `${tint}33` }}>
            <div
              ref={m.spotifyMountRef}
              className={`absolute inset-0 transition-opacity duration-150 ${m.activeTab === "spotify" ? "opacity-100 z-10" : "opacity-0 -z-10 pointer-events-none"}`}
            />
            <div
              ref={m.youtubeMountRef}
              className={`absolute inset-0 transition-opacity duration-150 ${m.activeTab === "youtube" ? "opacity-100 z-10" : "opacity-0 -z-10 pointer-events-none"}`}
            />
          </div>

          <p className="mt-3 shrink-0 text-[11px] leading-relaxed text-white/35">
            {m.activeTab === "spotify"
              ? "Spotify'ın kendi oynatıcısı — kontrolü doğrudan burada ya da üst bardaki mini widget'tan yap."
              : "YouTube'un kendi oynatıcısı — kontrolü doğrudan burada ya da üst bardaki mini widget'tan yap."}
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
    <div className="shrink-0 flex flex-col gap-2 mb-3">
      {/* Hesap satırı — kişisel kütüphaneye erişim İÇİN OAuth (bkz.
          MusicContext.jsx dosya başı yorumu: gerçek çalma yine bu
          bileşenin altındaki AYNI Embed oynatıcı üzerinden olur). */}
      {m.spotifyAuthStatus === "ready" && m.spotifyProfile ? (
        <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-white/[0.04] border border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <CircleUserRound className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="text-[11.5px] font-semibold text-white/80 truncate">{m.spotifyProfile.displayName}</span>
          </div>
          <button onClick={m.disconnectSpotify} className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-white/40 hover:text-white/70 transition-colors">
            <LogOut className="w-3 h-3" /> Çıkış
          </button>
        </div>
      ) : (
        <button
          onClick={m.connectSpotify}
          disabled={m.spotifyAuthStatus === "connecting"}
          className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold transition-colors bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-60"
        >
          {m.spotifyAuthStatus === "connecting" ? <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
          {m.spotifyAuthStatus === "connecting" ? "Bağlanıyor..." : "Spotify Hesabını Bağla"}
        </button>
      )}
      {m.spotifyAuthStatus === "error" && m.spotifyAuthError && <p className="text-[10.5px] text-rose-400 px-0.5">{m.spotifyAuthError}</p>}

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

function YoutubeControls() {
  const m = useMusic();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [customUrlError, setCustomUrlError] = useState(null);
  const isPreset = YOUTUBE_PRESET_VIDEOS.some((v) => v.id === m.youtubeVideoId);

  const handleLoadCustomUrl = () => {
    const match = YOUTUBE_VIDEO_URL_RE.exec(customUrlInput.trim());
    if (!match) {
      setCustomUrlError("Geçerli bir YouTube video linki değil.");
      return;
    }
    m.setYoutubeVideoId(match[1]);
    setCustomUrlError(null);
    setCustomUrlInput("");
    setShowCustomInput(false);
  };

  return (
    <div className="shrink-0 flex flex-col gap-2 mb-3">
      <div className="flex items-center gap-1.5">
        <select
          value={isPreset ? m.youtubeVideoId : "custom"}
          onChange={(e) => m.setYoutubeVideoId(e.target.value)}
          aria-label="Hazır video seç"
          className={`flex-1 min-w-0 ${CONTROL_CLASS}`}
        >
          {!isPreset && (
            <option value="custom" disabled>
              Özel Video
            </option>
          )}
          {YOUTUBE_PRESET_VIDEOS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
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
              placeholder="https://youtube.com/watch?v=..."
              className={`flex-1 min-w-0 ${CONTROL_CLASS}`}
            />
            <button
              onClick={handleLoadCustomUrl}
              className="shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-bold transition-colors bg-[#FF3B5C]/15 border border-[#FF3B5C]/30 text-[#FF3B5C] hover:bg-[#FF3B5C]/25"
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
