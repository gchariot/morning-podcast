import { passwordEnabled } from '@/lib/auth';
import { loadConfig } from '@/lib/config';
import { SettingsEditor } from '@/components/SettingsEditor';
import { Icon } from '@/components/Icon';
import { logout } from '../actions';
import { loadEpisodes, todayInZurich } from '@/lib/episodes';
import { monthCost, pricePerMillion, usd } from '@/lib/costs';

export default async function ReglagesPage() {
  const [{ config }, episodes] = await Promise.all([loadConfig(), loadEpisodes().catch(() => [])]);
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

      <SettingsEditor initial={{
        targetMinutes: config.show.targetMinutes,
        samedi: editions.samedi?.targetMinutes ?? 25,
        dimanche: editions.dimanche?.targetMinutes ?? 10,
        sujet: docSubject,
      }} />

      <section className="section">
        <h2>Coulisses</h2>
        <details className="group" style={{ marginTop: 12 }}>
          <summary className="item">
            <span className="grow">
              <span style={{ fontWeight: 600, display: 'block' }}>Coût de la voix</span>
              <span className="meta num">{usd(cost.total)} en {monthName}{cost.count ? ` · environ ${usd(cost.projection30)} sur 30 jours` : ''}</span>
            </span>
            <Icon name="chevron-right" className="chev" />
          </summary>
          <p className="pad small muted" style={{ paddingBottom: 0 }}>Estimation à partir de la durée de voix générée et du tarif Gemini. La facture exacte est sur Google AI Studio.</p>
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
          <p className="pad field-hint" style={{ marginTop: 0 }}>Tarif de la voix : {pricePerMillion(todayInZurich())} $ par million de jetons audio{todayInZurich() < '2027-01-01' ? ' (tarif de lancement, il double au 1er janvier 2027)' : ''}.</p>
        </details>

        <details className="group" style={{ marginTop: 12 }}>
          <summary className="item">
            <span className="grow"><span style={{ fontWeight: 600, display: 'block' }}>Changer les voix</span><span className="meta">Voix Gemini de Léa, Hugo et Zoé (la météo)</span></span>
            <Icon name="chevron-right" className="chev" />
          </summary>
          <p className="pad small muted">Pour comparer d&apos;autres voix, lance « 0 · Test de voix » dans GitHub Actions, écoute les extraits, puis change les variables VOICE_LEA et VOICE_HUGO du dépôt.</p>
          <a className="item" href={`https://github.com/${process.env.GITHUB_REPO}/actions`} target="_blank" rel="noreferrer">
            <span className="grow">Ouvrir GitHub Actions</span>
            <Icon name="external" size={16} className="chev" />
          </a>
        </details>
      </section>

      {passwordEnabled() && <form action={logout} className="section">
        <div className="group">
          <button className="item btn danger block" type="submit" style={{ borderRadius: 0, justifyContent: 'flex-start', fontWeight: 500 }}>Se déconnecter</button>
        </div>
      </form>}
    </>
  );
}
