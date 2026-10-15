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

export function UpdateWatcher({ version: mine }: { version: string }) {
  const router = useRouter();
  const { playing } = useAudio();
  const [update, setUpdate] = useState(false);
  const [reloading, setReloading] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // Retire le paramètre technique ?maj=… ajouté par le bouton « Mettre à jour ».
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('maj')) {
      url.searchParams.delete('maj');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const { version } = (await res.json()) as { version?: string };
        if (version && mine !== 'dev' && version !== mine) setUpdate(true);
      } catch { /* hors ligne : on réessaiera */ }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return; }
      void check();
      if (hiddenAt.current && Date.now() - hiddenAt.current > STALE_AFTER && navigator.onLine) router.refresh();
      hiddenAt.current = null;
    };
    void check();
    const timer = setInterval(check, CHECK_EVERY);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [router, mine]);

  if (!update) return null;
  return (
    <div className="update" role="status">
      <span className="grow">
        <strong>Nouvelle version de l&apos;app</strong>
        <span className="meta">{playing ? 'Recharger coupera l’épisode (tu reprendras au même endroit).' : 'Recharge pour en profiter.'}</span>
      </span>
      <button
        type="button" className="btn small primary" disabled={reloading} aria-busy={reloading}
        onClick={() => {
          setReloading(true);
          // Rechargement complet depuis le serveur (contourne le cache de l'app ajoutée à l'écran d'accueil).
          const url = new URL(window.location.href);
          url.searchParams.set('maj', Date.now().toString(36));
          window.location.replace(url.toString());
        }}
      >
        {reloading ? 'Mise à jour…' : 'Mettre à jour'}
      </button>
      <button type="button" className="btn icon" aria-label="Plus tard" onClick={() => setUpdate(false)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
