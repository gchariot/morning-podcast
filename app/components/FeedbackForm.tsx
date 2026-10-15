'use client';
/**
 * Avis rapide : un pouce par chapitre, puis des pastilles toutes prêtes (et un mot si besoin).
 * Ce qui a déjà été envoyé reste affiché sur la ligne ; le modifier puis renvoyer remplace l'ancien avis.
 * Le brouillon est gardé sur le téléphone tant qu'il n'est pas envoyé (coupure réseau, onglet fermé…).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnline } from './Connectivity';
import { Icon } from './Icon';
import { useAudio } from './Audio';
import { useSnack } from './Snack';
import { saveFeedback } from '@/app/(prive)/actions';
import { CHIPS, parseLine, type Saved } from '@/lib/feedback';
import { OFFLINE, safeCall } from '@/lib/safe';

type Entry = Saved & { noteOpen?: boolean; more?: boolean; edit?: boolean };
const EMPTY: Entry = { vote: '', chips: [], note: '' };
const VISIBLE = 3;

const same = (a: Saved, b: Saved) =>
  a.vote === b.vote && a.note.trim() === b.note.trim() && [...a.chips].sort().join() === [...b.chips].sort().join();
const isEmpty = (e: Saved) => !e.vote && !e.chips.length && !e.note.trim();

export function FeedbackForm({ episode, topics, saved: savedInit, savedGeneral }: {
  episode: string; topics: string[]; saved: Record<string, Saved>; savedGeneral: string;
}) {
  const draftKey = `matinale_avis_${episode}`;
  const [saved, setSaved] = useState(savedInit);
  const [sentGeneral, setSentGeneral] = useState(savedGeneral);
  const [entries, setEntries] = useState<Record<string, Entry>>(savedInit);
  const [general, setGeneral] = useState(savedGeneral);
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false); // envoi refusé faute de réseau, brouillon gardé
  const { show } = useSnack();
  const router = useRouter();
  const sendRef = useRef<() => Promise<void>>(async () => {});
  const online = useOnline();

  // Brouillon non envoyé : on le retrouve en revenant sur l'onglet.
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? 'null') as { entries: Record<string, Entry>; general: string } | null;
      if (d) { setEntries(e => ({ ...e, ...d.entries })); setGeneral(d.general); }
    } catch { /* stockage indisponible */ }
  }, [draftKey]);

  const get = (t: string) => entries[t] ?? EMPTY;
  const base = (t: string) => saved[t] ?? EMPTY;
  const changed = useMemo(() => topics.filter(t => !same(entries[t] ?? EMPTY, saved[t] ?? EMPTY)), [topics, entries, saved]);
  const generalChanged = general.trim() !== sentGeneral.trim();
  const count = changed.length + (generalChanged ? 1 : 0);

  useEffect(() => {
    try {
      if (count) localStorage.setItem(draftKey, JSON.stringify({ entries, general }));
      else localStorage.removeItem(draftKey);
    } catch { /* ignoré */ }
  }, [count, entries, general, draftKey]);

  // Le réseau revient : on propose d'envoyer ce qui attendait.
  useEffect(() => {
    if (online && waiting && count > 0) {
      setWaiting(false);
      show({ ok: true, message: 'Le réseau est revenu : ton avis est prêt.', action: { label: 'Envoyer', run: () => void sendRef.current() } });
    }
  }, [online, waiting, count, show]);

  const set = (t: string, patch: Partial<Entry>) => setEntries(e => ({ ...e, [t]: { ...(e[t] ?? EMPTY), ...patch } }));
  const vote = (t: string, v: 'up' | 'down') => {
    const cur = get(t);
    // Retoucher le même pouce l'annule ; changer de pouce vide les pastilles de l'autre camp.
    set(t, cur.vote === v ? { vote: '', chips: [] } : { vote: v, chips: [] });
  };
  const toggleChip = (t: string, c: string) => {
    const cur = get(t);
    set(t, { chips: cur.chips.includes(c) ? cur.chips.filter(x => x !== c) : [...cur.chips, c] });
  };

  const send = async () => {
    setSending(true);
    const items = changed.map(t => { const e = get(t); return { title: t, vote: e.vote, chips: e.chips, note: e.note }; });
    const res = await safeCall(() => saveFeedback(episode, items, generalChanged ? general : null));
    setSending(false);
    if (!res.ok && res.message === OFFLINE) {
      setWaiting(true);
      show({ ok: false, message: 'Pas de réseau : ton avis est gardé sur le téléphone. Tu pourras l’envoyer dès que ça capte.' });
      return;
    }
    setWaiting(false);
    show({ ok: res.ok, message: res.message });
    if (!res.ok || !res.sent) return;
    router.refresh(); // met à jour « Prochaine rédaction »
    const next: Record<string, Saved> = {};
    let g = '';
    for (const line of res.sent) {
      const p = parseLine(line);
      if (p.topic === 'Général') g = p.note; else if (p.topic && !next[p.topic]) next[p.topic] = { vote: p.vote, chips: p.chips, note: p.note };
    }
    setSaved(next);
    setSentGeneral(g);
    setEntries(next);
    setGeneral(g);
  };

  useEffect(() => { sendRef.current = send; });

  return (
    <div>
      <div className="group">
        {topics.map(t => {
          const e = get(t);
          const status = !same(e, base(t)) ? (isEmpty(e) && !isEmpty(base(t)) ? 'À retirer' : isEmpty(base(t)) ? '' : 'Modifié') : !isEmpty(base(t)) ? 'Envoyé' : '';
          const list = e.vote ? CHIPS[e.vote] : [];
          const showAll = e.more || e.chips.some(c => list.indexOf(c) >= VISIBLE);
          // Une ligne envoyée et inchangée se replie en résumé ; un tap la rouvre.
          const folded = status === 'Envoyé' && !e.edit;
          const summary = [e.chips.join(', '), e.note].filter(Boolean).join(' — ');
          return (
            <div key={t} className={`fb${e.vote ? ` fb-${e.vote}` : ''}`}>
              <div className="item">
                <span className="grow row" style={{ gap: 8, flexWrap: 'nowrap', minWidth: 0 }}>
                  <strong className="fb-title">{t}</strong>
                  {status && <span className={`pill${status === 'Envoyé' ? ' sent' : ''}`}>{status}</span>}
                </span>
                <span className="vote" role="group" aria-label={`Avis sur ${t}`}>
                  <button type="button" className="thumb up" aria-pressed={e.vote === 'up'} onClick={() => vote(t, 'up')} title="J'ai aimé">
                    <Icon name="up" size={18} /><span className="sr">J&apos;ai aimé</span>
                  </button>
                  <button type="button" className="thumb down" aria-pressed={e.vote === 'down'} onClick={() => vote(t, 'down')} title="Pas convaincu">
                    <Icon name="down" size={18} /><span className="sr">Pas convaincu</span>
                  </button>
                </span>
              </div>
              {e.vote && folded && (
                <button type="button" className="fb-summary" onClick={() => set(t, { edit: true })} aria-label={summary ? `Modifier les précisions sur ${t} : ${summary}` : `Ajouter une précision sur ${t}`}>
                  <span className="grow">{summary || 'Pas de précision'}</span>
                  <span className="fb-edit">{summary ? 'Modifier' : 'Préciser'}</span>
                </button>
              )}
              {e.vote && !folded && (
                <div className="fb-more">
                  <div className="row" style={{ gap: 6 }}>
                    {(showAll ? list : list.slice(0, VISIBLE)).map(c => (
                      <button key={c} type="button" className="pick" aria-pressed={e.chips.includes(c)} onClick={() => toggleChip(t, c)}>{c}</button>
                    ))}
                    {!showAll && list.length > VISIBLE && (
                      <button type="button" className="pick ghost" onClick={() => set(t, { more: true })}>Plus…</button>
                    )}
                    {!e.noteOpen && !e.note && (
                      <button type="button" className="pick ghost" onClick={() => set(t, { noteOpen: true })}>
                        <Icon name="plus" size={14} /> Un mot
                      </button>
                    )}
                  </div>
                  {(e.noteOpen || e.note) && (
                    <input
                      type="text" autoFocus={e.noteOpen && !e.note} value={e.note} onChange={ev => set(t, { note: ev.target.value })}
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
          <span className="grow">
            <span className="row" style={{ gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Sur l&apos;ensemble</span>
              {sentGeneral && !generalChanged && <span className="pill sent">Envoyé</span>}
            </span>
            <span className="meta">Ton, voix, durée, ordre…</span>
          </span>
          <Icon name="chevron-right" className="chev" />
        </summary>
        <div className="pad">
          <label htmlFor="avis-general" className="sr">Avis sur l&apos;ensemble</label>
          <textarea id="avis-general" value={general} onChange={e => setGeneral(e.target.value)} maxLength={600}
            placeholder="Ex. : Hugo parle trop vite, finir par le foot." />
        </div>
      </details>

      {count > 0
        ? <SendBar count={count} sending={sending} onSend={send} />
        : <p className="field-hint" style={{ textAlign: 'center', marginTop: 16 }}>
            {Object.keys(saved).length || sentGeneral ? 'Ton avis est envoyé. Touche un pouce pour le modifier.' : 'Touche un pouce : les précisions viennent ensuite.'}
          </p>}
    </div>
  );
}

/** Barre d'envoi près du pouce ; elle remplace le mini-lecteur (et garde lecture/pause). */
function SendBar({ count, sending, onSend }: { count: number; sending: boolean; onSend: () => void }) {
  const { track, playing, toggle } = useAudio();
  return (
    <div className="sendbar">
      {track && (
        <button type="button" className="sendbar-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
          <Icon name={playing ? 'pause' : 'play'} size={20} />
        </button>
      )}
      <button className="btn primary block" type="button" onClick={onSend} disabled={sending} aria-busy={sending}>
        {sending ? 'Envoi…' : `Envoyer pour demain${count > 1 ? ` (${count})` : ''}`}
      </button>
    </div>
  );
}
