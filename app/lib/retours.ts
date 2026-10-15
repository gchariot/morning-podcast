import 'server-only';
import { readFile, writeFile } from './github';

const PATH = 'retours.md';
const PERMANENT = '## Consignes permanentes';
const RECENT = '## Retours récents';

export type Retours = { permanent: string[]; recent: string[]; sha: string | null; raw: string };

const TEMPLATE = `# Mes retours sur La Matinale

Ajoute une ligne quand quelque chose te plaît ou t'agace : la rédaction lit ce fichier chaque matin et adapte l'épisode.

${PERMANENT}

${RECENT}
`;

function bulletsOf(section: string): string[] {
  return section
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- '))
    .map(l => l.slice(2).trim());
}

function sections(raw: string) {
  const p = raw.indexOf(PERMANENT), r = raw.indexOf(RECENT);
  if (p < 0 || r < 0 || r < p) return null;
  return { head: raw.slice(0, p), permanent: raw.slice(p + PERMANENT.length, r), recent: raw.slice(r + RECENT.length) };
}

/** Consignes permanentes d'un contenu brut de retours.md (pour comparer deux versions). */
export function permanentOf(raw: string): string[] {
  const s = sections(raw);
  return s ? bulletsOf(s.permanent) : [];
}

export async function loadRetours(fresh = false): Promise<Retours> {
  const file = await readFile(PATH, fresh);
  const raw = file?.content ?? TEMPLATE;
  const s = sections(raw) ?? sections(TEMPLATE)!;
  return { permanent: bulletsOf(s.permanent), recent: bulletsOf(s.recent), sha: file?.sha ?? null, raw };
}

function render(head: string, permanent: string[], recent: string[]): string {
  const list = (items: string[]) => (items.length ? `${items.map(i => `- ${i}`).join('\n')}\n` : '');
  return `${head.trimEnd()}\n\n${PERMANENT}\n${list(permanent)}\n${RECENT}\n${list(recent)}`;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 400);

/** Ajoute des retours datés en tête des « retours récents » (et garde les 60 derniers). */
export async function addRecent(lines: string[], date: string) {
  const r = await loadRetours(true);
  const s = sections(r.raw) ?? sections(TEMPLATE)!;
  const fresh = lines.map(clean).filter(Boolean).map(l => `${date} : ${l}`);
  if (!fresh.length) return 0;
  const recent = [...fresh, ...r.recent].slice(0, 60);
  await writeFile(PATH, render(s.head, r.permanent, recent), `retours: ${fresh.length} avis du ${date} (app)`, r.sha ?? undefined);
  return fresh.length;
}

export async function setPermanent(permanent: string[]) {
  const r = await loadRetours(true);
  const s = sections(r.raw) ?? sections(TEMPLATE)!;
  const items = permanent.map(clean).filter(Boolean).slice(0, 40);
  await writeFile(PATH, render(s.head, items, r.recent), 'retours: consignes permanentes mises à jour (app)', r.sha ?? undefined);
}

/** Retire un retour récent précis (pour corriger un avis envoyé par erreur). */
export async function removeRecent(line: string) {
  const r = await loadRetours(true);
  const s = sections(r.raw) ?? sections(TEMPLATE)!;
  const i = r.recent.indexOf(line);
  if (i < 0) throw new Error('Ce retour a déjà été retiré.');
  const recent = r.recent.filter((_, j) => j !== i);
  await writeFile(PATH, render(s.head, r.permanent, recent), 'retours: un avis retiré (app)', r.sha ?? undefined);
}

const topicOf = (line: string) => line.replace(/^\d{4}-\d{2}-\d{2}\s*:\s*/, '').match(/^\[([^\]]+)\]/)?.[1] ?? '';

/**
 * Avis sur un épisode : pour chaque sujet touché, l'ancienne ligne est remplacée (un seul avis par sujet et par épisode).
 * Renvoie les lignes de cet épisode après écriture.
 */
export async function replaceEpisodeFeedback(tag: string, topics: string[], lines: string[], date: string): Promise<string[]> {
  const r = await loadRetours(true);
  const s = sections(r.raw) ?? sections(TEMPLATE)!;
  const kept = r.recent.filter(l => !(l.endsWith(tag) && topics.includes(topicOf(l))));
  const fresh = lines.map(clean).filter(Boolean).map(l => `${date} : ${l}`);
  const recent = [...fresh, ...kept].slice(0, 60);
  const removed = r.recent.length - kept.length;
  await writeFile(PATH, render(s.head, r.permanent, recent), `retours: ${fresh.length} avis, ${removed} remplacé(s) — ${date} (app)`, r.sha ?? undefined);
  return recent.filter(l => l.endsWith(tag));
}
