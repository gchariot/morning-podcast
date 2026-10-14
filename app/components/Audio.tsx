'use client';
/**
 * Lecteur audio unique, monté dans la mise en page commune : il survit aux changements d'onglet.
 * La page Écouter et le mini-lecteur ne sont que des télécommandes de ce même <audio>.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export type Track = {
  date: string;
  src: string;
  title: string;
  cover: string;
  seconds: number;
  chapters: { title: string; startSec: number }[];
};

type AudioState = {
  track: Track | null;
  now: number;
  duration: number;
  playing: boolean;
  rate: number;
  /** Prépare un épisode sans le lancer (ne change rien si un autre épisode est en cours de lecture). */
  prepare: (t: Track) => void;
  /** Lance un épisode (en change si besoin), éventuellement à une position donnée. */
  play: (t: Track, at?: number) => void;
  toggle: () => void;
  seek: (sec: number) => void;
  skip: (delta: number) => void;
  nextRate: () => void;
};

const Ctx = createContext<AudioState | null>(null);
export const RATES = [1, 1.2, 1.5];
const posKey = (date: string) => `matinale_pos_${date}`;

export function useAudio(): AudioState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudio hors de <AudioProvider>');
  return v;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const el = useRef<HTMLAudioElement>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const pendingSeek = useRef<number | null>(null);

  useEffect(() => {
    try {
      const r = Number(localStorage.getItem('matinale_rate'));
      if (RATES.includes(r)) setRate(r);
    } catch { /* stockage indisponible */ }
  }, []);

  const load = useCallback((t: Track, at?: number) => {
    const a = el.current;
    if (!a) return;
    let start = at ?? 0;
    if (at === undefined) {
      try { const saved = Number(localStorage.getItem(posKey(t.date))); if (saved > 5) start = saved; } catch { /* ignoré */ }
    }
    setTrack(t);
    setDuration(t.seconds);
    setNow(start);
    pendingSeek.current = start;
    a.src = t.src;
    a.load();
  }, []);

  const prepare = useCallback((t: Track) => {
    const a = el.current;
    if (!a) return;
    if (track?.date === t.date) return;      // déjà chargé
    if (track && !a.paused) return;           // ne coupe pas l'épisode en cours
    load(t);
  }, [track, load]);

  const play = useCallback((t: Track, at?: number) => {
    const a = el.current;
    if (!a) return;
    if (track?.date !== t.date) load(t, at);
    else if (at !== undefined) { a.currentTime = at; setNow(at); }
    void a.play();
  }, [track, load]);

  const toggle = useCallback(() => {
    const a = el.current;
    if (!a || !track) return;
    if (a.paused) void a.play(); else a.pause();
  }, [track]);

  const seek = useCallback((sec: number) => {
    const a = el.current;
    if (!a) return;
    const max = Number.isFinite(a.duration) ? a.duration : duration;
    a.currentTime = Math.max(0, Math.min(sec, max || sec));
    setNow(a.currentTime);
  }, [duration]);

  const skip = useCallback((delta: number) => seek((el.current?.currentTime ?? 0) + delta), [seek]);

  const nextRate = useCallback(() => {
    setRate(r => {
      const n = RATES[(RATES.indexOf(r) + 1) % RATES.length];
      try { localStorage.setItem('matinale_rate', String(n)); } catch { /* ignoré */ }
      return n;
    });
  }, []);

  useEffect(() => { if (el.current) el.current.playbackRate = rate; }, [rate, track]);

  // Écran verrouillé / CarPlay / écouteurs.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title, artist: 'La Matinale', artwork: [{ src: track.cover, sizes: '1400x1400', type: 'image/jpeg' }],
    });
    navigator.mediaSession.setActionHandler('play', () => void el.current?.play());
    navigator.mediaSession.setActionHandler('pause', () => el.current?.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-15));
    navigator.mediaSession.setActionHandler('seekforward', () => skip(30));
  }, [track, skip]);

  const onTime = () => {
    const a = el.current;
    if (!a || !track) return;
    setNow(a.currentTime);
    try { localStorage.setItem(posKey(track.date), String(Math.floor(a.currentTime))); } catch { /* ignoré */ }
  };

  return (
    <Ctx.Provider value={{ track, now, duration, playing, rate, prepare, play, toggle, seek, skip, nextRate }}>
      <audio
        ref={el} preload="metadata"
        onTimeUpdate={onTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onLoadedMetadata={e => {
          const a = e.currentTarget;
          if (Number.isFinite(a.duration)) setDuration(a.duration);
          a.playbackRate = rate;
          if (pendingSeek.current) { a.currentTime = pendingSeek.current; pendingSeek.current = null; }
        }}
      />
      {children}
      <MiniPlayer />
    </Ctx.Provider>
  );
}

/** Barre au-dessus des onglets, visible hors de la page Écouter dès qu'un épisode a été lancé. */
function MiniPlayer() {
  const { track, now, duration, playing, toggle, skip } = useAudio();
  const path = usePathname();
  const [started, setStarted] = useState(false);
  useEffect(() => { if (playing) setStarted(true); }, [playing]);
  if (!track || !started || path === '/') return null;
  const pct = duration ? Math.min(100, (now / duration) * 100) : 0;
  return (
    <div className="mini" role="region" aria-label="Lecture en cours">
      <i className="mini-progress" style={{ width: `${pct}%` }} aria-hidden />
      <Link href={`/?date=${track.date}`} className="mini-info">
        <img src={track.cover} alt="" width={40} height={40} />
        <span className="grow"><span className="mini-title">{track.title}</span></span>
      </Link>
      <button type="button" className="mini-btn" onClick={() => skip(-15)} aria-label="Reculer de 15 secondes"><Icon name="back" size={22} /></button>
      <button type="button" className="mini-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
        <Icon name={playing ? 'pause' : 'play'} size={22} />
      </button>
    </div>
  );
}
