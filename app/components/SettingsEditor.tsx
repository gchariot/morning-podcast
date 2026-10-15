'use client';
/** Réglages enregistrés dès qu'ils changent (comme les thèmes) : pas de bouton à chercher. */
import { useEffect, useRef, useState } from 'react';
import { Stepper } from './Stepper';
import { useSnack } from './Snack';
import { saveSettings } from '@/app/(prive)/actions';
import { safeCall } from '@/lib/safe';

type Key = 'targetMinutes' | 'samedi' | 'dimanche';
const LIMITS: Record<Key, [number, number]> = { targetMinutes: [3, 40], samedi: [10, 40], dimanche: [5, 30] };

export function SettingsEditor({ initial }: { initial: Record<Key, number> & { sujet: string } }) {
  const [values, setValues] = useState<Record<Key, number>>(initial);
  const saved = useRef<Record<Key, number>>(initial);
  const timers = useRef<Partial<Record<Key, ReturnType<typeof setTimeout>>>>({});
  const [sujet, setSujet] = useState(initial.sujet);
  const sujetSaved = useRef(initial.sujet);
  const { show } = useSnack();

  useEffect(() => () => Object.values(timers.current).forEach(t => t && clearTimeout(t)), []);

  // Enregistre une fois que le pouce s'est arrêté sur une valeur.
  const change = (k: Key, v: number) => {
    setValues(x => ({ ...x, [k]: v }));
    clearTimeout(timers.current[k]);
    timers.current[k] = setTimeout(async () => {
      if (saved.current[k] === v) return;
      const res = await safeCall(() => saveSettings({ [k]: v }));
      show({ ok: res.ok, message: res.message });
      if (res.ok) saved.current = { ...saved.current, [k]: v };
      else setValues(x => ({ ...x, [k]: saved.current[k] }));
    }, 700);
  };

  const saveSujet = async () => {
    if (sujet.trim() === sujetSaved.current.trim()) return;
    const res = await safeCall(() => saveSettings({ sujet }));
    show({ ok: res.ok, message: res.message });
    if (res.ok) sujetSaved.current = sujet;
  };

  const row = (k: Key, title: string, hint?: string) => (
    <div className="item setting">
      <span className="grow">
        <span id={`lbl-${k}`} style={{ fontWeight: 500, display: 'block' }}>{title}</span>
        {hint && <span className="meta">{hint}</span>}
      </span>
      <Stepper value={values[k]} min={LIMITS[k][0]} max={LIMITS[k][1]} onChange={v => change(k, v)} labelledBy={`lbl-${k}`} />
    </div>
  );

  return (
    <>
      <div className="group">{row('targetMinutes', 'Durée en semaine', 'Du lundi au vendredi')}</div>

      <section className="section" style={{ marginTop: 28 }}>
        <h2>Samedi : la grande édition</h2>
        <p className="hint">La semaine en 3 minutes, le face-à-face, le jeu de la semaine, le guide du week-end, puis la météo du week-end.</p>
        <div className="group">{row('samedi', 'Durée')}</div>
      </section>

      <section className="section" style={{ marginTop: 28 }}>
        <h2>Dimanche : le documentaire</h2>
        <p className="hint">Un seul sujet de culture générale, raconté en plusieurs actes, puis la météo. Pas d&apos;actualité ce jour-là.</p>
        <div className="group">
          {row('dimanche', 'Durée')}
          <form className="pad" onSubmit={e => { e.preventDefault(); void saveSujet(); }}>
            <label htmlFor="dimanche_sujet">Sujet souhaité (facultatif)</label>
            <input id="dimanche_sujet" type="text" maxLength={200} value={sujet} onChange={e => setSujet(e.target.value)} onBlur={() => void saveSujet()}
              placeholder="Ex. : le percement du tunnel du Gothard" enterKeyHint="done" />
            <p className="field-hint">Vide : la rédaction choisit, sans refaire un sujet déjà traité.</p>
          </form>
        </div>
      </section>
    </>
  );
}
