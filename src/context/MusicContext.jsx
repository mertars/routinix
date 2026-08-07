import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  startSpotifyLogin,
  consumeSpotifyRedirectParams,
  exchangeCodeForToken,
  refreshSpotifyToken,
  readStoredTokens,
  clearStoredTokens,
} from "../utils/spotifyPkce";
import { fetchSpotifyProfile, fetchUserPlaylists } from "../services/spotifyWebApi";
import logger from "../utils/logger";

// Routinix Global Müzik Oynatıcı — Spotify/YouTube oynatma durumunun TEK
// doğruluk kaynağı. Kök nedeni ("panel kapatılınca oynatıcı unmount olup
// müzik duruyordu") burada çözülüyor: iframe/controller'lar artık
// PomodoroStudio'nun İÇİNDE değil, App kökünde BİR KEZ (bkz.
// GlobalMusicPlayer.jsx) monte ediliyor ve BİR DAHA ASLA unmount olmuyor —
// panelin açık/kapalı olması yalnızca CSS (opacity/pointer-events) ile
// yönetilen bir GÖRÜNÜRLÜK meselesi, DOM varlığı DEĞİL.
//
// SPOTIFY OYNATMA MİMARİSİ — bilinçli bir kapsam kararı: tam bir Web
// Playback SDK entegrasyonu (cihaz olarak kaydolma, Premium hesap ZORUNLU,
// gerçek bir "cihaz" üzerinden çalma) BU TURDA KURULMADI — hem çok daha
// büyük/kırılgan bir yüzey hem de Premium olmayan hesaplarda TAMAMEN
// çalışmaz. Onun yerine Spotify'ın PUBLIC "Embed IFrame API"si kullanılıyor
// (https://developer.spotify.com/documentation/embeds/references/iframe-api)
// — OAuth GEREKMEDEN bile gerçek play/pause/now-playing kontrolü verir;
// OAuth ile kazanılan şey yalnızca "kullanıcının KENDİ çalma listelerini
// seçebilmesi" (aynı embed'e loadUri ile yüklenir), cihaz bazlı akış DEĞİL.
// streaming/user-modify-playback-state kapsamları ileride tam SDK'ya
// geçilirse kullanılmak üzere ŞİMDİDEN istenir (bkz. spotifyPkce.js).
const MusicContext = createContext(null);

export const SPOTIFY_PRESET_PLAYLISTS = [
  { id: "37i9dQZF1DWYoYGBbGKurt", label: "Lo-Fi Beats" },
  { id: "37i9dQZF1DX9sIqqvKsjG8", label: "Deep Focus" },
  { id: "37i9dQZF1DX0SM0LYsmbMT", label: "Jazz Focus" },
  { id: "37i9dQZF1DWU0ScTcjJBdj", label: "Ambient Chill" },
];
export const YOUTUBE_PRESET_VIDEOS = [
  { id: "5qap5aO4i9A", label: "lofi hip hop radio 📚 beats to relax/study to" },
  { id: "jfKfPfyJRdk", label: "synthwave radio 🌌 beats to chill/game to" },
];

