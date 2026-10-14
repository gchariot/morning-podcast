import Link from 'next/link';
import { formatDate, loadEpisodes, todayInZurich } from '@/lib/episodes';
import { Player } from '@/components/Player';
import { Icon } from '@/components/Icon';
import { QuizCard } from '@/components/QuizCard';
import { GameCard } from '@/components/GameCard';
import { DebateCard } from '@/components/DebateCard';
import { loadSamedi } from '@/lib/samedi';
import { isRevealed, loadAnswers, quizStats } from '@/lib/quiz';

async function coverUrl(): Promise<string> {
  try {
    const base = process.env.PUBLIC_BASE_URL!.replace(/\/$/, '');
    const xml = await (await fetch(`${base}/${process.env.FEED_SECRET}/feed.xml`, { next: { revalidate: 3600 } })).text();
    return xml.match(/<itunes:image href="([^"]+)"/)?.[1] ?? '/cover.jpg';
  } catch {
    return '/cover.jpg';
  }
}

const minutes = (s: number) => `${Math.round(s / 60)} min`;
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export default async function EcouterPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  // Index des épisodes et pochette en parallèle.
  let error = false;
  const [episodes, cover, { answers }, { data: samedi }] = await Promise.all([
    loadEpisodes().catch(() => { error = true; return [] as Awaited<ReturnType<typeof loadEpisodes>>; }),
    coverUrl(),
    loadAnswers().catch(() => ({ answers: {} as Awaited<ReturnType<typeof loadAnswers>>['answers'] })),
    loadSamedi().catch(() => ({ data: {} as Awaited<ReturnType<typeof loadSamedi>>['data'] })),
  ]);
  const episode = episodes.find(e => e.date === date) ?? episodes[0];
  const isToday = episode?.date === todayInZurich();

  if (!episode) {
    return (
      <div className="page-head">
        <h1>{error ? 'Épisodes injoignables' : 'Pas encore d’épisode'}</h1>
        <p>
          {error
            ? 'La liste des épisodes n’a pas pu être lue sur le stockage. Réessaie dans un instant ; si ça dure, vérifie PUBLIC_BASE_URL et FEED_SECRET.'
            : 'Le prochain épisode est rédigé à 5 h 37 et arrive vers 6 h. En attendant, tu peux régler tes thèmes.'}
        </p>
        {!error && <Link className="btn primary" href="/themes" style={{ marginTop: 16 }}>Régler mes thèmes</Link>}
      </div>
    );
  }

  const others = episodes.filter(e => e.date !== episode.date).slice(0, 10);

  return (
    <>
      <div className="now">
        <img className="cover" src={cover} alt="" width={104} height={104} />
        <div>
          <p className="date">{isToday ? 'Aujourd’hui' : formatDate(episode.date)}</p>
          <h1>{episode.title}</h1>
          <p className="meta"><span className="num">{minutes(episode.seconds)}</span>{episode.chapters?.length ? ` · ${episode.chapters.length} chapitres` : ''}</p>
        </div>
      </div>

      <Player track={{
        date: episode.date, src: episode.url, title: episode.title, cover,
        seconds: episode.seconds, chapters: episode.chapters ?? [],
      }} />

      {episode.summary && <p className="summary">{episode.summary}</p>}
      {episode.debate && (
        <DebateCard
          key={`d-${episode.date}`} date={episode.date} topic={episode.debate.topic} sides={episode.debate.sides}
          myVote={samedi[episode.date]?.vote ?? null}
          closed={episodes.some(e => e.date > episode.date && e.debate)}
        />
      )}

      {episode.game && (() => {
        // Bonnes réponses envoyées seulement si le jeu a déjà été joué (sinon, elles restent sur le serveur).
        const played = samedi[episode.date]?.jeu;
        const qs = episode.game.questions;
        return (
          <GameCard
            key={`g-${episode.date}`} date={episode.date}
            questions={qs.map(q => ({ question: q.question, choices: q.choices }))}
            played={played ? { ok: true, message: '', answers: played.answers, correct: qs.map(q => q.answer), explanations: qs.map(q => q.explanation) } : null}
          />
        );
      })()}

      {episode.quiz && (() => {
        const revealed = isRevealed(episode.date, episodes);
        return (
          <QuizCard
            key={episode.date} date={episode.date} question={episode.quiz.question} choices={episode.quiz.choices}
            myChoice={answers[episode.date]?.choice ?? null}
            answer={revealed ? episode.quiz.answer : undefined}
            explanation={revealed ? episode.quiz.explanation : undefined}
            stats={quizStats(episodes, answers)}
          />
        );
      })()}

      <Link className="btn primary block cta" href="/avis">
        <Icon name="message" size={18} /> Donner mon avis pour demain
      </Link>

      {episode.sources.length > 0 && (
        <section className="section">
          <details className="group">
            <summary className="item">
              <span className="grow"><strong style={{ display: 'block' }}>Sources</strong><span className="meta">{episode.sources.length} {episode.sources.length > 1 ? 'articles cités' : 'article cité'} dans l&apos;épisode</span></span>
              <Icon name="chevron-right" className="chev" />
            </summary>
            {episode.sources.map(s => (
              <a key={s.url} className="item" href={s.url} target="_blank" rel="noreferrer">
                <span className="grow"><span style={{ display: 'block' }}>{s.title}</span><span className="meta">{host(s.url)}</span></span>
                <Icon name="external" size={16} className="chev" />
              </a>
            ))}
          </details>
        </section>
      )}

      {others.length > 0 && (
        <section className="section">
          <h2>Épisodes précédents</h2>
          <div className="group" style={{ marginTop: 12 }}>
            {others.map(e => (
              <Link key={e.date} href={`/?date=${e.date}`} className="item">
                <span className="grow">
                  <span className="meta">{formatDate(e.date)} · <span className="num">{minutes(e.seconds)}</span></span>
                  <span style={{ display: 'block', fontWeight: 500 }}>{e.title}</span>
                </span>
                <Icon name="chevron-right" className="chev" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
