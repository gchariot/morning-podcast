import { loadConfig } from '@/lib/config';
import { loadRetours } from '@/lib/retours';
import { formatDate, loadEpisodes } from '@/lib/episodes';
import { Flash, type FlashParams } from '@/components/Flash';
import { Icon } from '@/components/Icon';
import { FeedbackForm } from '@/components/FeedbackForm';
import { addPermanentRule, removeFeedback, removePermanentRule } from '../actions';

// Chapitres qui ne sont pas des thèmes (on ne note pas l'ouverture ni le générique).
const NOT_A_TOPIC = /^(ouverture|introduction|intro|générique|fin|au revoir|conclusion)$/i;

// « 2026-10-14 : [Football] 👎 Trop long (épisode du 2026-10-14) » → { topic, rest }
function parse(line: string) {
  const body = line.replace(/^\d{4}-\d{2}-\d{2}\s*:\s*/, '').replace(/\s*\(épisode du [^)]*\)$/, '');
  const m = body.match(/^\[([^\]]+)\]\s*(.*)$/);
  return m ? { topic: m[1], rest: m[2] } : { topic: '', rest: body };
}
function dayOf(line: string) {
  const m = line.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : '';
}

export default async function AvisPage({ searchParams }: { searchParams: FlashParams }) {
  const [{ ok, err }, { config }, retours, episodes] = await Promise.all([
    searchParams,
    loadConfig(),
    loadRetours(),
    loadEpisodes().catch(() => []),
  ]);
  const last = episodes[0];

  // Les thèmes réellement entendus dans l'épisode ; à défaut, les thèmes actifs.
  const fromEpisode = (last?.chapters ?? []).map(c => c.title.trim()).filter(t => t && !NOT_A_TOPIC.test(t));
  const topics = fromEpisode.length ? [...new Set(fromEpisode)] : config.rubriques.filter(r => r.enabled !== false).map(r => r.title);

  const tag = last ? `(épisode du ${last.date})` : null;
  const sent = tag ? retours.recent.filter(l => l.endsWith(tag)) : [];
  const older = retours.recent.filter(l => !sent.includes(l)).slice(0, 8);

  return (
    <>
      <header className="page-head">
        <h1>Mon avis</h1>
        <p>
          {last ? <>Sur l&apos;épisode du {formatDate(last.date)}. </> : null}
          La rédaction le lit à 5 h 37 : il change l&apos;épisode de demain.
        </p>
      </header>
      <Flash ok={ok} err={err} />

      {sent.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2>Déjà envoyé</h2>
          <p className="hint muted small" style={{ margin: '4px 0 12px' }}>Pour corriger, retire la ligne et renvoie un avis.</p>
          <div className="group">
            {sent.map(line => {
              const { topic, rest } = parse(line);
              return (
                <form key={line} action={removeFeedback} className="item">
                  <input type="hidden" name="line" value={line} />
                  <span className="grow">
                    {topic && <span style={{ fontWeight: 600 }}>{topic} </span>}
                    <span className="muted">{rest}</span>
                  </span>
                  <button className="btn icon danger" type="submit" aria-label={`Retirer : ${topic} ${rest}`} title="Retirer">
                    <Icon name="x" size={18} />
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      )}

      {sent.length > 0 && <h2 style={{ marginBottom: 12 }}>Ajouter un avis</h2>}
      <FeedbackForm key={sent.length} episode={last?.date ?? ''} topics={topics} />

      <section className="section">
        <details className="group">
          <summary className="item">
            <span className="grow">
              <span style={{ fontWeight: 600, display: 'block' }}>Consignes permanentes</span>
              <span className="meta">
                {retours.permanent.length ? `${retours.permanent.length} consigne${retours.permanent.length > 1 ? 's' : ''} appliquée${retours.permanent.length > 1 ? 's' : ''} à chaque épisode` : 'Appliquées à chaque épisode, jusqu’à ce que tu les retires'}
              </span>
            </span>
            <Icon name="chevron-right" className="chev" />
          </summary>
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
            <input type="text" name="rule" placeholder="Ex. : politique monde, 2 sujets maximum" aria-label="Nouvelle consigne permanente" required />
            <button className="btn small ghost" type="submit">Ajouter</button>
          </form>
        </details>

        {older.length > 0 && (
          <details className="group" style={{ marginTop: 12 }}>
            <summary className="item">
              <span className="grow">
                <span style={{ fontWeight: 600, display: 'block' }}>Retours précédents</span>
                <span className="meta">Pris en compte pendant 14 jours</span>
              </span>
              <Icon name="chevron-right" className="chev" />
            </summary>
            {older.map((line, i) => {
              const { topic, rest } = parse(line);
              return (
                <div key={i} className="item small">
                  <span className="num muted" style={{ flex: 'none' }}>{dayOf(line)}</span>
                  <span className="grow">{topic && <strong>{topic} </strong>}{rest}</span>
                </div>
              );
            })}
          </details>
        )}
      </section>
    </>
  );
}
