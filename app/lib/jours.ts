/** Jours de diffusion des thèmes en semaine (le week-end a ses propres éditions, réglées dans Réglages). */

export const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven'] as const;
export type Jour = (typeof JOURS)[number];

export const JOUR_COURT: Record<Jour, string> = { lun: 'Lun', mar: 'Mar', mer: 'Mer', jeu: 'Jeu', ven: 'Ven' };
export const JOUR_LONG: Record<Jour, string> = { lun: 'lundi', mar: 'mardi', mer: 'mercredi', jeu: 'jeudi', ven: 'vendredi' };
const ABBR: Record<Jour, string> = { lun: 'lun.', mar: 'mar.', mer: 'mer.', jeu: 'jeu.', ven: 'ven.' };

/** Un thème sans `jours` passe tous les jours de la semaine. */
export const passes = (jours: readonly Jour[] | undefined, day: Jour) => !jours || jours.includes(day);

/** Liste triée, sans doublon ; « tous les jours » s'écrit `undefined` (pas de champ dans le fichier). */
export function normalizeJours(jours: readonly string[] | undefined): Jour[] | undefined {
  if (!jours) return undefined;
  const set = JOURS.filter(j => jours.includes(j));
  return set.length === 0 || set.length === JOURS.length ? undefined : set;
}

/** « le lundi », « lun. et jeu. », « lun., mer., ven. », « sauf le mercredi » ; '' pour tous les jours. */
export function joursLabel(jours: readonly Jour[] | undefined): string {
  const j = normalizeJours(jours);
  if (!j) return '';
  if (j.length === 1) return `le ${JOUR_LONG[j[0]]}`;
  if (j.length === 4) return `sauf le ${JOUR_LONG[JOURS.find(d => !j.includes(d))!]}`;
  if (j.length === 2) return `${ABBR[j[0]]} et ${ABBR[j[1]]}`;
  return j.map(d => ABBR[d]).join(', ');
}

/**
 * Jour du prochain épisode de semaine, à Genève : aujourd'hui avant la rédaction (5 h 37),
 * sinon le lendemain ; un samedi ou un dimanche renvoie au lundi.
 */
export function nextWeekdayEpisode(now = new Date()): Jour {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let i = order.indexOf(parts.weekday);
  if (Number(parts.hour) * 60 + Number(parts.minute) >= 5 * 60 + 37) i = (i + 1) % 7;
  return i >= 5 ? 'lun' : JOURS[i];
}

/** Durée d'un thème un jour donné : la durée propre à ce jour si elle existe, sinon la durée habituelle. */
export function minutesFor(r: { minutes: number; minutesParJour?: Partial<Record<Jour, number>> }, day: Jour): number {
  return r.minutesParJour?.[day] ?? r.minutes;
}

/**
 * Range les durées par jour : celles égales à la durée habituelle disparaissent ; si tous les jours ont
 * la même durée propre, elle devient la durée habituelle.
 */
export function normalizeMinutes(minutes: number, parJour: Partial<Record<Jour, number>> | undefined): { minutes: number; minutesParJour?: Partial<Record<Jour, number>> } {
  const all = JOURS.map(d => parJour?.[d] ?? minutes);
  const base = all.every(v => v === all[0]) ? all[0] : minutes;
  const rest = Object.fromEntries(JOURS.filter(d => all[JOURS.indexOf(d)] !== base).map(d => [d, all[JOURS.indexOf(d)]]));
  return Object.keys(rest).length ? { minutes: base, minutesParJour: rest } : { minutes: base };
}

export type OrdreParJour = Partial<Record<Jour, string[]>>;

/**
 * Ordre des thèmes un jour donné : l'ordre propre à ce jour s'il existe (les thèmes ajoutés depuis
 * se placent ensuite, dans l'ordre habituel), sinon l'ordre habituel. La météo reste toujours en dernier.
 */
export function orderFor<T extends { id: string }>(list: T[], ordre: OrdreParJour | undefined, day: Jour): T[] {
  const ids = ordre?.[day];
  if (!ids?.length) return list;
  const byId = new Map(list.map(r => [r.id, r]));
  const head = ids.map(id => byId.get(id)).filter((r): r is T => Boolean(r) && r!.id !== 'meteo');
  const rest = list.filter(r => !ids.includes(r.id) && r.id !== 'meteo');
  const meteo = list.filter(r => r.id === 'meteo');
  return [...head, ...rest, ...meteo];
}
