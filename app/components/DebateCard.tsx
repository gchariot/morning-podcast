'use client';
/** Le face-à-face du samedi : qui t'a convaincu, Léa ou Hugo ? Résultat annoncé le samedi suivant. */
import { useState, useTransition } from 'react';
import { voteDebate } from '@/app/(prive)/actions';
import { OFFLINE, fr, radioKeys, safeCall } from '@/lib/safe';
import { useOnline } from './Connectivity';

export function DebateCard({ date, topic, sides, myVote, closed }: {
  date: string; topic: string; sides: [string, string]; myVote: 0 | 1 | null; closed: boolean;
}) {
  const [vote, setVote] = useState<0 | 1 | null>(myVote);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const online = useOnline();
  const shown = msg && !(online && msg.message === OFFLINE) ? msg : null;

  const cast = (side: 0 | 1) => {
    if (closed || pending) return;
    const before = vote;
    setVote(side);
    setMsg(null);
    start(async () => {
      const res = await safeCall(() => voteDebate(date, side));
      setMsg(res);
      if (!res.ok) setVote(before);
    });
  };

  return (
    <section className="section">
      <h2>Le face-à-face</h2>
      <div className="group pad quiz-card" style={{ marginTop: 12 }}>
        <p style={{ fontWeight: 600, lineHeight: 1.45 }}>{fr(topic)}</p>
        <div className="quiz-choices" role="radiogroup" aria-label="Qui t'a convaincu ?">
          {(['Léa', 'Hugo'] as const).map((host, i) => (
            <button key={host} type="button" role="radio" aria-checked={vote === i} disabled={closed}
              className={`quiz-choice${vote === i ? ' picked' : ''}`} onClick={() => cast(i as 0 | 1)} onKeyDown={radioKeys}>
              <span className={`quiz-letter ${i === 0 ? 'lea' : 'hugo'}`} aria-hidden>{host[0]}</span>
              <span className="grow"><strong className={`debate-name ${i === 0 ? 'lea' : 'hugo'}`}>{host}</strong> : {sides[i].replace(new RegExp(`^${host}\\s*:\\s*`, 'i'), '')}</span>
            </button>
          ))}
        </div>
        <p className="small" role="status" aria-live="polite" style={{ marginTop: 12, color: shown && !shown.ok ? 'var(--bad)' : 'var(--ink-2)' }}>
          {pending ? 'Enregistrement…'
            : shown ? shown.message
            : closed ? (vote === null ? 'Vote clos.' : `Tu avais donné raison à ${vote === 0 ? 'Léa' : 'Hugo'}.`)
            : vote === null ? 'Qui t’a convaincu ? Résultat annoncé samedi prochain.' : `Tu donnes raison à ${vote === 0 ? 'Léa' : 'Hugo'} (modifiable jusqu’à samedi prochain).`}
        </p>
      </div>
    </section>
  );
}
