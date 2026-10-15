'use client';
/**
 * Un seul langage de confirmation pour toute l'appli : un message en bas d'écran, près du pouce,
 * avec « Annuler » quand l'action peut être défaite.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';

/** `undo` affiche « Annuler » ; `action` affiche un autre bouton (ex. « Envoyer »). */
export type Snack = { message: string; ok: boolean; undo?: () => void; action?: { label: string; run: () => void } };
type SnackApi = { show: (s: Snack) => void; close: () => void; closeErrors: () => void };

const Ctx = createContext<SnackApi | null>(null);

export function useSnack(): SnackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSnack hors de <SnackProvider>');
  return v;
}

export function SnackProvider({ children }: { children: React.ReactNode }) {
  const [snack, setSnack] = useState<(Snack & { id: number }) | null>(null);
  const close = useCallback(() => setSnack(null), []);
  const show = useCallback((s: Snack) => setSnack({ ...s, id: Date.now() }), []);
  const closeErrors = useCallback(() => setSnack(s => (s && !s.ok ? null : s)), []);
  const api = useMemo(() => ({ show, close, closeErrors }), [show, close, closeErrors]);

  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(close, snack.undo || snack.action ? 8000 : snack.ok ? 4000 : 7000);
    return () => clearTimeout(t);
  }, [snack, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" aria-atomic="true">
        {snack && (
          <div key={snack.id} className={`snack${snack.ok ? '' : ' err'}`}>
            {snack.ok && <Icon name="check" size={18} />}
            <p>{snack.message}</p>
            {snack.undo || snack.action
              ? <button type="button" className="btn small" onClick={() => { (snack.undo ?? snack.action!.run)(); close(); }}>{snack.undo ? 'Annuler' : snack.action!.label}</button>
              : <button type="button" className="btn small icon" onClick={close} aria-label="Fermer"><Icon name="x" size={16} /></button>}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
