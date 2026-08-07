import { useState, useEffect } from "react";
import { Play, Pause, FastForward, Rewind, Music } from "lucide-react";
import { useMusic } from "../context/MusicContext";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Hazır YouTube "video"larımız aslında 7/24 CANLI YAYIN (Lofi Girl vb.) —
// canlı içerikte getDuration() sabit bir şarkı uzunluğu DEĞİL, akışın o ana
// kadar geçen (SÜREKLİ BÜYÜYEN) süresini döner; bunu normal bir ilerleme
// çubuğunda göstermeye çalışmak "02:45 / 2026080152" gibi anlamsız devasa
// sayılara yol açar (canlı testte GÖRÜLDÜ). 4 saatten uzun/anlamsız bir
// "süre" canlı yayın sayılır — ilerleme çubuğu yerine bir "CANLI" rozeti
// gösterilir, seek DEVRE DIŞI bırakılır (play/pause/önceki/sonraki etkilenmez).
const LIVE_DURATION_THRESHOLD_SEC = 4 * 60 * 60;

// Pomodoro/Focus Studio ekranına GÖMÜLÜ müzik kontrol kartı — GlobalMusicPlayer
// panelinin ve Header'daki mini widget'ın kullandığı AYNI global useMusic()
// state'ini okur/yazar; kendi state'i YOK, yalnızca üçüncü bir GÖRÜNÜM (müzik
// üç yerden de senkronize kontrol edilir, biri değiştirince hepsi güncellenir).
// PomodoroStudio'nun geri kalanı gibi sabit koyu/neon paletle (dark: varyantı
// GEREKMEZ — bkz. PomodoroStudio.jsx dosya başı yorumu).
export default function FocusMusicControlCard() {
  const m = useMusic();
  // Kaydırma çubuğu sürüklenirken YEREL bir değer tutulur — context'teki
  // GERÇEK pozisyon (Spotify/YouTube'dan periyodik gelir) sürükleme sırasında
  // barı GERİ SIÇRATMASIN diye. Yalnızca bırakınca (onMouseUp/onTouchEnd/
  // onKeyUp) GERÇEK seek() çağrısı yapılır — onChange'in HER pikselinde DEĞİL.
  const [dragValue, setDragValue] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setDragValue(null);
  }, [m.activeTab]);

  // Küçük resim URL'si değişince (yeni video/liste) önceki yükleme
  // hatasının BELLENMEMESİ için sıfırla.
  useEffect(() => {
    setImgFailed(false);
  }, [m.thumbnailUrl]);

  if (!m.hasActivePlayer) {
    return (
      <button
        onClick={() => m.openPanel()}
        className="w-full max-w-[360px] rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left transition-colors hover:bg-cyan-500/10"
        style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.25)" }}
      >
        <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(6,182,212,0.15)", color: "#06B6D4" }}>
          <Music className="w-4 h-4" />
        </span>
        <span className="text-[12.5px] font-semibold" style={{ color: "#06B6D4" }}>
          Odak için müzik başlat
        </span>
      </button>
    );
  }

  const tint = m.activeTab === "spotify" ? "#1DB954" : "#FF3B5C";
  const duration = m.durationSec || 0;
  const isLive = !Number.isFinite(duration) || duration > LIVE_DURATION_THRESHOLD_SEC;
  const rawPosition = dragValue ?? m.positionSec ?? 0;
  const displayPosition = duration > 0 && !isLive ? Math.min(rawPosition, duration) : rawPosition;

  const commitSeek = (value) => {
    m.seekTo(value);
    setDragValue(null);
  };

  return (
    <div
      className="w-full max-w-[360px] rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${tint}33`, boxShadow: `0 0 24px -14px ${tint}` }}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: `${tint}1A` }}>
          {m.thumbnailUrl && !imgFailed ? (
            <img src={m.thumbnailUrl} alt="" className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
          ) : (
            <Music className="w-5 h-5" style={{ color: tint }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold truncate text-white/90">{m.nowPlayingLabel}</p>
          <p className="text-[10.5px] font-medium truncate" style={{ color: tint }}>
            {m.nowPlayingSubLabel}
          </p>
        </div>
      </div>

      {isLive ? (
        <div className="flex items-center gap-1.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full motion-safe:animate-pulse" style={{ background: tint }} />
          <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: tint }}>
            Canlı Yayın
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="1"
            value={displayPosition}
            onChange={(e) => setDragValue(Number(e.target.value))}
            onMouseUp={(e) => commitSeek(Number(e.target.value))}
            onTouchEnd={(e) => commitSeek(Number(e.target.value))}
            onKeyUp={(e) => commitSeek(Number(e.target.value))}
            disabled={!duration}
            aria-label="Şarkı ilerlemesi"
            className="w-full h-1.5 rounded-full cursor-pointer disabled:cursor-default disabled:opacity-40"
            style={{ accentColor: tint }}
          />
          <div className="flex items-center justify-between text-[10px] font-semibold tabular-nums text-white/40">
            <span>{formatTime(displayPosition)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={m.skipPrevious}
          aria-label="Önceki"
          title="Önceki (liste/video)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          <Rewind className="w-4 h-4" />
        </button>
        <button
          onClick={m.togglePlayPause}
          aria-label={m.isPlaying ? "Duraklat" : "Oynat"}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: tint, color: "#04120C", boxShadow: `0 0 20px -4px ${tint}` }}
        >
          {m.isPlaying ? <Pause className="w-[18px] h-[18px]" fill="currentColor" /> : <Play className="w-[18px] h-[18px] ml-0.5" fill="currentColor" />}
        </button>
        <button
          onClick={m.skipNext}
          aria-label="Sonraki"
          title="Sonraki (liste/video)"
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          <FastForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
