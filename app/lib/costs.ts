import type { Episode } from './episodes';

/**
 * Coût de la voix Gemini 3.8 Flash TTS (tarif public Google, en dollars) :
 * l'audio généré compte 25 jetons par seconde. Tarif de lancement 9 $ / million de jetons audio
 * jusqu'au 31/12/2026, puis 18 $. Le texte envoyé (≈ 0,003 $ par épisode) est négligeable.
 */
const TOKENS_PER_SECOND = 25;
const JINGLE_SECONDS = 10; // épisodes anciens sans ttsSeconds : on retire le jingle de la durée totale

export function pricePerMillion(date: string) {
  return date < '2027-01-01' ? 9 : 18;
}

export function episodeCost(e: Episode) {
  const seconds = e.ttsSeconds ?? Math.max(0, e.seconds - JINGLE_SECONDS);
  return (seconds * TOKENS_PER_SECOND / 1_000_000) * pricePerMillion(e.date);
}

/** Coût des épisodes d'un mois (YYYY-MM) et projection sur 30 jours. */
export function monthCost(episodes: Episode[], month: string) {
  const list = episodes.filter(e => e.date.startsWith(month));
  const total = list.reduce((s, e) => s + episodeCost(e), 0);
  const minutes = list.reduce((s, e) => s + (e.ttsSeconds ?? Math.max(0, e.seconds - JINGLE_SECONDS)), 0) / 60;
  const perEpisode = list.length ? total / list.length : 0;
  return { count: list.length, total, minutes, perEpisode, projection30: perEpisode * 30 };
}

export const usd = (n: number) => `${n.toFixed(2).replace('.', ',')} $`;
