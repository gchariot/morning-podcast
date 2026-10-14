import { loadConfig } from '@/lib/config';
import { loadRetours } from '@/lib/retours';
import { formatDate, loadEpisodes } from '@/lib/episodes';
import { Flash, type FlashParams } from '@/components/Flash';
import { addPermanentRule, removePermanentRule, sendFeedback } from '../actions';

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
    <div className="stack">
      <p className="kicker">Mon avis</p>
      <h1>Qu&apos;as-tu pensé de l&apos;épisode ?</h1>
      <p className="muted small">
        {last ? <>Épisode du {formatDate(last.date)} : « {last.title} ». </> : null}
        Tes retours sont lus demain matin par la rédaction.
      </p>
      <Flash ok={ok} err={err} />

      <form action={sendFeedback} className="stack">
        <input type="hidden" name="episode" value={last?.date ?? ''} />
        {active.map(r => (
          <fieldset key={r.id} className="card" style={{ margin: 0 }}>
            <div className="spread">
              <legend style={{ fontWeight: 600, padding: 0 }}>{r.title}</legend>
              <span className="vote" role="radiogroup" aria-label={`Avis sur ${r.title}`}>
                <input type="radio" id={`up_${r.id}`} name={`vote_${r.id}`} value="up" />
                <label htmlFor={`up_${r.id}`} title="J'ai aimé">👍</label>
                <input type="radio" id={`down_${r.id}`} name={`vote_${r.id}`} value="down" />
                <label htmlFor={`down_${r.id}`} title="Pas convaincu">👎</label>
              </span>
            </div>
            <input
              type="text" name={`note_${r.id}`} aria-label={`Commentaire sur ${r.title}`}
              placeholder="Un mot ? (trop long, plus de mercato, sujet raté…)" style={{ marginTop: 10 }}
            />
          </fieldset>
        ))}
        <div>
          <label htmlFor="general">Sur l&apos;ensemble (ton, voix, durée, ordre…)</label>
          <textarea id="general" name="general" placeholder="Ex. : Hugo parle trop vite, j'aimerais finir par le foot." />
        </div>
        <button className="btn primary" type="submit" style={{ width: '100%' }}>Envoyer mes retours</button>
      </form>

      <section className="card stack" style={{ marginTop: 28 }}>
        <h2>Consignes permanentes</h2>
        <p className="muted small">Elles s&apos;appliquent à tous les épisodes, jusqu&apos;à ce que tu les retires.</p>
        {retours.permanent.length === 0 && <p className="muted small">Aucune pour l&apos;instant.</p>}
        {retours.permanent.map((rule, i) => (
          <form key={`${i}-${rule}`} action={removePermanentRule} className="spread">
            <span>{rule}</span>
            <input type="hidden" name="index" value={i} />
            <button className="btn small danger" type="submit" aria-label={`Retirer : ${rule}`}>Retirer</button>
          </form>
        ))}
        <form action={addPermanentRule} className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="text" name="rule" placeholder="Ex. : 2 sujets maximum en politique monde" aria-label="Nouvelle consigne permanente" required />
          <button className="btn small" type="submit">Ajouter</button>
        </form>
      </section>

      {retours.recent.length > 0 && (
        <section className="stack" style={{ marginTop: 28 }}>
          <h2>Derniers retours envoyés</h2>
          <ul className="muted small" style={{ paddingLeft: 18, margin: 0 }}>
            {retours.recent.slice(0, 8).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
