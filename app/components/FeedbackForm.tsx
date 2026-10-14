'use client';
/**
 * Avis rapide : un pouce par chapitre, puis des pastilles toutes prêtes (et un mot si besoin).
 * Le bouton d'envoi reste visible dès qu'il y a quelque chose à envoyer.
 */
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from './Icon';
import { sendFeedback } from '@/app/(prive)/actions';

type Vote = 'up' | 'down' | '';
type Entry = { vote: Vote; chips: string[]; note: string; noteOpen: boolean };

const CHIPS: Record<'up' | 'down', string[]> = {
  up: ['Parfait comme ça', 'Plus de ça', 'Bien expliqué', 'Drôle'],
  down: ['Trop long', 'Trop court', 'Pas assez de détails', 'Sujet raté', 'Trop technique', 'Déjà entendu'],
};
const empty: Entry = { vote: '', chips: [], note: '', noteOpen: false };

function SendBar({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <div className="sendbar">
      <button className="btn primary block" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? 'Envoi…' : `Envoyer pour demain${count > 1 ? ` (${count})` : ''}`}
      </button>
    </div>
  );
}

export function FeedbackForm({ episode, topics }: { episode: string; topics: string[] }) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [general, setGeneral] = useState('');
  const get = (t: string) => entries[t] ?? empty;
  const set = (t: string, patch: Partial<Entry>) => setEntries(e => ({ ...e, [t]: { ...get(t), ...patch } }));

  const vote = (t: string, v: 'up' | 'down') => {
    const cur = get(t);
    // Retoucher le même pouce l'annule ; changer de pouce vide les pastilles de l'autre camp.
    set(t, cur.vote === v ? { vote: '', chips: [] } : { vote: v, chips: [] });
  };
  const toggleChip = (t: string, c: string) => {
    const cur = get(t);
    set(t, { chips: cur.chips.includes(c) ? cur.chips.filter(x => x !== c) : [...cur.chips, c] });
  };

  const filled = topics.filter(t => { const e = get(t); return e.vote || e.chips.length || e.note.trim(); });
  const count = filled.length + (general.trim() ? 1 : 0);

  return (
    <form action={sendFeedback}>
      <input type="hidden" name="episode" value={episode} />
      {filled.map(t => {
        const e = get(t);
        return <input key={t} type="hidden" name="item" value={JSON.stringify({ title: t, vote: e.vote, chips: e.chips, note: e.note })} />;
      })}

      <div className="group">
        {topics.map(t => {
          const e = get(t);
          return (
            <div key={t} className={`fb${e.vote ? ` fb-${e.vote}` : ''}`}>
              <div className="item">
                <span className="grow" style={{ fontWeight: 600 }}>{t}</span>
                <span className="vote" role="group" aria-label={`Avis sur ${t}`}>
                  <button type="button" className="thumb up" aria-pressed={e.vote === 'up'} onClick={() => vote(t, 'up')} title="J'ai aimé">
                    <Icon name="up" size={18} /><span className="sr">J&apos;ai aimé</span>
                  </button>
                  <button type="button" className="thumb down" aria-pressed={e.vote === 'down'} onClick={() => vote(t, 'down')} title="Pas convaincu">
                    <Icon name="down" size={18} /><span className="sr">Pas convaincu</span>
                  </button>
                </span>
              </div>
              {e.vote && (
                <div className="fb-more">
                  <div className="row" style={{ gap: 6 }}>
                    {CHIPS[e.vote].map(c => (
                      <button key={c} type="button" className="pick" aria-pressed={e.chips.includes(c)} onClick={() => toggleChip(t, c)}>{c}</button>
                    ))}
                    {!e.noteOpen && (
                      <button type="button" className="pick ghost" onClick={() => set(t, { noteOpen: true })}>
                        <Icon name="plus" size={14} /> Un mot
                      </button>
                    )}
                  </div>
                  {e.noteOpen && (
                    <input
                      type="text" autoFocus value={e.note} onChange={ev => set(t, { note: ev.target.value })}
                      aria-label={`Commentaire sur ${t}`} placeholder="Ex. : plus de mercato OL" maxLength={300} style={{ marginTop: 10 }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <details className="group" style={{ marginTop: 16 }} open={general ? true : undefined}>
        <summary className="item">
          <span className="grow"><span style={{ fontWeight: 600, display: 'block' }}>Sur l&apos;ensemble</span><span className="meta">Ton, voix, durée, ordre…</span></span>
          <Icon name="chevron-right" className="chev" />
        </summary>
        <div className="pad">
          <textarea name="general" value={general} onChange={e => setGeneral(e.target.value)} aria-label="Avis sur l'ensemble"
            placeholder="Ex. : Hugo parle trop vite, finir par le foot." />
        </div>
      </details>

      {count > 0 ? <SendBar count={count} /> : <p className="field-hint" style={{ textAlign: 'center', marginTop: 16 }}>Touche un pouce : les précisions viennent ensuite.</p>}
    </form>
  );
}
