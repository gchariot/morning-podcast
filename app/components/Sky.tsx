'use client';
/**
 * Le bandeau ciel : la pochette, à l'heure qu'il est à Genève.
 * Lever et coucher réels (lib/sky.ts) ; une heure avant le lever, l'horizon s'éclaire et le soleil affleure.
 */
import { useEffect, useState } from 'react';
import { clock, seaColor, skyAt, sunTimes, untilWriting, zurichMinutes } from '@/lib/sky';

// Ciel étoilé fixe (positions pseudo-aléatoires mais stables), comme sur la pochette.
const STARS = Array.from({ length: 46 }, (_, i) => {
  const x = (i * 37.7 + 11) % 100, y = (i * 53.3 + 7) % 78, r = 0.8 + ((i * 7) % 5) * 0.25;
  return `radial-gradient(${r}px ${r}px at ${x.toFixed(1)}% ${y.toFixed(1)}%, #fff 60%, transparent 100%)`;
}).join(',');

export function SkyBand({ minutes: initial, tall = false, sunrise = false, children }: {
  minutes: number; tall?: boolean; sunrise?: boolean; children: React.ReactNode;
}) {
  const [m, setM] = useState(initial);
  useEffect(() => {
    const tick = () => setM(zurichMinutes());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  const s = skyAt(m);
  const { rise } = sunTimes();
  // Hauteur du soleil : 0 posé sur la mer (comme sur la pochette), 1 en haut du ciel, négatif = couché.
  // Juste avant le lever (soleil entre 1 et 1,04), le bord affleure au-dessus de la mer.
  const height = s.sun <= 1 ? 1 - s.sun : s.sun <= 1.04 ? -(s.sun - 1) * 4 : -(s.sun - 1) * 12;
  // Reflets : pleins quand le soleil est bas sur l'eau, absents quand il est haut ;
  // avant le lever, une seule braise sous le bord du soleil.
  const glints = s.sun > 1.04 ? 0 : s.sun > 1 ? 0.6 : Math.max(0, Math.min(0.9, ((s.sun - 0.3) / 0.4) * 0.9));
  // Tant que le soleil n'est pas levé, la mer reste fine : il n'y a rien à refléter.
  const night = s.sun > 1;
  const vars = {
    '--sky-top': s.top, '--sky-mid': s.mid, '--sky-horizon': s.horizon,
    '--rise': height.toFixed(3), '--stars': s.stars.toFixed(2), '--glints': glints.toFixed(2),
    '--sea': night ? '20px' : '40px', '--sea-color': seaColor(s.sun),
  } as React.CSSProperties;
  return (
    <header className={`sky${tall ? ' tall' : ''}${s.sun > 1 ? ' predawn' : ''}`} style={vars}>
      <div className="sky-stars" style={{ backgroundImage: STARS }} aria-hidden />
      <span className="sky-sun" aria-hidden />
      <span className="sky-sea" aria-hidden><i /><i /><i /><i /><i /><i /><i /></span>
      <div className="sky-content">
        {children}
        {sunrise && m < rise && m > rise - 360 && <p className="sky-note">Lever du soleil à {clock(rise)}</p>}
      </div>
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
