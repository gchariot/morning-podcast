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

/** Le jeu du samedi : 8 questions sur la semaine, réponses données en fin d'épisode. */
export const Game = z.object({
  questions: z.array(z.object({
    question: z.string().min(5).max(300),
    choices: z.array(z.string().min(1).max(120)).min(3).max(4),
    answer: z.number().int().min(0),
    explanation: z.string().max(300).optional(),
  }).refine(q => q.answer < q.choices.length, { message: 'answer doit désigner un des choix', path: ['answer'] })).min(6).max(10),
});

/** Le face-à-face du samedi : un sujet, la position de Léa (0) et celle de Hugo (1). */
export const Debate = z.object({
  topic: z.string().min(5).max(160),
  sides: z.tuple([z.string().min(3).max(200), z.string().min(3).max(200)]),
});

export const Script = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  segments: z.array(Segment).min(1),
  quiz: Quiz.optional(),
  game: Game.optional(),
  debate: Debate.optional(),
  /** Ce que la rédaction a changé grâce aux retours de l'auditeur (affiché dans l'appli). */
  applied: z.array(z.string().min(3).max(160)).max(4).optional(),
});

export type Script = z.infer<typeof Script>;
export type Turn = z.infer<typeof Turn>;
export type Quiz = z.infer<typeof Quiz>;
export type Game = z.infer<typeof Game>;
export type Debate = z.infer<typeof Debate>;
