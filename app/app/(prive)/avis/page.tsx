import { loadConfig } from '@/lib/config';
import { loadRetours } from '@/lib/retours';
import { formatDate, loadEpisodes } from '@/lib/episodes';
import { Flash, type FlashParams } from '@/components/Flash';
import { Icon } from '@/components/Icon';
import { addPermanentRule, removePermanentRule, sendFeedback } from '../actions';

// « 2026-10-14 : [Football] 👎 trop long (épisode du 2026-10-14) » → « 14/10 · Football 👎 trop long »
function prettyRetour(line: string) {
  const m = line.replace(/^-\s*/, '').match(/^(\d{4})-(\d{2})-(\d{2})\s*:\s*(.*?)\s*(\(épisode du [^)]*\))?$/);
  if (!m) return line;
  return <><span className="num muted">{m[3]}/{m[2]}</span>{' · '}{m[4].replace(/^\[([^\]]+)\]/, '$1')}</>;
}

export default async function AvisPage({ searchParams }: { searchParams: FlashParams }) {
  const [{ ok, err }, { config }, retours, episodes] = await Promise.all([
    searchParams,
    loadConfig(),
    loadRetours(),
    loadEpisodes().catch(() => []),
  ]);
  const last = episodes[0];
  const active = config.rubriques.filter(r => r.enabled !== false);

  return (
    <>
      <header className="page-head">
        <h1>Mon avis</h1>
        <p>
          {last ? <>Sur l&apos;épisode du {formatDate(last.date)}. </> : null}
          La rédaction lit tes retours à 5 h 37 : ils changent l&apos;épisode de demain.
        </p>
      </header>
      <Flash ok={ok} err={err} />

      <form action={sendFeedback}>
        <input type="hidden" name="episode" value={last?.date ?? ''} />
        <div className="group">
          {active.map(r => (
            <fieldset key={r.id} className="pad">
              <div className="spread">
                <legend className="sr">{r.title}</legend>
                <span aria-hidden style={{ fontWeight: 600 }}>{r.title}</span>
                <span className="vote" role="radiogroup" aria-label={`Avis sur ${r.title}`}>
                  <input type="radio" id={`up_${r.id}`} name={`vote_${r.id}`} value="up" />
                  <label htmlFor={`up_${r.id}`} title="J'ai aimé"><Icon name="up" size={18} /><span className="sr">J&apos;ai aimé</span></label>
                  <input type="radio" id={`down_${r.id}`} name={`vote_${r.id}`} value="down" />
                  <label htmlFor={`down_${r.id}`} title="Pas convaincu"><Icon name="down" size={18} /><span className="sr">Pas convaincu</span></label>
                </span>
              </div>
              <input
                type="text" name={`note_${r.id}`} aria-label={`Commentaire sur ${r.title}`}
                placeholder="Un mot ? Trop long, sujet raté…" style={{ marginTop: 10 }}
              />
            </fieldset>
          ))}
        </div>

        <div className="field" style={{ marginTop: 20 }}>
          <label htmlFor="general">Sur l&apos;ensemble</label>
          <textarea id="general" name="general" placeholder="Ton, voix, durée, ordre… Ex. : Hugo parle trop vite, finir par le foot." />
        </div>
        <button className="btn primary block" type="submit" style={{ marginTop: 16 }}>Envoyer pour demain</button>
        <p className="field-hint" style={{ textAlign: 'center' }}>Rien n&apos;est obligatoire : un seul pouce suffit.</p>
      </form>

      <section className="section">
        <h2>Consignes permanentes</h2>
        <p className="hint">Appliquées à chaque épisode, jusqu&apos;à ce que tu les retires.</p>
        <div className="group">
          {retours.permanent.length === 0 && (
            <p className="item muted small">Aucune consigne. Ajoute par exemple « Politique monde : 2 sujets maximum ».</p>
          )}
          {retours.permanent.map((rule, i) => (
            <form key={`${i}-${rule}`} action={removePermanentRule} className="item">
              <span className="grow">{rule}</span>
              <input type="hidden" name="index" value={i} />
              <button className="btn icon danger" type="submit" aria-label={`Retirer : ${rule}`} title="Retirer">
                <Icon name="x" size={18} />
              </button>
            </form>
          ))}
          <form action={addPermanentRule} className="item">
            <input type="text" name="rule" placeholder="Nouvelle consigne…" aria-label="Nouvelle consigne permanente" required />
            <button className="btn small ghost" type="submit">Ajouter</button>
          </form>
        </div>
      </section>

      {retours.recent.length > 0 && (
        <section className="section">
          <h2>Derniers retours</h2>
          <p className="hint">Pris en compte pendant 14 jours.</p>
          <ul className="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {retours.recent.slice(0, 8).map((line, i) => (
              <li key={i} className="item small">{prettyRetour(line)}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
