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
  /** L'épisode chargé est arrivé au bout (pour proposer l'avis du jour). */
  ended: boolean;
  /** L'épisode n'a pas pu être chargé ou lancé (réseau). */
  failed: boolean;
  /** Lecture demandée mais le son attend des données (tunnel, saut hors de la partie chargée). */
  buffering: boolean;
  /** L'épisode est mis en pause le temps d'une dictée (« Dis-le »). */
  held: boolean;
  setHeld: (v: boolean) => void;
  rate: number;
  /** Index du chapitre en cours (-1 avant le début). */
  chapter: number;
  /** Épisode affiché sur la page Écouter (le mini-lecteur se montre si un autre joue). */
  shown: string | null;
  setShown: (date: string | null) => void;
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
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [held, setHeld] = useState(false);
  // Un échec de lecture est dit, jamais silencieux.
  const start = useCallback((a: HTMLAudioElement) => {
    setFailed(false);
    a.play().catch((e: unknown) => { if (!(e instanceof DOMException && e.name === 'AbortError')) setFailed(true); });
  }, []);
  const [shown, setShown] = useState<string | null>(null);
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
    setEnded(false);
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
    start(a);
  }, [track, load, start]);

  const toggle = useCallback(() => {
    const a = el.current;
    if (!a || !track) return;
    if (a.paused) {
      if (failed) { const t = a.currentTime; a.load(); pendingSeek.current = t || now; }
      start(a);
    } else a.pause();
  }, [track, failed, now, start]);

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

  const chapters = track?.chapters ?? [];
  const chapter = chapters.reduce((idx, c, i) => (now >= c.startSec ? i : idx), -1);

  /** Écouteurs : chapitre suivant / précédent (le précédent revient d'abord au début du chapitre en cours). */
  const nextChapter = useCallback(() => {
    const a = el.current;
    if (!a || !track) return;
    const t = a.currentTime;
    const next = track.chapters.find(c => c.startSec > t + 1);
    if (next) seek(next.startSec);
  }, [track, seek]);
  const prevChapter = useCallback(() => {
    const a = el.current;
    if (!a || !track) return;
    const t = a.currentTime;
    const starts = track.chapters.map(c => c.startSec).filter(s => s <= t);
    const cur = starts.length ? starts[starts.length - 1] : 0;
    seek(t - cur > 4 ? cur : (starts.length > 1 ? starts[starts.length - 2] : 0));
  }, [track, seek]);

  // Écran verrouillé / CarPlay / écouteurs.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => { if (el.current) start(el.current); }],
      ['pause', () => el.current?.pause()],
      ['seekbackward', d => skip(-(d.seekOffset ?? 15))],
      ['seekforward', d => skip(d.seekOffset ?? 30)],
      ['seekto', d => { if (d.seekTime !== undefined) seek(d.seekTime); }],
      ['nexttrack', () => nextChapter()],
      ['previoustrack', () => prevChapter()],
    ];
    for (const [action, fn] of handlers) {
      try { ms.setActionHandler(action, fn); } catch { /* action non prise en charge */ }
    }
  }, [track, skip, seek, nextChapter, prevChapter, start]);

  // Titre affiché sur l'écran verrouillé : l'épisode, et le chapitre en cours.
  const chapterTitle = chapter >= 0 ? chapters[chapter]?.title : undefined;
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapterTitle ? `${chapterTitle} · La Matinale` : track.title,
      artist: 'La Matinale',
      album: track.title,
      artwork: [{ src: track.cover, sizes: '1400x1400', type: 'image/jpeg' }],
    });
  }, [track, chapterTitle]);

  // Barre de progression de l'écran verrouillé.
  const syncPosition = useCallback(() => {
    const a = el.current;
    if (!a || !('mediaSession' in navigator) || !Number.isFinite(a.duration)) return;
    try { navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: a.playbackRate || 1 }); } catch { /* ignoré */ }
  }, []);

  const onTime = () => {
    const a = el.current;
    if (!a || !track) return;
    setNow(a.currentTime);
    if (buffering && !a.paused && a.readyState >= 3) setBuffering(false);
    if (Math.floor(a.currentTime) % 5 === 0) syncPosition();
    try { localStorage.setItem(posKey(track.date), String(Math.floor(a.currentTime))); } catch { /* ignoré */ }
  };

  return (
    <Ctx.Provider value={{ track, now, duration, playing, ended, failed, buffering, held, setHeld, rate, chapter, shown, setShown, prepare, play, toggle, seek, skip, nextRate }}>
      <audio
        ref={el} preload="metadata"
        onTimeUpdate={onTime} onPlay={() => { setPlaying(true); setEnded(false); syncPosition(); }} onPause={() => { setPlaying(false); setBuffering(false); syncPosition(); }}
        onWaiting={e => { if (!e.currentTarget.paused) setBuffering(true); }} onPlaying={() => setBuffering(false)}
        onEnded={() => { setPlaying(false); setBuffering(false); setEnded(true); }} onError={() => { if (track) setFailed(true); }} onSeeked={syncPosition} onRateChange={syncPosition}
        onLoadedMetadata={e => {
          const a = e.currentTarget;
          if (Number.isFinite(a.duration)) setDuration(a.duration);
          a.playbackRate = rate;
          if (pendingSeek.current) { a.currentTime = pendingSeek.current; pendingSeek.current = null; }
          syncPosition();
        }}
      />
      {children}
      <MiniPlayer />
    </Ctx.Provider>
  );
}

/** Barre au-dessus des onglets, visible dès qu'un épisode a été lancé, sauf sur sa propre page. */
function MiniPlayer() {
  const { track, now, duration, playing, ended, buffering, held, shown, toggle, skip } = useAudio();
  const path = usePathname();
  const [started, setStarted] = useState(false);
  useEffect(() => { if (playing) setStarted(true); }, [playing]);
  if (!track || !started) return null;
  if (path === '/' && shown === track.date) return null;
  const pct = duration ? Math.min(100, (now / duration) * 100) : 0;
  const left = Math.max(0, Math.round((duration - now) / 60));
  return (
    <div className="mini" role="region" aria-label="Lecture en cours">
      <i className="mini-progress" style={{ width: `${pct}%` }} aria-hidden />
      <Link href={`/?date=${track.date}`} className="mini-info">
        <img src={track.cover} alt="" width={40} height={40} />
        <span className="grow">
          <span className="mini-title">{track.title}</span>
          <span className="mini-meta num">{ended ? 'Terminé' : held ? 'En pause pendant que tu parles' : buffering ? 'En attente du réseau…' : `${left} min restantes`}</span>
        </span>
      </Link>
      {ended
        ? <Link href="/avis" className="btn small primary" style={{ flex: 'none' }}>Ton avis ?</Link>
        : <>
            <button type="button" className="mini-btn skipper" onClick={() => skip(-15)} aria-label="Reculer de 15 secondes">
              <Icon name="back" size={22} /><span aria-hidden>15</span>
            </button>
            <button type="button" className="mini-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
              <Icon name={playing ? 'pause' : 'play'} size={22} />
            </button>
            <button type="button" className="mini-btn skipper" onClick={() => skip(30)} aria-label="Avancer de 30 secondes">
              <Icon name="forward" size={22} /><span aria-hidden>30</span>
            </button>
          </>}
    </div>
  );
}
