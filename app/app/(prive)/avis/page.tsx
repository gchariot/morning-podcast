import { loadConfig } from '@/lib/config';
import { loadRetours } from '@/lib/retours';
import { formatDate, loadEpisodes, todayInZurich } from '@/lib/episodes';
import { parseLine, type Saved } from '@/lib/feedback';
import { Icon } from '@/components/Icon';
import { FeedbackForm } from '@/components/FeedbackForm';
import { RulesEditor } from '@/components/RulesEditor';
import { loadTomorrow } from '@/lib/tomorrow';

// Chapitres qui ne sont pas des thèmes (on ne note pas l'ouverture ni le générique).
const NOT_A_TOPIC = /^(ouverture|introduction|intro|générique|fin|au revoir|conclusion)$/i;

export default async function AvisPage() {
  const [{ config }, retours, episodes, tomorrow] = await Promise.all([
    loadConfig(), loadRetours(), loadEpisodes().catch(() => []), loadTomorrow(),
  ]);
  const last = episodes[0];

  // Les thèmes réellement entendus dans l'épisode ; à défaut, les thèmes actifs.
  const fromEpisode = (last?.chapters ?? []).map(c => c.title.trim()).filter(t => t && !NOT_A_TOPIC.test(t));
  const topics = fromEpisode.length ? [...new Set(fromEpisode)] : config.rubriques.filter(r => r.enabled !== false).map(r => r.title);

  // Ce qui a déjà été envoyé sur cet épisode : affiché directement sur les lignes, modifiable.
  const tag = last ? `(épisode du ${last.date})` : null;
  const mine = tag ? retours.recent.filter(l => l.endsWith(tag)) : [];
  const saved: Record<string, Saved> = {};
  let general = '';
  for (const line of mine) {
    const p = parseLine(line);
    if (p.topic === 'Général') general = p.note;
    else if (p.topic && !saved[p.topic]) saved[p.topic] = { vote: p.vote, chips: p.chips, note: p.note };
  }
  const older = retours.recent.filter(l => !mine.includes(l)).slice(0, 8).map(parseLine);
  const isToday = last?.date === todayInZurich();

  return (
    <>
      <header className="page-head">
        <h1>Mon avis</h1>
        <p>
          {last ? <>Sur l&apos;épisode {isToday ? 'd’aujourd’hui' : `du ${formatDate(last.date)}`}. </> : null}
          La rédaction le lit à 5 h 37 : il change l&apos;épisode de demain.
        </p>
      </header>

      <section className="tomorrow" aria-labelledby="tomorrow-h">
        <h2 id="tomorrow-h">Prochaine rédaction : {tomorrow.when}</h2>
        {mine.length || tomorrow.items.length
          ? <ul>
              {mine.length > 0 && <li>Ton avis sur {mine.length} {mine.length > 1 ? 'sujets' : 'sujet'} de l&apos;épisode</li>}
              {tomorrow.items.map(i => <li key={i}>{i}</li>)}
            </ul>
          : <p>Rien de nouveau pour l&apos;instant : ce que tu changes ici, dans Thèmes ou dans Réglages s&apos;affichera ici.</p>}
      </section>

      {last
        ? <FeedbackForm episode={last.date} topics={topics} saved={saved} savedGeneral={general} />
        : <p className="muted">Pas encore d&apos;épisode à commenter : le premier arrive vers 6 h.</p>}

      <section className="section">
        <RulesEditor initial={retours.permanent} />

        {older.length > 0 && (
          <details className="group" style={{ marginTop: 12 }}>
            <summary className="item">
              <span className="grow">
                <span style={{ fontWeight: 600, display: 'block' }}>Retours précédents</span>
                <span className="meta">Pris en compte pendant 14 jours</span>
              </span>
              <Icon name="chevron-right" className="chev" />
            </summary>
            {older.map((o, i) => (
              <div key={i} className="item small">
                <span className="num muted" style={{ flex: 'none' }}>{o.day}</span>
                <span className="grow">
                  {o.topic && <strong>{o.topic} </strong>}
                  {o.vote && <span className={`vote-ico ${o.vote}`}><Icon name={o.vote} size={14} /><span className="sr">{o.vote === 'up' ? 'aimé' : 'pas convaincu'}</span></span>}
                  {' '}{[o.chips.join(', '), o.note].filter(Boolean).join(' — ')}
                </span>
              </div>
            ))}
          </details>
        )}
      </section>
    </>
  );
}
