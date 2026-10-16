import { SCENARIOS, loadCarnet, loadSeances, scenarioFor } from '@/lib/english';
import { loadEnglishEpisodes, todayInZurich } from '@/lib/episodes';
import { zurichMinutes } from '@/lib/sky';
import { SkyBand } from '@/components/Sky';
import { EnglishSession } from '@/components/EnglishSession';
import { EnglishEpisode } from '@/components/EnglishEpisode';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** Les 7 dates (AAAA-MM-JJ) de la semaine en cours, du lundi au dimanche. */
function weekOf(today: string): string[] {
  const d = new Date(`${today}T12:00:00Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

export default async function EnglishPage({ searchParams }: { searchParams: Promise<{ play?: string }> }) {
  const autoplay = (await searchParams).play !== undefined;
  const today = todayInZurich();
  const [carnet, seances, episodes] = await Promise.all([
    loadCarnet().then(r => r.data).catch(() => []),
    loadSeances().then(r => r.data).catch(() => []),
    loadEnglishEpisodes().catch(() => []),
  ]);
  const scenario = scenarioFor(today);
  // L'épisode du matin, s'il est sorti (en semaine, vers 6 h) et qu'il porte bien sur la situation du jour.
  const episode = episodes.find(e => e.date === today && e.scenario === scenario.id);
  const phrases = episode?.phrases.length ? episode.phrases : scenario.phrases;
  const week = weekOf(today);
  const spoken = new Set(seances.map(s => s.date));
  const weekSecs = seances.filter(s => week.includes(s.date)).reduce((n, s) => n + s.seconds, 0);
  const recurring = [...carnet].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).filter(e => e.count > 1).slice(0, 3);
  let streak = 0;
  for (let d = new Date(`${today}T12:00:00Z`); ; d = new Date(d.getTime() - 86_400_000)) {
    const iso = d.toISOString().slice(0, 10);
    if (spoken.has(iso)) streak++;
    else if (iso !== today) break;
    if (streak > 365) break;
  }

  return (
    <>
      <SkyBand minutes={zurichMinutes()}>
        <h1 lang="en">{scenario.title}</h1>
        <p className="sky-meta">English · {episode ? <><span className="num">{Math.round(episode.seconds / 60)} min</span> ce matin, puis Nora</> : <>Nora joue {scenario.role}</>}</p>
      </SkyBand>

      {episode && (
        <EnglishEpisode autoplay={autoplay} track={{
          date: `en-${episode.date}`, src: episode.url, title: episode.title, cover: '/cover.jpg',
          seconds: episode.seconds, chapters: episode.chapters,
        }} />
      )}

      <EnglishSession scenario={scenario.id} role={scenario.role} brief={scenario.brief}>
        <section className="section" aria-labelledby="ph-h">
          <h2 id="ph-h">Les phrases du jour</h2>
          <div className="group" style={{ marginTop: 12 }}>
            {phrases.map(p => (
              <div className="phrase" key={p.en}>
                <q lang="en">{p.en}</q>
                <span className="meta">{p.fr}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section" aria-labelledby="prog-h">
          <div className="spread">
            <h2 id="prog-h">Ta progression</h2>
            {streak > 1 && <span className="muted small">{streak} jours d’affilée</span>}
          </div>
          <div className="group" style={{ marginTop: 12 }}>
            <ol className="week" aria-label="Cette semaine">
              {week.map((d, i) => {
                const did = spoken.has(d);
                const future = d > today;
                return (
                  <li key={d} className={`${did ? 'spoke' : ''}${d === today ? ' today' : ''}${future ? ' future' : ''}`}
                    aria-label={`${NAMES[i]} : ${future ? 'à venir' : did ? 'parlé avec Nora' : 'pas de séance'}`}>
                    {DAYS[i]}<span className={`mark${did ? ' on' : ''}`} aria-hidden />
                  </li>
                );
              })}
            </ol>
            <div className="item"><span className="grow">Parlé cette semaine</span><span className="stat">{weekSecs > 0 && weekSecs < 60 ? '< 1' : Math.round(weekSecs / 60)} min</span></div>
            {recurring.length > 0 && (
              <div className="item">
                <span className="grow">
                  <span style={{ display: 'block' }}>Ce qui revient</span>
                  <span className="meta">
                    {recurring.map((e, i) => <span key={e.rule}>{i > 0 && ' · '}{e.rule} <span className="num">({e.count} fois)</span></span>)}
                  </span>
                </span>
              </div>
            )}
          </div>
          {!seances.length && <p className="field-hint" style={{ marginTop: 10 }}>Une séance par jour suffit : {SCENARIOS.length} situations pro tournent, Nora retient tes erreurs d’une fois sur l’autre.</p>}
        </section>
      </EnglishSession>
    </>
  );
}
