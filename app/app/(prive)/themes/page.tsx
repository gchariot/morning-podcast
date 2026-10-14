import { loadConfig, type Rubrique } from '@/lib/config';
import { Flash, type FlashParams } from '@/components/Flash';
import { addRubrique, deleteRubrique, moveRubrique, toggleRubrique, updateRubrique } from '../actions';

function RubriqueFields({ r }: { r?: Rubrique }) {
  const key = r?.id ?? 'new';
  return (
    <div className="stack">
      <div>
        <label htmlFor={`title_${key}`}>Nom du thème</label>
        <input id={`title_${key}`} name="title" type="text" defaultValue={r?.title} required placeholder="Ex. : Formule 1" />
      </div>
      <div>
        <label htmlFor={`minutes_${key}`}>Durée (minutes)</label>
        <input id={`minutes_${key}`} name="minutes" type="number" min={0.5} max={10} step={0.5} defaultValue={r?.minutes ?? 3} required />
      </div>
      <div>
        <label htmlFor={`brief_${key}`}>Consigne pour la rédaction</label>
        <textarea
          id={`brief_${key}`} name="brief" defaultValue={r?.brief} required minLength={10}
          placeholder="Ce qui t'intéresse, ce qu'il faut éviter, ce qui passe en premier…"
        />
      </div>
      <div>
        <label htmlFor={`domains_${key}`}>Sites de référence (un par ligne ou séparés par des virgules)</label>
        <textarea id={`domains_${key}`} name="domains" defaultValue={r?.domains.join('\n')} placeholder={'lequipe.fr\nformula1.com'} style={{ minHeight: 70 }} />
      </div>
    </div>
  );
}

export default async function ThemesPage({ searchParams }: { searchParams: FlashParams }) {
  const [{ ok, err }, { config }] = await Promise.all([searchParams, loadConfig()]);
  const active = config.rubriques.filter(r => r.enabled !== false);
  const total = active.reduce((s, r) => s + r.minutes, 0);
  const target = config.show.targetMinutes;

  return (
    <div className="stack">
      <p className="kicker">Mes thèmes</p>
      <h1>Ce que tu veux entendre</h1>
      <Flash ok={ok} err={err} />

      <div className="card">
        <div className="spread small">
          <span>Durée des thèmes actifs</span>
          <strong>{total.toFixed(1)} / {target} min</strong>
        </div>
        <div className="bar" style={{ marginTop: 8 }} aria-hidden>
          <i style={{ width: `${Math.min(100, (total / target) * 100)}%` }} />
        </div>
        {total > target * 1.15 && <p className="small" style={{ marginTop: 8, color: 'var(--sun)' }}>Plus long que la durée visée : la rédaction raccourcira chaque thème au prorata.</p>}
      </div>

      {config.rubriques.map((r, i) => (
        <details key={r.id} className="card">
          <summary>
            <div className="spread">
              <div>
                <strong>{r.title}</strong>{' '}
                {r.enabled === false ? <span className="pill off">en pause</span> : <span className="pill">{r.minutes} min</span>}
                <p className="muted small" style={{ margin: '4px 0 0' }}>{r.brief.slice(0, 90)}{r.brief.length > 90 ? '…' : ''}</p>
              </div>
              <span className="muted" aria-hidden>✎</span>
            </div>
          </summary>

          <div className="stack" style={{ marginTop: 16 }}>
            <form action={updateRubrique} className="stack">
              <input type="hidden" name="id" value={r.id} />
              <RubriqueFields r={r} />
              <button className="btn primary" type="submit">Enregistrer</button>
            </form>

            <div className="row">
              <form action={toggleRubrique}>
                <input type="hidden" name="id" value={r.id} />
                <button className="btn small" type="submit">{r.enabled === false ? '▶ Réactiver' : '⏸ Mettre en pause'}</button>
              </form>
              <form action={moveRubrique}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="dir" value="up" />
                <button className="btn small" type="submit" disabled={i === 0} aria-label="Monter">↑</button>
              </form>
              <form action={moveRubrique}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="dir" value="down" />
                <button className="btn small" type="submit" disabled={i === config.rubriques.length - 1} aria-label="Descendre">↓</button>
              </form>
            </div>

            <form action={deleteRubrique} className="row">
              <input type="hidden" name="id" value={r.id} />
              <label className="row" style={{ margin: 0, gap: 6 }}>
                <input type="checkbox" name="confirm" value="oui" /> je confirme
              </label>
              <button className="btn small danger" type="submit">Supprimer ce thème</button>
            </form>
          </div>
        </details>
      ))}

      <details className="card" style={{ borderStyle: 'dashed' }}>
        <summary><strong>＋ Ajouter un thème</strong></summary>
        <form action={addRubrique} className="stack" style={{ marginTop: 16 }}>
          <RubriqueFields />
          <p className="muted small">Il sera placé avant la culture générale, qui clôt l&apos;épisode. Tu pourras le déplacer ensuite.</p>
          <button className="btn primary" type="submit">Créer le thème</button>
        </form>
      </details>
    </div>
  );
}
