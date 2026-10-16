'use server';
import { z } from 'zod';
import { revalidatePath, updateTag } from 'next/cache';
import { requireLogin } from '@/lib/auth';
import { REPO_TAG } from '@/lib/github';
import { todayInZurich } from '@/lib/episodes';
import { SCENARIOS, extractFixes, saveSeance, type Fix } from '@/lib/english';

const Input = z.object({
  scenario: z.string().max(40),
  seconds: z.number().int().min(0).max(3600),
  fixes: z.array(z.object({ wrong: z.string().max(300), right: z.string().max(300), rule: z.string().max(200) })).max(30),
  transcript: z.string().max(20000),
});

export type SessionResult = { ok: boolean; message: string; fixes?: (Fix & { count: number })[] };

/** Fin de séance avec Nora : corrections enregistrées dans le carnet, avec le nombre de fois où chaque erreur revient. */
export async function saveEnglishSession(raw: z.input<typeof Input>): Promise<SessionResult> {
  await requireLogin();
  try {
    const input = Input.parse(raw);
    if (!SCENARIOS.some(s => s.id === input.scenario)) throw new Error('Scénario inconnu.');
    let fixes = input.fixes;
    if (!fixes.length) fixes = await extractFixes(input.transcript).catch(() => []);
    const counts = await saveSeance({ date: todayInZurich(), scenario: input.scenario, seconds: input.seconds, fixes });
    updateTag(REPO_TAG);
    revalidatePath('/english');
    return { ok: true, message: 'Séance enregistrée.', fixes: fixes.map((f, i) => ({ ...f, count: counts[i] ?? 1 })) };
  } catch (err) {
    console.error('[english/save]', err instanceof Error ? err.message : err);
    return { ok: false, message: 'La séance n’a pas pu être enregistrée : réessaie dans un instant.' };
  }
}
