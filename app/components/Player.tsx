'use client';
import { useEffect, useRef, useState } from 'react';

type Chapter = { title: string; startSec: number };

const hms = (s: number) => {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export function Player({ src, title, chapters, storageKey }: { src: string; title: string; chapters: Chapter[]; storageKey: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  const [rate, setRate] = useState(1);

  // Reprend là où tu t'étais arrêté (stockage local, facultatif).
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved > 5) el.currentTime = saved;
      const savedRate = Number(localStorage.getItem('matinale_rate'));
      if (savedRate) { el.playbackRate = savedRate; setRate(savedRate); }
    } catch { /* stockage indisponible : on démarre au début */ }
  }, [storageKey]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'La Matinale' });
  }, [title]);

  const onTime = () => {
    const t = audio.current?.currentTime ?? 0;
    setNow(t);
    try { localStorage.setItem(storageKey, String(Math.floor(t))); } catch { /* ignoré */ }
  };

  const jump = (sec: number) => {
    if (!audio.current) return;
    audio.current.currentTime = sec;
    void audio.current.play();
  };

  const changeRate = (r: number) => {
    if (audio.current) audio.current.playbackRate = r;
    setRate(r);
    try { localStorage.setItem('matinale_rate', String(r)); } catch { /* ignoré */ }
  };

  const current = chapters.reduce((idx, c, i) => (now >= c.startSec ? i : idx), 0);

  return (
    <div className="player">
      <audio ref={audio} src={src} controls preload="metadata" onTimeUpdate={onTime} />
      <div className="speeds" role="group" aria-label="Vitesse de lecture">
        {[1, 1.2, 1.5].map(r => (
          <button key={r} type="button" className="btn small" aria-pressed={rate === r} onClick={() => changeRate(r)}
            style={rate === r ? { borderColor: 'var(--dawn)' } : undefined}>
            ×{r}
          </button>
        ))}
      </div>
      {chapters.length > 0 && (
        <ul className="chapters" style={{ marginTop: 16 }}>
          {chapters.map((c, i) => (
            <li key={c.title + c.startSec}>
              <button type="button" aria-current={i === current ? 'true' : undefined} onClick={() => jump(c.startSec)}>
                <span>{c.title}</span>
                <time>{hms(c.startSec)}</time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
