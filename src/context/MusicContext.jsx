import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
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

// Routinix Global Müzik Oynatıcı — Spotify oynatma durumunun TEK doğruluk
// kaynağı. Kök nedeni ("panel kapatılınca oynatıcı unmount olup müzik
// duruyordu") burada çözülüyor: iframe/controller App kökünde BİR KEZ (bkz.
// GlobalMusicPlayer.jsx) monte ediliyor ve BİR DAHA ASLA unmount olmuyor —
// panelin açık/kapalı olması yalnızca CSS (opacity/pointer-events) ile
// yönetilen bir GÖRÜNÜRLÜK meselesi, DOM varlığı DEĞİL.
//
// YOUTUBE MUSIC KALDIRILDI: bu context eskiden Spotify + YouTube IFrame
// Player'ı birlikte yönetiyordu (iki ayrı sekme/controller/mount noktası).
// Performans/pil turu kapsamında (bkz. GlobalMusicPlayer.jsx'in artık
// panel kapalıyken durdurulan dönen kenarlığı) YouTube altyapısı TAMAMEN
// kaldırıldı — yalnızca Spotify kalıyor. Geri getirilmesi gerekirse git
// geçmişinde bu dosyanın önceki hali referans alınabilir.
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

// playback_update olayı Spotify'ın embed'inden GERÇEKTEN sık aralıklarla
// (saniyede birden fazla) fırlayabiliyor — pozisyonu HER olayda state'e
// yazmak, MM:SS gösterimindeki görsel çözünürlüğün (saniye) çok ÜSTÜNDE bir
// re-render sıklığı yaratır ve useMusic() kullanan HER bileşeni (mini
// widget/kontrol kartı/panel) gereksiz yere tetikler — ısınma/pil şikayetinin
// gerçek kök nedenlerinden biri. Konum en fazla bu aralıkla state'e yazılır;
// kullanıcı hiçbir zaman 1 saniyeden daha ince bir fark GÖREMEYECEĞİNDEN bu
// tamamen kayıpsız bir optimizasyon.
const POSITION_UPDATE_THROTTLE_MS = 1000;

