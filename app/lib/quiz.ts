import 'server-only';
import { z } from 'zod';
import { readFile, writeFile } from './github';
import type { Episode } from './episodes';

/** Réponses au quiz, dans le dépôt : { "2026-10-15": { "choice": 1, "at": "…" } }. Lu par la rédaction le lendemain. */
const PATH = 'quiz.json';
const Answers = z.record(z.string(), z.object({ choice: z.number().int().min(0), at: z.string() }));
export type Answers = z.infer<typeof Answers>;

export async function loadAnswers(fresh = false): Promise<{ answers: Answers; sha: string | null }> {
  const file = await readFile(PATH, fresh);
  if (!file) return { answers: {}, sha: null };
  const parsed = Answers.safeParse(JSON.parse(file.content || '{}'));
  return { answers: parsed.success ? parsed.data : {}, sha: file.sha };
}

export async function saveAnswer(date: string, choice: number) {
  const { answers, sha } = await loadAnswers(true);
  answers[date] = { choice, at: new Date().toISOString() };
  const sorted = Object.fromEntries(Object.entries(answers).sort(([a], [b]) => b.localeCompare(a)).slice(0, 120));
  await writeFile(PATH, `${JSON.stringify(sorted, null, 2)}\n`, `quiz: réponse au quiz du ${date} (app)`, sha ?? undefined);
}

/** La réponse d'un quiz n'est révélée qu'une fois un épisode plus récent publié (elle y est donnée à l'oral). */
export function isRevealed(date: string, episodes: Episode[]) {
  return episodes.some(e => e.date > date);
}

/** Bilan : bonnes réponses, quiz répondus (révélés seulement), série en cours. */
export function quizStats(episodes: Episode[], answers: Answers) {
  const revealed = episodes.filter(e => e.quiz && isRevealed(e.date, episodes)).sort((a, b) => b.date.localeCompare(a.date));
  let correct = 0, answered = 0, streak = 0, streakOpen = true;
  for (const e of revealed) {
    const a = answers[e.date];
    const ok = a !== undefined && a.choice === e.quiz!.answer;
    if (a !== undefined) { answered++; if (ok) correct++; }
    if (streakOpen) { if (ok) streak++; else streakOpen = false; }
  }
  return { correct, answered, streak };
}
