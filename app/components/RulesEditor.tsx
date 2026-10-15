'use client';
/** Consignes permanentes : ajout sur place, retrait annulable (même langage que les thèmes). */
import { useState } from 'react';
import { Icon } from './Icon';
import { useSnack } from './Snack';
import { addRule, removeRule, restoreRule } from '@/app/(prive)/actions';
import { safeCall } from '@/lib/safe';

export function RulesEditor({ initial }: { initial: string[] }) {
  const [rules, setRules] = useState(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { show } = useSnack();

  const add = async () => {
    if (text.trim().length < 3) { setError('Écris au moins quelques mots.'); return; }
    setBusy(true); setError(null);
    const res = await safeCall(() => addRule(text));
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    if (res.permanent) setRules(res.permanent);
    setText('');
    show({ ok: true, message: res.message });
  };

  const remove = async (rule: string) => {
    const before = rules;
    setRules(rules.filter(r => r !== rule));
    const res = await safeCall(() => removeRule(rule));
    if (!res.ok) { setRules(before); show({ ok: false, message: res.message }); return; }
    if (res.permanent) setRules(res.permanent);
    const index = res.index ?? 0;
    show({
      ok: true, message: res.message,
      undo: async () => {
        const back = await safeCall(() => restoreRule(rule, index));
        if (back.permanent) setRules(back.permanent);
        show({ ok: back.ok, message: back.message });
      },
    });
  };

  const n = rules.length;
  return (
    <details className="group">
      <summary className="item">
        <span className="grow">
          <span style={{ fontWeight: 600, display: 'block' }}>Consignes permanentes</span>
          <span className="meta">
            {n ? `${n} consigne${n > 1 ? 's' : ''} appliquée${n > 1 ? 's' : ''} à chaque épisode` : 'Appliquées à chaque épisode, jusqu’à ce que tu les retires'}
          </span>
        </span>
        <Icon name="chevron-right" className="chev" />
      </summary>
      {rules.map(rule => (
        <div key={rule} className="item">
          <span className="grow">{rule}</span>
          <button className="btn icon danger" type="button" onClick={() => remove(rule)} aria-label={`Retirer : ${rule}`} title="Retirer" disabled={busy}>
            <Icon name="x" size={18} />
          </button>
        </div>
      ))}
      <form className="pad" onSubmit={e => { e.preventDefault(); void add(); }} noValidate>
        <label htmlFor="new-rule">Nouvelle consigne</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input id="new-rule" type="text" value={text} maxLength={200} onChange={e => { setText(e.target.value); setError(null); }}
            placeholder="Ex. : politique monde, 2 sujets maximum" enterKeyHint="send" aria-invalid={Boolean(error)} />
          <button className="btn primary" type="submit" disabled={busy || !text.trim()} aria-busy={busy}>{busy ? '…' : 'Ajouter'}</button>
        </div>
        {error && <p className="field-error" role="alert" style={{ marginTop: 6 }}>{error}</p>}
      </form>
    </details>
  );
}