export function MusicProvider({ children }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [spotifyPlaylistId, setSpotifyPlaylistId] = useState(SPOTIFY_PRESET_PLAYLISTS[0].id);
  // "Ref aynası" (ref mirror) — canlı testte YAKALANAN gerçek bir yarış
  // durumunu önler: kullanıcı paneli AÇAR AÇMAZ (script/controller henüz
  // ASENKRON kuruluyorken) farklı bir playlist SEÇERSE, controller
  // OLUŞTURULDUĞUNDA (attach, aşağıda) state'i BİLEREK OKUMAZ — o an içinde
  // bulunulan render'ın ESKİ (stale) closure'ını yakalardı. Bunun yerine
  // HER ZAMAN bu ref'in GÜNCEL .current değerinden okunur.
  const spotifyPlaylistIdRef = useRef(spotifyPlaylistId);
  useEffect(() => {
    spotifyPlaylistIdRef.current = spotifyPlaylistId;
  }, [spotifyPlaylistId]);

  // Script enjeksiyonu + controller kurulumu TEMBEL — kullanıcı paneli en az
  // BİR KEZ açana kadar (openPanel) hiçbir harici script indirilmez.
  const [spotifyInitialized, setSpotifyInitialized] = useState(false);

  const [spotifyReady, setSpotifyReady] = useState(false);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  // Embed IFrame API'nin playback_update olayından — MİLİSANİYE (Spotify'ın
  // kendi birimi); dışarıya (bkz. positionSec/durationSec altta) SANİYEYE
  // çevrilerek sunulur. Yukarıdaki POSITION_UPDATE_THROTTLE_MS notuna bkz.
  const [spotifyPositionMs, setSpotifyPositionMs] = useState(0);
  const [spotifyDurationMs, setSpotifyDurationMs] = useState(0);
  const lastPositionCommitRef = useRef(0);
  const spotifyControllerRef = useRef(null);
  const spotifyMountRef = useRef(null);

  const [spotifyAuthStatus, setSpotifyAuthStatus] = useState("idle"); // idle | connecting | ready | error
  const [spotifyAuthError, setSpotifyAuthError] = useState(null);
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [spotifyUserPlaylists, setSpotifyUserPlaylists] = useState([]);
  const spotifyTokensRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const openPanel = useCallback(() => {
    setSpotifyInitialized(true);
    setPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  // Paneli AÇMADAN yalnızca Spotify script/controller kurulumunu tetikler —
  // PomodoroStudio'nun "Müzik Oynatıcı" mini modalı (Spotify markalı
  // panel/playlist seçici hiç görünmeden, doğrudan çal/duraklat/ileri-geri
  // kontrolleriyle açılması) için — bkz. FocusMusicControlCard'ın
  // `onStartRequest` prop'u.
  const ensureSpotifyInitialized = useCallback(() => {
    setSpotifyInitialized(true);
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
        // Kullanıcı az önce Spotify'a bilerek bağlandı — panel KENDİLİĞİNDEN
        // açılsın ki bağlandığını hemen görsün.
        setSpotifyInitialized(true);
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
      // `theme: "0"` — Spotify IFrame API'nin KENDİ koyu tema seçeneği (statik
      // embed URL'lerindeki `?theme=0` query param'ının SDK karşılığı).
      // BİLEREK YOK'tan BURAYA eklendi: bu seçenek olmadan embed'in kendi
      // arka planı AÇIK/beyaz temada render olabiliyordu — uygulamanın
      // sabit koyu Focus Studio zeminiyle birleşince "altı tamamen beyaz"
      // olarak bildirilen hatanın bir parçası buydu (diğer parçası, aşağıda
      // GlobalMusicPlayer.jsx'te düzeltilen kapsayıcı yüksekliğiydi).
      IFrameAPI.createController(
        spotifyMountRef.current,
        { uri: `spotify:playlist:${spotifyPlaylistIdRef.current}`, width: "100%", height: "100%", theme: "0" },
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
            if (typeof e?.data?.duration === "number") setSpotifyDurationMs(e.data.duration);
            // Pozisyon THROTTLE'LANIR (bkz. POSITION_UPDATE_THROTTLE_MS) —
            // yalnızca son yazımdan bu yana yeterli süre geçtiyse state'e
            // yazılır, aksi halde bu olay SESSİZCE atlanır (görsel MM:SS
            // hiçbir zaman bu farkı ayırt edemez).
            if (typeof e?.data?.position === "number") {
              const now = Date.now();
              if (now - lastPositionCommitRef.current >= POSITION_UPDATE_THROTTLE_MS) {
                lastPositionCommitRef.current = now;
                setSpotifyPositionMs(e.data.position);
              }
            }
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

  const togglePlayPause = useCallback(() => {
    safeSpotifyCall(() => spotifyControllerRef.current?.togglePlay?.());
  }, []);

  // Kaydırma çubuğu — kullanıcı bıraktığında (bkz. FocusMusicControlCard'ın
  // onMouseUp/onTouchEnd/onKeyUp ile "commit" ettiği tek çağrı, ONCHANGE'İN
  // HER PIXEL'İNDE DEĞİL) çağrılır. seconds: SANİYE — Spotify'ın kendi ms
  // biriminden BURADA çevrilir.
  const seekTo = useCallback((seconds) => {
    // DÜRÜSTLÜK NOTU: Embed IFrame API'nin seek(seconds) metodu Spotify'ın
    // belgelenmiş sözleşmesine göre çağrılıyor, bu ortamda canlı
    // doğrulanamadı (bkz. yukarıdaki playback_update yorumu).
    safeSpotifyCall(() => spotifyControllerRef.current?.seek?.(seconds));
  }, []);

  // Önceki/Sonraki — KASITLI bir kapsam kararı: Spotify Embed IFrame API'si
  // programatik "parça atlama" desteklemiyor (Web Playback SDK Premium hesap
  // + çok daha büyük bir entegrasyon gerektirir, bkz. dosya başı yorumu —
  // BİLİNÇLİ OLARAK kurulmadı). Bunun yerine "Önceki/Sonraki" kürate edilmiş
  // listede (hazır + Kütüphanem) bir SONRAKİ KAYNAĞA (çalma listesi) geçer —
  // gerçek parça atlama DEĞİL, ama gerçekten ÇALIŞAN, dürüst bir "sıradaki"
  // deneyimi.
  const skipBy = useCallback(
    (direction) => {
      const list = [...SPOTIFY_PRESET_PLAYLISTS, ...spotifyUserPlaylists];
      const idx = list.findIndex((p) => p.id === spotifyPlaylistId);
      const next = list[(((idx === -1 ? 0 : idx) + direction) % list.length + list.length) % list.length];
      if (next) setSpotifyPlaylistId(next.id);
    },
    [spotifyPlaylistId, spotifyUserPlaylists]
  );
  const skipNext = useCallback(() => skipBy(1), [skipBy]);
  const skipPrevious = useCallback(() => skipBy(-1), [skipBy]);

  const activeSpotifyPlaylist =
    spotifyUserPlaylists.find((p) => p.id === spotifyPlaylistId) || SPOTIFY_PRESET_PLAYLISTS.find((p) => p.id === spotifyPlaylistId);
  // Yalnızca kullanıcının KENDİ kütüphanesindeki bir liste seçiliyse GERÇEK
  // kapak görseli var (fetchUserPlaylists, bkz. spotifyWebApi.js). Hazır
  // listelerde (giriş yapılmadan) kapak görseli YOKTUR — Spotify Web API'sine
  // anonim bir kullanıcı adına istek ATILAMAZ (bkz. .env.example'daki Client
  // Credentials notu — bilerek kurulmadı).
  const thumbnailUrl = activeSpotifyPlaylist?.imageUrl || null;

  // Context değerini bellek/re-render açısından ucuza tutmak için useMemo —
  // yalnızca GERÇEKTEN değişen alanlar yeni bir referans üretir. Pozisyon
  // (spotifyPositionMs) hâlâ dependency listesinde (doğru: konuma bağlı UI'lar
  // — ör. FocusMusicControlCard'ın kaydırma çubuğu — GERÇEKTEN yeniden
  // render OLMALI) ama artık yukarıdaki throttle sayesinde saniyede birden
  // fazla DEĞİL, en fazla saniyede bir tetikleniyor.
  const value = useMemo(
    () => ({
      panelOpen,
      openPanel,
      closePanel,
      ensureSpotifyInitialized,
      spotifyPlaylistId,
      setSpotifyPlaylistId,
      spotifyInitialized,
      spotifyMountRef,
      spotifyReady,
      spotifyPlaying,
      isPlaying: spotifyPlaying,
      hasActivePlayer: spotifyInitialized,
      nowPlayingLabel: activeSpotifyPlaylist?.label || "Spotify",
      nowPlayingSubLabel: "Spotify",
      thumbnailUrl,
      positionSec: spotifyPositionMs / 1000,
      durationSec: spotifyDurationMs / 1000,
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
    }),
    [
      panelOpen,
      openPanel,
      closePanel,
      ensureSpotifyInitialized,
      spotifyPlaylistId,
      spotifyInitialized,
      spotifyReady,
      spotifyPlaying,
      activeSpotifyPlaylist,
      thumbnailUrl,
      spotifyPositionMs,
      spotifyDurationMs,
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
    ]
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic, <MusicProvider> içinde kullanılmalı.");
  return ctx;
}
