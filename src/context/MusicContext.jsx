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

// Spotify Embed IFrame API controller çağrıları (play/pause/seek/loadUri)
// SENKRON olarak fırlayabiliyor — canlı testte doğrulandı: henüz hiçbir şey
// YÜKLENMEMİŞKEN pause() çağrılırsa Spotify'ın kendi iç SDK'sı "Cannot
// perform operation; no list was loaded" hatasıyla throw ediyor. Bu çağrı
// bir React event handler'ının İÇİNDEN geldiği için ErrorBoundary'ye kadar
// YÜKSELİP tüm uygulamayı çökertebilir — üçüncü taraf bir widget'ın iç
// hata durumu YÜZÜNDEN bu kabul edilemez, bu yüzden HER controller çağrısı
// buradan geçer.
function safeSpotifyCall(fn) {
  try {
    fn();
  } catch (err) {
    logger.warn("MUSIC_SPOTIFY", "Embed controller çağrısı başarısız (yok sayıldı)", { error: err?.message });
  }
}

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
  // "Ref aynası" (ref mirror) — canlı testte YAKALANAN gerçek bir yarış
  // durumunu önler: kullanıcı bir sekmeyi AÇAR AÇMAZ (script/player henüz
  // ASENKRON kuruluyorken) farklı bir playlist/video SEÇERSE, controller/
  // player OLUŞTURULDUĞUNDA (attach/createPlayer, aşağıda) state'i BİLEREK
  // OKUMAZ — o an içinde bulunulan render'ın ESKİ (stale) closure'ını
  // yakalardı. Bunun yerine HER ZAMAN bu ref'lerin GÜNCEL .current
  // değerinden okunur.
  const spotifyPlaylistIdRef = useRef(spotifyPlaylistId);
  const youtubeVideoIdRef = useRef(youtubeVideoId);
  useEffect(() => {
    spotifyPlaylistIdRef.current = spotifyPlaylistId;
  }, [spotifyPlaylistId]);
  useEffect(() => {
    youtubeVideoIdRef.current = youtubeVideoId;
  }, [youtubeVideoId]);

  // Script enjeksiyonu + controller/player kurulumu TEMBEL — kullanıcı
  // Spotify/YouTube'u en az BİR KEZ açana kadar (openPanel) hiçbir harici
  // script indirilmez. "Kesintisiz çalma" başladıktan SONRA garanti edilir,
  // uygulama İLK açıldığında DEĞİL.
  const [spotifyInitialized, setSpotifyInitialized] = useState(false);
  const [youtubeInitialized, setYoutubeInitialized] = useState(false);

  const [spotifyReady, setSpotifyReady] = useState(false);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  // Embed IFrame API'nin playback_update olayından — MİLİSANİYE (Spotify'ın
  // kendi birimi); dışarıya (bkz. positionSec/durationSec altta) SANİYEYE
  // çevrilerek YouTube İLE AYNI birimde sunulur.
  const [spotifyPositionMs, setSpotifyPositionMs] = useState(0);
  const [spotifyDurationMs, setSpotifyDurationMs] = useState(0);
  const spotifyControllerRef = useRef(null);
  const spotifyMountRef = useRef(null);

  const [youtubeReady, setYoutubeReady] = useState(false);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState("");
  // YouTube IFrame API zaman güncellemesi PUSH ETMEZ — çalarken saniyede bir
  // getCurrentTime() ile YOKLANIR (bkz. aşağıdaki polling efekti).
  const [youtubePositionSec, setYoutubePositionSec] = useState(0);
  const [youtubeDurationSec, setYoutubeDurationSec] = useState(0);
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
      safeSpotifyCall(() => spotifyControllerRef.current?.pause?.());
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
      // spotifyPlaylistIdRef.current (KAPANMA/closure DEĞİL) — script yüklenip
      // bu callback tetiklenene kadar geçen sürede kullanıcı FARKLI bir liste
      // seçmiş olabilir (canlı testte YAKALANAN gerçek bir yarış durumu).
      IFrameAPI.createController(
        spotifyMountRef.current,
        { uri: `spotify:playlist:${spotifyPlaylistIdRef.current}`, width: "100%", height: "100%" },
        (controller) => {
          spotifyControllerRef.current = controller;
          setSpotifyReady(true);
          // playback_update, DÜRÜSTLÜK NOTU: Spotify'ın belgelenmiş Embed
          // IFrame API sözleşmesine göre (isPaused/isBuffering/position/
          // duration alanları) yazıldı — bu ortamda gerçek bir Spotify
          // hesabıyla uçtan uca CANLI doğrulanamadı; ilerleme çubuğu/süre
          // beklenenden farklı davranırsa ilk bakılacak yer burası.
          controller.addListener("playback_update", (e) => {
            setSpotifyPlaying(!e?.data?.isPaused && !e?.data?.isBuffering);
            if (typeof e?.data?.position === "number") setSpotifyPositionMs(e.data.position);
            if (typeof e?.data?.duration === "number") setSpotifyDurationMs(e.data.duration);
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
    safeSpotifyCall(() => spotifyControllerRef.current?.loadUri?.(`spotify:playlist:${spotifyPlaylistId}`));
  }, [spotifyPlaylistId]);

  // ------------------------------------------------------------------
  // YouTube IFrame Player API — TEMBEL, tek sefer kurulur.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!youtubeInitialized || youtubePlayerRef.current) return;

    function createPlayer() {
      if (youtubePlayerRef.current || !youtubeMountRef.current || !window.YT?.Player) return;
      // youtubeVideoIdRef.current (KAPANMA/closure DEĞİL) — YT IFrame API
      // script'i yüklenip bu fonksiyon tetiklenene kadar geçen sürede
      // kullanıcı FARKLI bir video seçmiş olabilir (canlı testte YAKALANAN
      // gerçek bir yarış durumu: eski/varsayılan video sessizce kalıcı
      // olarak yüklenip kullanıcının seçimi YOK SAYILIYORDU).
      youtubePlayerRef.current = new window.YT.Player(youtubeMountRef.current, {
        videoId: youtubeVideoIdRef.current,
        playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            setYoutubeReady(true);
            setYoutubeDurationSec(youtubePlayerRef.current?.getDuration?.() || 0);
          },
          onStateChange: (e) => {
            setYoutubePlaying(e.data === window.YT.PlayerState.PLAYING);
            const title = youtubePlayerRef.current?.getVideoData?.()?.title;
            if (title) setYoutubeTitle(title);
            const dur = youtubePlayerRef.current?.getDuration?.();
            if (dur) setYoutubeDurationSec(dur);
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
    setYoutubePositionSec(0);
    setYoutubeDurationSec(0);
    youtubePlayerRef.current.loadVideoById(youtubeVideoId);
  }, [youtubeVideoId]);

  // YouTube IFrame API bir "zaman ilerledi" olayı YAYINLAMAZ — bu yüzden
  // yalnızca GERÇEKTEN çalarken saniyede bir getCurrentTime() ile YOKLANIR.
  // Spotify tarafında buna gerek yok: playback_update olayı zaten periyodik
  // olarak position/duration'ı kendisi gönderiyor (bkz. yukarıdaki listener).
  useEffect(() => {
    if (!youtubePlaying || !youtubePlayerRef.current?.getCurrentTime) return;
    const id = setInterval(() => {
      setYoutubePositionSec(youtubePlayerRef.current?.getCurrentTime?.() || 0);
    }, 1000);
    return () => clearInterval(id);
  }, [youtubePlaying]);

  const togglePlayPause = useCallback(() => {
    if (activeTab === "spotify") {
      safeSpotifyCall(() => spotifyControllerRef.current?.togglePlay?.());
    } else if (youtubePlayerRef.current) {
      if (youtubePlaying) youtubePlayerRef.current.pauseVideo();
      else youtubePlayerRef.current.playVideo();
    }
  }, [activeTab, youtubePlaying]);

  // Kaydırma çubuğu — kullanıcı bıraktığında (bkz. FocusMusicControlCard'ın
  // onMouseUp/onTouchEnd/onKeyUp ile "commit" ettiği tek çağrı, ONCHANGE'İN
  // HER PIXEL'İNDE DEĞİL) çağrılır. seconds: SANİYE (platform farkı burada
  // gizlenir — Spotify'ın kendi ms biriminden BURADA çevrilir).
  const seekTo = useCallback(
    (seconds) => {
      if (activeTab === "spotify") {
        // DÜRÜSTLÜK NOTU: Embed IFrame API'nin seek(seconds) metodu Spotify'ın
        // belgelenmiş sözleşmesine göre çağrılıyor, bu ortamda canlı
        // doğrulanamadı (bkz. yukarıdaki playback_update yorumu).
        safeSpotifyCall(() => spotifyControllerRef.current?.seek?.(seconds));
      } else {
        youtubePlayerRef.current?.seekTo?.(seconds, true);
      }
    },
    [activeTab]
  );

  // Önceki/Sonraki — KASITLI bir kapsam kararı: ne Spotify Embed IFrame
  // API'si ne de (tek video yüklenmiş, GERÇEK bir YouTube playlist'i
  // OLMAYAN) bu YouTube player'ı programatik "parça atlama" desteklemiyor.
  // Spotify'ın GERÇEK Web Playback SDK'sıyla parça-seviyesi atlama Premium
  // hesap + çok daha büyük bir entegrasyon gerektirir (bkz. dosya başı
  // yorumu — BİLİNÇLİ OLARAK kurulmadı). Bunun yerine "Önceki/Sonraki" BU
  // sekmenin kürate edilmiş listesinde (Spotify: hazır + Kütüphanem,
  // YouTube: hazır) bir SONRAKİ KAYNAĞA (çalma listesi/video) geçer — gerçek
  // parça atlama DEĞİL, ama gerçekten ÇALIŞAN, dürüst bir "sıradaki" deneyimi.
  const skipBy = useCallback(
    (direction) => {
      if (activeTab === "spotify") {
        const list = [...SPOTIFY_PRESET_PLAYLISTS, ...spotifyUserPlaylists];
        const idx = list.findIndex((p) => p.id === spotifyPlaylistId);
        const next = list[(((idx === -1 ? 0 : idx) + direction) % list.length + list.length) % list.length];
        if (next) setSpotifyPlaylistId(next.id);
      } else {
        const idx = YOUTUBE_PRESET_VIDEOS.findIndex((v) => v.id === youtubeVideoId);
        const next = YOUTUBE_PRESET_VIDEOS[(((idx === -1 ? 0 : idx) + direction) % YOUTUBE_PRESET_VIDEOS.length + YOUTUBE_PRESET_VIDEOS.length) % YOUTUBE_PRESET_VIDEOS.length];
        if (next) setYoutubeVideoId(next.id);
      }
    },
    [activeTab, spotifyPlaylistId, spotifyUserPlaylists, youtubeVideoId]
  );
  const skipNext = useCallback(() => skipBy(1), [skipBy]);
  const skipPrevious = useCallback(() => skipBy(-1), [skipBy]);

  const isPlaying = activeTab === "spotify" ? spotifyPlaying : youtubePlaying;
  const hasActivePlayer = spotifyInitialized || youtubeInitialized;
  const activeSpotifyPlaylist =
    spotifyUserPlaylists.find((p) => p.id === spotifyPlaylistId) || SPOTIFY_PRESET_PLAYLISTS.find((p) => p.id === spotifyPlaylistId);
  const nowPlayingLabel = activeTab === "spotify" ? activeSpotifyPlaylist?.label || "Spotify" : youtubeTitle || YOUTUBE_PRESET_VIDEOS.find((v) => v.id === youtubeVideoId)?.label || "YouTube";
  const nowPlayingSubLabel = activeTab === "spotify" ? "Spotify" : "YouTube";
  // Spotify: yalnızca kullanıcının KENDİ kütüphanesindeki bir liste seçiliyse
  // GERÇEK kapak görseli var (fetchUserPlaylists, bkz. spotifyWebApi.js).
  // Hazır listelerde (giriş yapılmadan) kapak görseli YOKTUR — Spotify Web
  // API'sine anonim bir kullanıcı adına istek ATILAMAZ (bkz. .env.example'daki
  // Client Credentials notu — bilerek kurulmadı). YouTube'da HER ZAMAN gerçek
  // küçük resim var (img.youtube.com, kimlik doğrulama gerekmez).
  const thumbnailUrl = activeTab === "spotify" ? activeSpotifyPlaylist?.imageUrl || null : `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`;
  const positionSec = activeTab === "spotify" ? spotifyPositionMs / 1000 : youtubePositionSec;
  const durationSec = activeTab === "spotify" ? spotifyDurationMs / 1000 : youtubeDurationSec;

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
    nowPlayingSubLabel,
    thumbnailUrl,
    positionSec,
    durationSec,
    togglePlayPause,
    seekTo,
    skipNext,
    skipPrevious,
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
