'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

type Chapter = { title: string; startSec: number };

const hms = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};
const RATES = [1, 1.2, 1.5];

export function Player({ src, title, chapters, storageKey, fallbackSeconds }: {
  src: string; title: string; chapters: Chapter[]; storageKey: string; fallbackSeconds: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(fallbackSeconds);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);

  // Reprend là où tu t'étais arrêté (stockage local, facultatif).
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved > 5) { el.currentTime = saved; setNow(saved); }
      const savedRate = Number(localStorage.getItem('matinale_rate'));
      if (RATES.includes(savedRate)) { el.playbackRate = savedRate; setRate(savedRate); }
    } catch { /* stockage indisponible : on démarre au début */ }
  }, [storageKey]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'La Matinale' });
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-15));
    navigator.mediaSession.setActionHandler('seekforward', () => skip(30));
  }, [title]);

  const onTime = () => {
    const t = audio.current?.currentTime ?? 0;
    setNow(t);
    try { localStorage.setItem(storageKey, String(Math.floor(t))); } catch { /* ignoré */ }
  };

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play(); else el.pause();
  };
  const seek = (sec: number) => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(sec, duration || sec));
    setNow(el.currentTime);
  };
  const skip = (delta: number) => seek((audio.current?.currentTime ?? 0) + delta);
  const jump = (sec: number) => { seek(sec); void audio.current?.play(); };

  const nextRate = () => {
    const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    if (audio.current) audio.current.playbackRate = r;
    setRate(r);
    try { localStorage.setItem('matinale_rate', String(r)); } catch { /* ignoré */ }
  };

  const current = chapters.reduce((idx, c, i) => (now >= c.startSec ? i : idx), 0);
  const pct = duration ? Math.min(100, (now / duration) * 100) : 0;

  return (
    <>
      <div className="player">
        <audio
          ref={audio} src={src} preload="metadata"
          onTimeUpdate={onTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onLoadedMetadata={e => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        />
        <input
          className="scrub" type="range" min={0} max={Math.max(1, Math.floor(duration))} step={1}
          value={Math.floor(now)} onChange={e => seek(Number(e.target.value))}
          aria-label="Position dans l'épisode" aria-valuetext={`${hms(now)} sur ${hms(duration)}`}
          style={{ ['--p' as string]: `${pct}%` }}
        />
        <div className="times"><time>{hms(now)}</time><time>−{hms(duration - now)}</time></div>
        <div className="controls">
          <span />
          <button type="button" className="skip" onClick={() => skip(-15)} aria-label="Reculer de 15 secondes">
            <Icon name="back" size={30} /><span aria-hidden>15</span>
          </button>
          <button type="button" className="playbtn" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
            <Icon name={playing ? 'pause' : 'play'} size={26} />
          </button>
          <button type="button" className="skip" onClick={() => skip(30)} aria-label="Avancer de 30 secondes">
            <Icon name="forward" size={30} /><span aria-hidden>30</span>
          </button>
          <button type="button" className="rate" onClick={nextRate} aria-label={`Vitesse ×${rate}, changer`}>×{rate}</button>
        </div>
      </div>

      {chapters.length > 0 && (
        <section className="section">
          <h2>Chapitres</h2>
          <ul className="chapters group" style={{ marginTop: 12 }}>
            {chapters.map((c, i) => (
              <li key={c.title + c.startSec}>
                <button type="button" aria-current={i === current ? 'true' : undefined} onClick={() => jump(c.startSec)}>
                  <span className="dot" aria-hidden />
                  <span className="grow">{c.title}</span>
                  <time>{hms(c.startSec)}</time>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
