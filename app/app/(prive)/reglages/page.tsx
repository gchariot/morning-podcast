import { loadConfig } from '@/lib/config';
import { Flash, type FlashParams } from '@/components/Flash';
import { logout, updateSettings } from '../actions';

const DAYS = [
  { id: 'samedi', label: 'Samedi' },
  { id: 'dimanche', label: 'Dimanche' },
];

export default async function ReglagesPage({ searchParams }: { searchParams: FlashParams }) {
  const [{ ok, err }, { config }] = await Promise.all([searchParams, loadConfig()]);
  const editions = config.editions ?? {};

  return (
    <div className="stack">
      <p className="kicker">Réglages</p>
      <h1>Format de l&apos;émission</h1>
      <Flash ok={ok} err={err} />

      <form action={updateSettings} className="stack">
        <div className="card">
          <label htmlFor="targetMinutes">Durée visée en semaine (minutes)</label>
          <input id="targetMinutes" name="targetMinutes" type="number" min={3} max={40} step={1} defaultValue={config.show.targetMinutes} required />
        </div>

        {DAYS.map(d => {
          const e = editions[d.id];
          return (
            <fieldset key={d.id} className="card stack" style={{ margin: 0 }}>
              <label className="row" style={{ margin: 0, color: 'var(--ink)', fontWeight: 600 }}>
                <input type="checkbox" name={`${d.id}_on`} defaultChecked={!!e} /> Édition spéciale le {d.label.toLowerCase()}
              </label>
              <div>
                <label htmlFor={`${d.id}_minutes`}>Durée (minutes)</label>
                <input id={`${d.id}_minutes`} name={`${d.id}_minutes`} type="number" min={3} max={40} defaultValue={e?.targetMinutes ?? 10} />
              </div>
              <div>
                <span className="small muted">Thèmes retirés ce jour-là</span>
                <div className="row" style={{ marginTop: 6 }}>
                  {config.rubriques.map(r => (
                    <label key={r.id} className="pill" style={{ margin: 0, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" name={`${d.id}_skip`} value={r.id} defaultChecked={e?.skip.includes(r.id)} />
                      {r.title}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>
          );
        })}

        <button className="btn primary" type="submit" style={{ width: '100%' }}>Enregistrer</button>
      </form>

      <section className="card stack" style={{ marginTop: 28 }}>
        <h2>Voix</h2>
        <p className="muted small">
          Léa et Hugo sont lues par Gemini. Pour essayer d&apos;autres voix, lance « 0 · Test de voix » dans les Actions GitHub,
          puis change les variables VOICE_LEA / VOICE_HUGO.
        </p>
        <a className="btn small" href={`https://github.com/${process.env.GITHUB_REPO}/actions`} target="_blank" rel="noreferrer">Ouvrir GitHub Actions</a>
      </section>

      <form action={logout} style={{ marginTop: 28 }}>
        <button className="btn small" type="submit">Se déconnecter</button>
      </form>
    </div>
  );
}
