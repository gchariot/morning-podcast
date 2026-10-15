'use client';
/** Le bouton « Donner mon avis » d'Écouter : il suit l'état (déjà envoyé) et s'efface quand la fin d'épisode le propose déjà. */
import Link from 'next/link';
import { Icon } from './Icon';
import { useAudio } from './Audio';

export function FeedbackCta({ date, sent }: { date: string; sent: boolean }) {
  const { track, ended } = useAudio();
  if (ended && track?.date === date) return null; // la carte « C'est fini » propose déjà l'avis
  return sent
    ? <Link className="btn block cta ghost-cta" href="/avis"><Icon name="check" size={18} /> Avis envoyé pour demain · Modifier</Link>
    : <Link className="btn block cta" href="/avis"><Icon name="message" size={18} /> Donner mon avis pour demain</Link>;
}
