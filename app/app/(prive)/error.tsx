'use client';
/** Un écran qui ne charge pas reste dans l'appli : les onglets et l'épisode en cours continuent. */
import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  useEffect(() => { setOffline(!navigator.onLine); }, []);

  return (
    <div className="page-head" role="alert">
      <h1>Cet écran n&apos;a pas pu se charger</h1>
      <p>
        {offline
          ? 'Pas de réseau pour le moment. L’épisode en cours continue ; réessaie quand ça capte.'
          : 'Le serveur n’a pas répondu. L’épisode en cours continue ; réessaie dans un instant.'}
      </p>
      <button
        type="button" className="btn primary" style={{ marginTop: 16 }}
        onClick={() => startTransition(() => { router.refresh(); reset(); })}
      >
        Réessayer
      </button>
    </div>
  );
}
