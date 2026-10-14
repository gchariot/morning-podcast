import Link from 'next/link';
import { formatDate, loadEpisodes, todayInZurich } from '@/lib/episodes';
import { Player } from '@/components/Player';

async function coverUrl(): Promise<string | null> {
  try {
    const base = process.env.PUBLIC_BASE_URL!.replace(/\/$/, '');
    const xml = await (await fetch(`${base}/${process.env.FEED_SECRET}/feed.xml`, { cache: 'no-store' })).text();
    return xml.match(/<itunes:image href="([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export default async function EcouterPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  let episodes: Awaited<ReturnType<typeof loadEpisodes>> = [];
  let error: string | null = null;
  try {
    episodes = await loadEpisodes();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const cover = await coverUrl();
  const episode = episodes.find(e => e.date === date) ?? episodes[0];
  const isToday = episode?.date === todayInZurich();

  if (!episode) {
    return (
      <div className="stack">
        <p className="kicker">Écouter</p>
        <h1>Pas encore d&apos;épisode</h1>
        <p className="muted">{error ?? 'Le premier épisode arrivera demain matin vers 6 h.'}</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        {cover && <img className="cover" src={cover} alt="" width={112} height={112} />}
        <div>
          <p className="kicker">{isToday ? "L'épisode du jour" : formatDate(episode.date)}</p>
          <h1 style={{ fontSize: 22 }}>{episode.title}</h1>
          <p className="muted small">{Math.round(episode.seconds / 60)} min · {formatDate(episode.date)}</p>
        </div>
      </div>

      <div className="card">
        <Player src={episode.url} title={episode.title} chapters={episode.chapters ?? []} storageKey={`matinale_pos_${episode.date}`} />
      </div>

      <p>{episode.summary}</p>
      <Link className="btn primary" href="/avis" style={{ width: '100%' }}>💬 Donner mon avis sur cet épisode</Link>

      {episode.sources.length > 0 && (
        <details className="card">
          <summary><strong>Sources ({episode.sources.length})</strong></summary>
          <ul className="small" style={{ paddingLeft: 18, marginTop: 12 }}>
            {episode.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}
          </ul>
        </details>
      )}

      {episodes.length > 1 && (
        <section className="stack" style={{ marginTop: 24 }}>
          <h2>Épisodes précédents</h2>
          {episodes.filter(e => e.date !== episode.date).slice(0, 10).map(e => (
            <Link key={e.date} href={`/?date=${e.date}`} className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <span className="muted small">{formatDate(e.date)} · {Math.round(e.seconds / 60)} min</span>
              <div>{e.title}</div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
