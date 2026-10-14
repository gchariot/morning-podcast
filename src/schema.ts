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

export const Script = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  segments: z.array(Segment).min(1),
});

export type Script = z.infer<typeof Script>;
export type Turn = z.infer<typeof Turn>;
