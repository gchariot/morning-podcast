'use client';
/**
 * Hors connexion (tunnel, zone blanche) : un bandeau discret, et les liens internes ne quittent pas la page.
 * Sans ça, le navigateur tente un chargement complet, affiche sa page d'erreur et coupe l'épisode.
 */
import { useEffect, useState } from 'react';
import { useSnack } from './Snack';

export function Connectivity() {
  const [online, setOnline] = useState(true);
  const { show } = useSnack();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    // Phase de capture : passe avant la navigation de Next.
    const onClick = (e: MouseEvent) => {
      if (navigator.onLine) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank') return;
      if (new URL(a.href, location.href).origin !== location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      show({ ok: false, message: 'Pas de réseau : cet écran s’ouvrira quand ça captera. L’écoute continue.' });
    };
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      document.removeEventListener('click', onClick, true);
    };
  }, [show]);

  if (online) return null;
  return (
    <div className="offline" role="status">
      Hors connexion · l&apos;écoute continue avec ce qui est déjà chargé
    </div>
  );
}
