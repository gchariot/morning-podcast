/**
 * Appel d'une action serveur depuis le téléphone, sans jamais faire planter l'appli :
 * dans le train, une coupure réseau doit donner un message, pas un écran d'erreur (ni couper le son).
 */
export type Result = { ok: boolean; message: string };

export const OFFLINE = 'Pas de réseau : rien n’a été envoyé. Réessaie dès que ça capte.';
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

/** Flèches dans un groupe de choix (role=radio) : déplace le focus d'un choix à l'autre. */
export function radioKeys(e: { key: string; currentTarget: HTMLElement; preventDefault: () => void }) {
  const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
  if (!dir) return;
  const group = e.currentTarget.closest('[role=radiogroup]');
  const items = group ? Array.from(group.querySelectorAll<HTMLElement>('[role=radio]:not(:disabled)')) : [];
  const i = items.indexOf(e.currentTarget);
  if (i < 0 || !items.length) return;
  e.preventDefault();
  items[(i + dir + items.length) % items.length].focus();
}

/** Typographie française : espace fine insécable avant ? ! : ; (évite « collège / ? » en fin de ligne). */
export function fr(text: string): string {
  return text.replace(/\s+([?!:;»])/g, '\u202f$1').replace(/«\s+/g, '«\u202f');
}
