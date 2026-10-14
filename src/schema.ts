import { z } from 'zod';

export const Turn = z.object({
  speaker: z.string().min(1),
  /** Indication de jeu courte, ex. « enjoué », « posé ». Optionnelle. */
  style: z.string().max(60).optional(),
  text: z.string().min(1).max(1500),
});

export const Segment = z.object({
  rubrique: z.string().min(1),
  titre: z.string().min(1),
  turns: z.array(Turn).min(1),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
});

/** Question du quiz : posée à la fin de la culture générale, réponse donnée le lendemain. */
export const Quiz = z.object({
  question: z.string().min(5).max(300),
  choices: z.array(z.string().min(1).max(120)).min(3).max(4),
  /** Index de la bonne réponse dans `choices` (0 = A). */
  answer: z.number().int().min(0),
  /** Une ou deux phrases d'explication, lues le lendemain avec la réponse. */
  explanation: z.string().max(400).optional(),
}).refine(q => q.answer < q.choices.length, { message: 'answer doit désigner un des choix', path: ['answer'] });

export const Script = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  segments: z.array(Segment).min(1),
  quiz: Quiz.optional(),
});

export type Script = z.infer<typeof Script>;
export type Turn = z.infer<typeof Turn>;
export type Quiz = z.infer<typeof Quiz>;
