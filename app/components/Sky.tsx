'use client';
/**
 * Le bandeau ciel : la pochette, à l'heure qu'il est à Genève.
 * Nuit étoilée avant 6 h, aube vers 6 h 30, jour, soir ; le soleil monte de la mer et s'y reflète.
 */
import { useEffect, useState } from 'react';
import { skyAt, untilWriting, zurichMinutes } from '@/lib/sky';

// Ciel étoilé fixe (positions pseudo-aléatoires mais stables), comme sur la pochette.
const STARS = Array.from({ length: 46 }, (_, i) => {
  const x = (i * 37.7 + 11) % 100, y = (i * 53.3 + 7) % 78, r = 0.8 + ((i * 7) % 5) * 0.25;
  return `radial-gradient(${r}px ${r}px at ${x.toFixed(1)}% ${y.toFixed(1)}%, #fff 60%, transparent 100%)`;
}).join(',');

export function SkyBand({ minutes: initial, tall = false, children }: {
  minutes: number; tall?: boolean; children: React.ReactNode;
}) {
  const [m, setM] = useState(initial);
  useEffect(() => {
    const tick = () => setM(zurichMinutes());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  const s = skyAt(m);
  // Hauteur du soleil : 0 posé sur la mer (comme sur la pochette), 1 en haut du ciel, négatif = couché.
  const rise = s.sun <= 1 ? 1 - s.sun : -(s.sun - 1) * 12;
  const vars = {
    '--sky-top': s.top, '--sky-mid': s.mid, '--sky-horizon': s.horizon,
    '--rise': rise.toFixed(3), '--stars': s.stars.toFixed(2),
    '--glints': (s.sun < 1 ? 0.9 : Math.max(0, 0.9 - (s.sun - 1) * 30)).toFixed(2),
  } as React.CSSProperties;
  return (
    <header className={`sky${tall ? ' tall' : ''}`} style={vars}>
      <div className="sky-stars" style={{ backgroundImage: STARS }} aria-hidden />
      <span className="sky-sun" aria-hidden />
      <span className="sky-sea" aria-hidden><i /><i /><i /><i /><i /><i /><i /></span>
      <div className="sky-content">{children}</div>
    </header>
  );
}

/** « Prochaine rédaction dans 16 h 20 », recalculé chaque minute. */
export function NextWriting({ minutes: initial }: { minutes: number }) {
  const [m, setM] = useState(initial);
  useEffect(() => {
    const tick = () => setM(zurichMinutes());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return <>Prochaine rédaction {untilWriting(m)}</>;
}