export function MusicProvider({ children }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("spotify"); // "spotify" | "youtube"
  const [spotifyPlaylistId, setSpotifyPlaylistId] = useState(SPOTIFY_PRESET_PLAYLISTS[0].id);
  const [youtubeVideoId, setYoutubeVideoId] = useState(YOUTUBE_PRESET_VIDEOS[0].id);

  // Script enjeksiyonu + controller/player kurulumu TEMBEL — kullanıcı
  // Spotify/YouTube'u en az BİR KEZ açana kadar (openPanel) hiçbir harici
  // script indirilmez. "Kesintisiz çalma" başladıktan SONRA garanti edilir,
  // uygulama İLK açıldığında DEĞİL.
  const [spotifyInitialized, setSpotifyInitialized] = useState(false);
  const [youtubeInitialized, setYoutubeInitialized] = useState(false);

  const [spotifyReady, setSpotifyReady] = useState(false);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  const spotifyControllerRef = useRef(null);
  const spotifyMountRef = useRef(null);

  const [youtubeReady, setYoutubeReady] = useState(false);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const youtubePlayerRef = useRef(null);
  const youtubeMountRef = useRef(null);

  const [spotifyAuthStatus, setSpotifyAuthStatus] = useState("idle"); // idle | connecting | ready | error
  const [spotifyAuthError, setSpotifyAuthError] = useState(null);
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [spotifyUserPlaylists, setSpotifyUserPlaylists] = useState([]);
  const spotifyTokensRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const openPanel = useCallback((tab) => {
    const nextTab = tab || activeTab;
    if (nextTab === "spotify") setSpotifyInitialized(true);
    else setYoutubeInitialized(true);
    setActiveTab(nextTab);
    setPanelOpen(true);
    // İki platform da AYNI ANDA arka planda çalar durumda kalabilir
    // (ikisi de global/persistent) — sekme değişince PASİF olanı durdur, bir
    // önceki turda da geçerli olan "tek seferde tek ses kaynağı" ilkesi.
  }, [activeTab]);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === "spotify") {
      setSpotifyInitialized(true);
      youtubePlayerRef.current?.pauseVideo?.();
    } else {
      setYoutubeInitialized(true);
      spotifyControllerRef.current?.pause?.();
    }
  }, []);

  // ------------------------------------------------------------------
  // Spotify OAuth (PKCE) yaşam döngüsü
  // ------------------------------------------------------------------
  const loadSpotifyLibrary = useCallback(async (accessToken) => {
    try {
      const [profile, playlists] = await Promise.all([fetchSpotifyProfile(accessToken), fetchUserPlaylists(accessToken)]);
      setSpotifyProfile(profile);
      setSpotifyUserPlaylists(playlists);
      setSpotifyAuthStatus("ready");
    } catch (err) {
      logger.warn("MUSIC_SPOTIFY", "Profil/kütüphane alınamadı", { error: err?.message });
      setSpotifyAuthStatus("error");
      setSpotifyAuthError("Spotify hesabın bağlandı ama kütüphanen alınamadı. Lütfen tekrar dene.");
    }
  }, []);

  const scheduleRefresh = useCallback(
    (tokens) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (!tokens.refreshToken) return;
      // Süresi dolmadan 60sn ÖNCE yenile — token'ın tam kenarında bir Web API
      // çağrısı yapılıp 401 alınmasını önler.
      const delay = Math.max(10_000, tokens.expiresAt - Date.now() - 60_000);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const next = await refreshSpotifyToken(tokens.refreshToken);
          spotifyTokensRef.current = next;
          scheduleRefresh(next);
        } catch (err) {
          logger.warn("MUSIC_SPOTIFY", "Token yenileme başarısız — oturum sonlandırılıyor", { error: err?.message });
          clearStoredTokens();
          spotifyTokensRef.current = null;
          setSpotifyAuthStatus("idle");
          setSpotifyProfile(null);
          setSpotifyUserPlaylists([]);
        }
      }, delay);
    },
    []
  );

  // 1) Spotify'dan dönen bir OAuth redirect var mı? (yalnızca uygulama İLK
  //    yüklendiğinde kontrol edilir — bkz. consumeSpotifyRedirectParams'ın
  //    URL'i hemen temizlemesi.)
  useEffect(() => {
    const params = consumeSpotifyRedirectParams();
    if (!params) return;
    if (params.error) {
      setSpotifyAuthStatus("error");
      setSpotifyAuthError(params.error === "access_denied" ? "Spotify girişi iptal edildi." : "Spotify girişi başarısız oldu.");
      return;
    }
    setSpotifyAuthStatus("connecting");
    exchangeCodeForToken(params.code, params.state)
      .then((tokens) => {
        spotifyTokensRef.current = tokens;
        scheduleRefresh(tokens);
        // Kullanıcı az önce Spotify'a bilerek bağlandı — panel/sekme
        // KENDİLİĞİNDEN açılsın ki bağlandığını hemen görsün.
        setSpotifyInitialized(true);
        setActiveTab("spotify");
        setPanelOpen(true);
        return loadSpotifyLibrary(tokens.accessToken);
      })
      .catch((err) => {
        logger.warn("MUSIC_SPOTIFY", "OAuth token alışverişi başarısız", { error: err?.message });
        setSpotifyAuthStatus("error");
        setSpotifyAuthError(err?.message || "Spotify girişi başarısız oldu.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Önceki bir oturumdan kalan token var mı? (localStorage, kalıcı)
  useEffect(() => {
    const stored = readStoredTokens();
    if (!stored?.accessToken) return;
    spotifyTokensRef.current = stored;
    if (stored.expiresAt <= Date.now()) {
      if (!stored.refreshToken) return;
      setSpotifyAuthStatus("connecting");
      refreshSpotifyToken(stored.refreshToken)
        .then((tokens) => {
          spotifyTokensRef.current = tokens;
          scheduleRefresh(tokens);
          return loadSpotifyLibrary(tokens.accessToken);
        })
        .catch(() => {
          clearStoredTokens();
          spotifyTokensRef.current = null;
          setSpotifyAuthStatus("idle");
        });
      return;
    }
    scheduleRefresh(stored);
    setSpotifyAuthStatus("connecting");
    loadSpotifyLibrary(stored.accessToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => refreshTimerRef.current && clearTimeout(refreshTimerRef.current), []);

  const connectSpotify = useCallback(() => {
    setSpotifyAuthError(null);
    startSpotifyLogin().catch((err) => {
      setSpotifyAuthStatus("error");
      setSpotifyAuthError(err?.message || "Spotify girişi başlatılamadı.");
    });
  }, []);

  const disconnectSpotify = useCallback(() => {
    clearStoredTokens();
    spotifyTokensRef.current = null;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setSpotifyProfile(null);
    setSpotifyUserPlaylists([]);
    setSpotifyAuthStatus("idle");
    setSpotifyAuthError(null);
  }, []);

  // ------------------------------------------------------------------
  // Spotify Embed IFrame API — TEMBEL, tek sefer kurulur; sonraki playlist
  // değişimleri controller.loadUri ile YAPILIR, iframe YENİDEN OLUŞTURULMAZ.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!spotifyInitialized || spotifyControllerRef.current) return;

    function attach(IFrameAPI) {
      if (spotifyControllerRef.current || !spotifyMountRef.current) return;
      IFrameAPI.createController(
        spotifyMountRef.current,
        { uri: `spotify:playlist:${spotifyPlaylistId}`, width: "100%", height: "100%" },
        (controller) => {
          spotifyControllerRef.current = controller;
          setSpotifyReady(true);
          controller.addListener("playback_update", (e) => {
            setSpotifyPlaying(!e?.data?.isPaused && !e?.data?.isBuffering);
          });
        }
      );
    }

    if (!document.getElementById("spotify-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "spotify-iframe-api";
      tag.src = "https://open.spotify.com/embed/iframe-api/v1";
      tag.async = true;
      document.body.appendChild(tag);
    }
    const previous = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      previous?.(IFrameAPI);
      attach(IFrameAPI);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyInitialized]);

  // Aktif playlist değişince VAR OLAN controller'a yeni URI yükle.
  useEffect(() => {
    spotifyControllerRef.current?.loadUri?.(`spotify:playlist:${spotifyPlaylistId}`);
  }, [spotifyPlaylistId]);

  // ------------------------------------------------------------------
  // YouTube IFrame Player API — TEMBEL, tek sefer kurulur.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!youtubeInitialized || youtubePlayerRef.current) return;

    function createPlayer() {
      if (youtubePlayerRef.current || !youtubeMountRef.current || !window.YT?.Player) return;
      youtubePlayerRef.current = new window.YT.Player(youtubeMountRef.current, {
        videoId: youtubeVideoId,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setYoutubeReady(true),
          onStateChange: (e) => {
            setYoutubePlaying(e.data === window.YT.PlayerState.PLAYING);
            const title = youtubePlayerRef.current?.getVideoData?.()?.title;
            if (title) setYoutubeTitle(title);
          },
          onError: (e) => logger.warn("MUSIC_YOUTUBE", "YouTube oynatıcı hatası", { code: e?.data }),
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
      return;
    }
    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      createPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeInitialized]);

  useEffect(() => {
    if (!youtubePlayerRef.current?.loadVideoById) return;
    setYoutubeTitle("");
    youtubePlayerRef.current.loadVideoById(youtubeVideoId);
  }, [youtubeVideoId]);

  const togglePlayPause = useCallback(() => {
    if (activeTab === "spotify") {
      spotifyControllerRef.current?.togglePlay?.();
    } else if (youtubePlayerRef.current) {
      if (youtubePlaying) youtubePlayerRef.current.pauseVideo();
      else youtubePlayerRef.current.playVideo();
    }
  }, [activeTab, youtubePlaying]);

  const isPlaying = activeTab === "spotify" ? spotifyPlaying : youtubePlaying;
  const hasActivePlayer = spotifyInitialized || youtubeInitialized;
  const nowPlayingLabel =
    activeTab === "spotify"
      ? spotifyUserPlaylists.find((p) => p.id === spotifyPlaylistId)?.label ||
        SPOTIFY_PRESET_PLAYLISTS.find((p) => p.id === spotifyPlaylistId)?.label ||
        "Spotify"
      : youtubeTitle || YOUTUBE_PRESET_VIDEOS.find((v) => v.id === youtubeVideoId)?.label || "YouTube";

  const value = {
    panelOpen,
    openPanel,
    closePanel,
    activeTab,
    switchTab,
    spotifyPlaylistId,
    setSpotifyPlaylistId,
    youtubeVideoId,
    setYoutubeVideoId,
    spotifyInitialized,
    youtubeInitialized,
    spotifyMountRef,
    youtubeMountRef,
    spotifyReady,
    spotifyPlaying,
    youtubeReady,
    youtubePlaying,
    youtubeTitle,
    isPlaying,
    hasActivePlayer,
    nowPlayingLabel,
    togglePlayPause,
    spotifyAuthStatus,
    spotifyAuthError,
    spotifyProfile,
    spotifyUserPlaylists,
    connectSpotify,
    disconnectSpotify,
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic, <MusicProvider> içinde kullanılmalı.");
  return ctx;
}
