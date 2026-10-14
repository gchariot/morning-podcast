import 'server-only';

export type Episode = {
  date: string;
  title: string;
  summary: string;
  url: string;
  bytes: number;
  seconds: number;
  sources: { title: string; url: string }[];
  chapters?: { title: string; startSec: number }[];
  quiz?: { question: string; choices: string[]; answer: number; explanation?: string };
  /** Secondes de voix générées (hors jingle), pour le coût. Absent sur les tout premiers épisodes. */
  ttsSeconds?: number;
};

export async function loadEpisodes(): Promise<Episode[]> {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  const secret = process.env.FEED_SECRET;
  if (!base || !secret) throw new Error('PUBLIC_BASE_URL ou FEED_SECRET manquant.');
  // Un épisode par jour : 5 min de cache suffisent et rendent l'écran instantané.
  const res = await fetch(`${base}/${secret}/episodes.json`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Index des épisodes indisponible (${res.status}).`);
  return (await res.json()) as Episode[];
}

/** Date du jour à Genève (YYYY-MM-DD). */
export function todayInZurich(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}
