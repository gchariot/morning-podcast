import { loadConfig } from '@/lib/config';
import { Flash, type FlashParams } from '@/components/Flash';
import { Icon } from '@/components/Icon';
import { logout, updateSettings } from '../actions';
import { loadEpisodes, todayInZurich } from '@/lib/episodes';
import { monthCost, pricePerMillion, usd } from '@/lib/costs';

// Le dimanche a son propre format (le documentaire) : seul le samedi garde les réglages d'édition courte.
const DAYS = [
  { id: 'samedi', label: 'Samedi' },
];

export default async function ReglagesPage({ searchParams }: { searchParams: FlashParams }) {
  const [{ ok, err }, { config }, episodes] = await Promise.all([searchParams, loadConfig(), loadEpisodes().catch(() => [])]);
  const month = todayInZurich().slice(0, 7);
  const cost = monthCost(episodes, month);
  const monthName = new Intl.DateTimeFormat('fr-CH', { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`));
  const editions = config.editions ?? {};
  const docSubject = String((config as { documentaire?: { sujet?: string } }).documentaire?.sujet ?? '');

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

        <section className="section" style={{ marginTop: 28 }}>
          <h2>Dimanche : le documentaire</h2>
          <p className="hint">Un seul sujet de culture générale, raconté en plusieurs actes, puis la météo. Pas d&apos;actualité ce jour-là.</p>
          <fieldset className="group">
            <legend className="sr">Documentaire du dimanche</legend>
            <div className="item">
              <label htmlFor="dimanche_minutes" className="grow" style={{ margin: 0, color: 'var(--ink)', fontWeight: 500 }}>Durée</label>
              <input id="dimanche_minutes" name="dimanche_minutes" type="number" min={5} max={30} defaultValue={editions.dimanche?.targetMinutes ?? 10} style={{ width: 80 }} />
              <span className="muted small">min</span>
            </div>
            <div className="pad">
              <label htmlFor="dimanche_sujet">Sujet souhaité (facultatif)</label>
              <input id="dimanche_sujet" name="dimanche_sujet" type="text" maxLength={200} defaultValue={docSubject}
                placeholder="Ex. : le percement du tunnel du Gothard" />
              <p className="field-hint">Vide : la rédaction choisit. Un sujet déjà traité un dimanche précédent n&apos;est pas refait.</p>
            </div>
          </fieldset>
        </section>

        <button className="btn primary block" type="submit" style={{ marginTop: 24 }}>Enregistrer</button>
      </form>

      <section className="section">
        <h2>Coût</h2>
        <p className="hint">Estimation à partir de la durée de voix générée et du tarif Gemini. La facture exacte est sur Google AI Studio.</p>
        <div className="group">
          <div className="item">
            <span className="grow">Voix Gemini en {monthName}<span className="meta" style={{ display: 'block' }}>{cost.count} épisode{cost.count > 1 ? 's' : ''} · {Math.round(cost.minutes)} min de voix</span></span>
            <strong className="num">{usd(cost.total)}</strong>
          </div>
          <div className="item">
            <span className="grow">Projection sur 30 jours<span className="meta" style={{ display: 'block' }}>{cost.count ? `${usd(cost.perEpisode)} par épisode en moyenne` : 'Disponible après le premier épisode du mois'}</span></span>
            <strong className="num">{cost.count ? usd(cost.projection30) : '—'}</strong>
          </div>
          <div className="item">
            <span className="grow">Le reste<span className="meta" style={{ display: 'block' }}>Rédaction : incluse dans Claude Pro. Hébergement (Vercel, Cloudflare R2, GitHub Actions) et données (football-data, Open-Meteo, Wikipédia) : offres gratuites.</span></span>
            <strong className="num">0 $</strong>
          </div>
        </div>
        <p className="field-hint">Tarif de la voix : {pricePerMillion(todayInZurich())} $ par million de jetons audio{todayInZurich() < '2027-01-01' ? ' (tarif de lancement, il double au 1er janvier 2027)' : ''}.</p>
      </section>

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
