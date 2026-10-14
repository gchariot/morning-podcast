import { loadConfig } from '@/lib/config';
import { Flash, type FlashParams } from '@/components/Flash';
import { Icon } from '@/components/Icon';
import { logout, updateSettings } from '../actions';

const DAYS = [
  { id: 'samedi', label: 'Samedi' },
  { id: 'dimanche', label: 'Dimanche' },
];

export default async function ReglagesPage({ searchParams }: { searchParams: FlashParams }) {
  const [{ ok, err }, { config }] = await Promise.all([searchParams, loadConfig()]);
  const editions = config.editions ?? {};

  return (
    <>
      <header className="page-head">
        <h1>Réglages</h1>
        <p>Le format de l&apos;émission, jour par jour.</p>
      </header>
      <Flash ok={ok} err={err} />

      <form action={updateSettings}>
        <div className="group">
          <div className="item">
            <label htmlFor="targetMinutes" className="grow" style={{ margin: 0, color: 'var(--ink)', fontWeight: 500 }}>Durée en semaine</label>
            <input id="targetMinutes" name="targetMinutes" type="number" min={3} max={40} step={1} defaultValue={config.show.targetMinutes} required style={{ width: 80 }} />
            <span className="muted small">min</span>
          </div>
        </div>

        {DAYS.map(d => {
          const e = editions[d.id];
          return (
            <section key={d.id} className="section" style={{ marginTop: 28 }}>
              <h2>{d.label}</h2>
              <fieldset className="group" style={{ marginTop: 12 }}>
                <legend className="sr">Édition du {d.label.toLowerCase()}</legend>
                <div className="item">
                  <label htmlFor={`${d.id}_on`} className="grow" style={{ margin: 0, color: 'var(--ink)', fontWeight: 500 }}>
                    Édition courte
                    <span className="meta" style={{ display: 'block', fontWeight: 400 }}>Sinon, même format qu&apos;en semaine</span>
                  </label>
                  <input className="switch" type="checkbox" id={`${d.id}_on`} name={`${d.id}_on`} defaultChecked={!!e} />
                </div>
                <div className="item">
                  <label htmlFor={`${d.id}_minutes`} className="grow" style={{ margin: 0, color: 'var(--ink)', fontWeight: 500 }}>Durée</label>
                  <input id={`${d.id}_minutes`} name={`${d.id}_minutes`} type="number" min={3} max={40} defaultValue={e?.targetMinutes ?? 10} style={{ width: 80 }} />
                  <span className="muted small">min</span>
                </div>
                <div className="pad">
                  <span className="label">Thèmes retirés ce jour-là</span>
                  <div className="row" style={{ gap: 6 }}>
                    {config.rubriques.map(r => (
                      <label key={r.id} className="chip">
                        <input type="checkbox" name={`${d.id}_skip`} value={r.id} defaultChecked={e?.skip.includes(r.id)} />
                        <span>{r.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>
            </section>
          );
        })}

        <button className="btn primary block" type="submit" style={{ marginTop: 24 }}>Enregistrer</button>
      </form>

      <section className="section">
        <h2>Voix</h2>
        <p className="hint">Léa et Hugo sont lus par Gemini. Pour essayer d&apos;autres voix, lance « 0 · Test de voix » dans GitHub Actions, puis change VOICE_LEA et VOICE_HUGO.</p>
        <div className="group">
          <a className="item" href={`https://github.com/${process.env.GITHUB_REPO}/actions`} target="_blank" rel="noreferrer">
            <span className="grow">Ouvrir GitHub Actions</span>
            <Icon name="external" size={16} className="chev" />
          </a>
        </div>
      </section>

      <form action={logout} className="section">
        <div className="group">
          <button className="item btn danger block" type="submit" style={{ borderRadius: 0, justifyContent: 'flex-start', fontWeight: 500 }}>Se déconnecter</button>
        </div>
      </form>
    </>
  );
}
