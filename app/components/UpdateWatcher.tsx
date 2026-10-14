'use client';
/**
 * 1. Prévient quand une nouvelle version de l'app est en ligne (bandeau « Mettre à jour »).
 * 2. Quand l'app revient au premier plan après un moment (le matin), recharge les données
 *    pour afficher le nouvel épisode, sans couper un épisode en cours de lecture.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAudio } from './Audio';

const CHECK_EVERY = 5 * 60 * 1000;      // vérification de version toutes les 5 min
const STALE_AFTER = 10 * 60 * 1000;     // données rafraîchies si l'app est restée cachée 10 min

export function UpdateWatcher() {
  const router = useRouter();
  const { playing } = useAudio();
  const [update, setUpdate] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const { version } = (await res.json()) as { version?: string };
        if (version && version !== process.env.APP_VERSION) setUpdate(true);
      } catch { /* hors ligne : on réessaiera */ }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return; }
      void check();
      if (hiddenAt.current && Date.now() - hiddenAt.current > STALE_AFTER) router.refresh();
      hiddenAt.current = null;
    };
    void check();
    const timer = setInterval(check, CHECK_EVERY);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [router]);

  if (!update) return null;
  return (
    <div className="update" role="status">
      <span className="grow">
        <strong>Nouvelle version de l&apos;app</strong>
        <span className="meta">{playing ? 'Recharger coupera l’épisode (tu reprendras au même endroit).' : 'Recharge pour en profiter.'}</span>
      </span>
      <button type="button" className="btn small primary" onClick={() => window.location.reload()}>Mettre à jour</button>
      <button type="button" className="btn icon" aria-label="Plus tard" onClick={() => setUpdate(false)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
