'use client';
/**
 * Hors connexion (tunnel, zone blanche) : un bandeau discret, et les liens internes ne quittent pas la page.
 * Sans ça, le navigateur tente un chargement complet, affiche sa page d'erreur et coupe l'épisode.
 * Au retour du réseau, les messages d'erreur périmés disparaissent.
 */
import { useEffect, useState } from 'react';
import { useSnack } from './Snack';
import { useAudio } from './Audio';

/** État du réseau, mis à jour en direct. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

export function Connectivity() {
  const online = useOnline();
  const { show, closeErrors } = useSnack();
  const { playing, buffering } = useAudio();

  useEffect(() => { if (online) closeErrors(); }, [online, closeErrors]);

  useEffect(() => {
    // Phase de capture : passe avant la navigation de Next.
    const onClick = (e: MouseEvent) => {
      if (navigator.onLine) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank') return;
      if (new URL(a.href, location.href).origin !== location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      show({ ok: false, message: `Pas de réseau : réessaie dès que ça capte.${playing && !buffering ? ' L’écoute continue.' : ''}` });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [show, playing, buffering]);

  if (online) return null;
  return (
    <div className={`offline${playing && buffering ? ' waiting' : ''}`} role="status">
      Hors connexion{playing ? (buffering ? ' · le son attend le réseau' : ' · l’écoute continue') : ''}
    </div>
  );
}
