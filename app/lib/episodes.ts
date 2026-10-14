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
};

export async function loadEpisodes(): Promise<Episode[]> {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  const secret = process.env.FEED_SECRET;
  if (!base || !secret) throw new Error('PUBLIC_BASE_URL ou FEED_SECRET manquant.');
  const res = await fetch(`${base}/${secret}/episodes.json`, { cache: 'no-store' });
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
