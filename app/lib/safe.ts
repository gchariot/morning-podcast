/**
 * Appel d'une action serveur depuis le téléphone, sans jamais faire planter l'appli :
 * dans le train, une coupure réseau doit donner un message, pas un écran d'erreur (ni couper le son).
 */
export type Result = { ok: boolean; message: string };

export const OFFLINE = 'Pas de réseau : rien n’a été envoyé. Réessaie dès que ça capte, l’écoute continue.';
const FAILED = 'Le serveur n’a pas répondu : rien n’a été enregistré. Réessaie dans un instant.';

export async function safeCall<T extends Result>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, message: OFFLINE } as T;
  try {
    return await fn();
  } catch {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return { ok: false, message: offline ? OFFLINE : FAILED } as T;
  }
}
