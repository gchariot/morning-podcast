import { loadConfig, type Rubrique } from '@/lib/config';
import { Flash, type FlashParams } from '@/components/Flash';
import { Icon } from '@/components/Icon';
import { addRubrique, deleteRubrique, toggleRubrique, updateRubrique } from '../actions';
import { SortableThemes } from '@/components/SortableThemes';

function RubriqueFields({ r }: { r?: Rubrique }) {
  const key = r?.id ?? 'new';
  return (
    <>
      <div className="field">
        <label htmlFor={`title_${key}`}>Nom du thème</label>
        <input id={`title_${key}`} name="title" type="text" defaultValue={r?.title} required placeholder="Ex. : Formule 1" />
      </div>
      <div className="field">
        <label htmlFor={`minutes_${key}`}>Durée</label>
        <div className="row">
          <input id={`minutes_${key}`} name="minutes" type="number" min={0.5} max={10} step={0.5} defaultValue={r?.minutes ?? 3} required />
          <span className="muted">minutes</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`brief_${key}`}>Consigne pour la rédaction</label>
        <textarea
          id={`brief_${key}`} name="brief" defaultValue={r?.brief} required minLength={10}
          placeholder="Ce qui t'intéresse, ce qu'il faut éviter, ce qui passe en premier…"
        />
      </div>
      <div className="field">
        <label htmlFor={`domains_${key}`}>Sites de référence</label>
        <textarea id={`domains_${key}`} name="domains" defaultValue={r?.domains.join('\n')} placeholder={'lequipe.fr\nformula1.com'} style={{ minHeight: 72 }} />
        <p className="field-hint">Un par ligne. La rédaction les privilégie sans s&apos;y limiter.</p>
      </div>
    </>
  );
}

export default async function ThemesPage({ searchParams }: { searchParams: FlashParams }) {
  const [{ ok, err }, { config }] = await Promise.all([searchParams, loadConfig()]);
  const active = config.rubriques.filter(r => r.enabled !== false);
  const total = active.reduce((s, r) => s + r.minutes, 0);
  const target = config.show.targetMinutes;
  const over = total > target * 1.15;

  return (
    <>
      <header className="page-head">
        <h1>Thèmes</h1>
        <p>Dans l&apos;ordre de l&apos;épisode. Une modification vaut dès l&apos;édition de demain.</p>
      </header>
      <Flash ok={ok} err={err} />

      <div className="group pad">
        <div className="spread small">
          <span className="muted">{active.length} thèmes actifs</span>
          <strong className="num">{total.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} / {target} min</strong>
        </div>
        <div className={`meter${over ? ' over' : ''}`} aria-hidden><i style={{ width: `${Math.min(100, (total / target) * 100)}%` }} /></div>
        {over && <p className="small" style={{ marginTop: 8, color: 'var(--bad)' }}>Plus long que la durée visée : chaque thème sera raccourci au prorata.</p>}
      </div>

      <SortableThemes items={config.rubriques.map(r => ({ id: r.id, title: r.title, node: (
          <details>
            <summary className="item">
              <span className="grow" style={{ opacity: r.enabled === false ? 0.55 : 1 }}>
                <span className="row" style={{ gap: 8 }}>
                  <strong>{r.title}</strong>
                  {r.enabled === false ? <span className="badge off">En pause</span> : <span className="badge num">{r.minutes} min</span>}
                </span>
                <span className="meta" style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.brief}</span>
              </span>
              <Icon name="chevron-right" className="chev" />
            </summary>

            <div className="pad" style={{ background: 'var(--surface)' }}>
              <form action={updateRubrique}>
                <input type="hidden" name="id" value={r.id} />
                <RubriqueFields r={r} />
                <button className="btn primary block" type="submit" style={{ marginTop: 16 }}>Enregistrer</button>
              </form>

              <div className="spread" style={{ marginTop: 16 }}>
                <form action={toggleRubrique}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn small" type="submit">{r.enabled === false ? 'Réactiver' : 'Mettre en pause'}</button>
                </form>
              </div>

              <form action={deleteRubrique} className="spread" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <input type="hidden" name="id" value={r.id} />
                <label className="row" style={{ margin: 0, gap: 8, color: 'var(--ink-2)', flexWrap: 'nowrap' }}>
                  <input type="checkbox" name="confirm" value="oui" required /> Confirmer
                </label>
                <button className="btn small danger" type="submit"><Icon name="trash" size={16} /> Supprimer</button>
              </form>
            </div>
          </details>
        ) }))} />

      <section className="section">
        <details className="group">
          <summary className="item" style={{ color: 'var(--accent)' }}>
            <Icon name="plus" />
            <strong className="grow">Nouveau thème</strong>
            <Icon name="chevron-right" className="chev" />
          </summary>
          <form action={addRubrique} className="pad">
            <RubriqueFields />
            <p className="field-hint" style={{ marginTop: 16 }}>Il sera placé juste avant la culture générale, qui clôt l&apos;épisode. Tu pourras le déplacer ensuite.</p>
            <button className="btn primary block" type="submit" style={{ marginTop: 12 }}>Créer le thème</button>
          </form>
        </details>
      </section>
    </>
  );
}
