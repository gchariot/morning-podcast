import 'server-only';
import { z } from 'zod';
import { readFile, writeFile } from './github';

/**
 * Réponses du samedi, dans le dépôt (lues par la rédaction) :
 * { "2026-10-17": { "jeu": { "answers": [0, 2, …], "at": "…" }, "vote": 1 } }
 * vote : 0 = position de Léa, 1 = position de Hugo.
 */
const PATH = 'samedi.json';
const Entry = z.object({
  jeu: z.object({ answers: z.array(z.number().int().min(0)), at: z.string() }).optional(),
  vote: z.union([z.literal(0), z.literal(1)]).optional(),
});
const File = z.record(z.string(), Entry);
export type SamediFile = z.infer<typeof File>;

export async function loadSamedi(fresh = false): Promise<{ data: SamediFile; sha: string | null }> {
  const file = await readFile(PATH, fresh);
  if (!file) return { data: {}, sha: null };
  const parsed = File.safeParse(JSON.parse(file.content || '{}'));
  return { data: parsed.success ? parsed.data : {}, sha: file.sha };
}

export async function updateSamedi(date: string, patch: z.infer<typeof Entry>, message: string) {
  const { data, sha } = await loadSamedi(true);
  data[date] = { ...data[date], ...patch };
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => b.localeCompare(a)).slice(0, 60));
  await writeFile(PATH, `${JSON.stringify(sorted, null, 2)}\n`, message, sha ?? undefined);
}
