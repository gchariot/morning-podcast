/** Lecture des lignes de retours.md, côté serveur comme côté téléphone. */

export type Vote = 'up' | 'down' | '';
export type Saved = { vote: Vote; chips: string[]; note: string };

export const CHIPS: Record<'up' | 'down', string[]> = {
  // Les trois premières sont visibles d'emblée, les autres derrière « Plus… ».
  up: ['Parfait comme ça', 'Bien expliqué', 'Plus de ça', 'Drôle'],
  down: ['Trop long', 'Pas assez de détails', 'Sujet raté', 'Trop court', 'Trop technique', 'Déjà entendu'],
};
const ALL_CHIPS = new Set([...CHIPS.up, ...CHIPS.down]);

/** « 2026-10-14 : [Football] 👎 Trop long (épisode du 2026-10-14) » → sujet, vote, précisions, mot. */
export function parseLine(line: string): { day: string; topic: string } & Saved {
  const day = line.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const body = line.replace(/^\d{4}-\d{2}-\d{2}\s*:\s*/, '').replace(/\s*\(épisode du [^)]*\)$/, '');
  const m = body.match(/^\[([^\]]+)\]\s*(.*)$/);
  let rest = (m ? m[2] : body).trim();
  let vote: Vote = '';
  if (rest.startsWith('👍')) { vote = 'up'; rest = rest.slice(2).trim(); }
  else if (rest.startsWith('👎')) { vote = 'down'; rest = rest.slice(2).trim(); }
  let chips: string[] = [], note = '';
  const [left, ...right] = rest.split(' — ');
  const tokens = left ? left.split(/,\s*/) : [];
  if (tokens.length && tokens.every(t => ALL_CHIPS.has(t))) { chips = tokens; note = right.join(' — '); }
  else note = rest;
  return { day: day ? `${day[3]}/${day[2]}` : '', topic: m ? m[1] : '', vote, chips, note };
}
