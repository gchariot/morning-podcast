'use client';
/**
 * Le bandeau ciel : la pochette, à l'heure qu'il est à Genève.
 * Nuit étoilée avant 6 h, aube vers 6 h 30, jour, soir ; le soleil monte de la mer et s'y reflète.
 */
import { useEffect, useState } from 'react';
import { skyAt, untilWriting, zurichMinutes } from '@/lib/sky';

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
  const vars = {
    '--sky-top': s.top, '--sky-mid': s.mid, '--sky-horizon': s.horizon,
    // --sun : hauteur du soleil (un nombre), pas sa couleur.
    '--sun': s.sun.toFixed(3), '--stars': s.stars.toFixed(2),
    // Lever : 0 sur l'horizon, 1 en haut de la bande ; négatif = sous la mer (nuit).
    '--rise': (s.sun <= 1 ? 1 - s.sun : -(s.sun - 1) * 8).toFixed(3),
    '--glints': Math.max(0, Math.min(1, 1.15 - s.sun)).toFixed(2),
  } as React.CSSProperties;
  return (
    <header className={`sky${tall ? ' tall' : ''}`} style={vars}>
      <div className="sky-stars" aria-hidden />
      <div className="sky-content">{children}</div>
      <div className="sky-horizon" aria-hidden>
        <span className="sky-sun" />
        <span className="sky-sea"><i /><i /><i /><i /><i /></span>
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

/** Les trois voix de l'émission, chacune avec sa couleur. */
export function Cast({ withZoe = true }: { withZoe?: boolean }) {
  return (
    <ul className="cast" aria-label="Les voix de l'épisode">
      <li><span className="voice-dot lea" aria-hidden />Léa</li>
      <li><span className="voice-dot hugo" aria-hidden />Hugo</li>
      {withZoe && <li><span className="voice-dot zoe" aria-hidden />Zoé, la météo</li>}
    </ul>
  );
}
