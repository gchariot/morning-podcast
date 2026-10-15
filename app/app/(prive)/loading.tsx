'use client';
// Squelette affiché pendant le chargement d'un onglet : le ciel est déjà là, à la bonne heure.
import { SkyBand } from '@/components/Sky';
import { zurichMinutes } from '@/lib/sky';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <SkyBand minutes={zurichMinutes()}>
        <div className="sk sk-sky" style={{ width: '55%', height: 30 }} />
        <div className="sk sk-sky" style={{ width: '80%', height: 16, marginTop: 12 }} />
      </SkyBand>
      <div className="sk" style={{ height: 180, borderRadius: 14 }} />
      <div className="sk" style={{ height: 120, marginTop: 16, borderRadius: 14 }} />
    </div>
  );
}
