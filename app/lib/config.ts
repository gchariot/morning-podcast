import 'server-only';
import { z } from 'zod';
import { readFile, writeFile } from './github';
import { JOURS } from './jours';

const CONFIG_PATH = 'config/rubriques.json';

/** Même structure que celle lue par la rédaction : toute écriture est validée avant d'être envoyée. */
export const Rubrique = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,30}$/, 'identifiant : lettres minuscules, chiffres, tirets'),
  title: z.string().trim().min(2).max(60),
  minutes: z.number().min(0.5).max(10),
  brief: z.string().trim().min(10).max(1200),
  domains: z.array(z.string().trim().regex(/^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i, 'domaine invalide')).max(25),
  enabled: z.boolean().optional(),
  /** Jours de diffusion en semaine ; absent = tous les jours. */
  jours: z.array(z.enum(JOURS)).min(1).max(5).optional(),
});
export type Rubrique = z.infer<typeof Rubrique>;

const Edition = z.object({
  targetMinutes: z.number().min(3).max(40),
  minutesFactor: z.number().min(0.2).max(1.5),
  skip: z.array(z.string()),
});

export const Config = z.object({
  show: z.object({
    title: z.string(),
    description: z.string(),
    language: z.string(),
    hosts: z.array(z.object({ name: z.string(), role: z.string() })),
    targetMinutes: z.number().min(3).max(40),
    wordsPerMinute: z.number().min(100).max(260),
  }).passthrough(),
  editions: z.record(z.string(), Edition).optional(),
  rubriques: z.array(Rubrique).min(1),
  football: z.unknown(),
}).passthrough();
export type Config = z.infer<typeof Config>;

export async function loadConfig(fresh = false): Promise<{ config: Config; sha: string }> {
  const file = await readFile(CONFIG_PATH, fresh);
  if (!file) throw new Error(`${CONFIG_PATH} introuvable dans le dépôt.`);
  return { config: Config.parse(JSON.parse(file.content)), sha: file.sha };
}

export async function saveConfig(config: Config, sha: string, message: string) {
  const checked = Config.parse(config);
  const ids = checked.rubriques.map(r => r.id);
  if (new Set(ids).size !== ids.length) throw new Error('Deux thèmes ont le même identifiant.');
  await writeFile(CONFIG_PATH, `${JSON.stringify(checked, null, 2)}\n`, message, sha);
}

export function slugify(title: string): string {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30).padEnd(2, '0').replace(/^(.)0$/, 'theme-$1') || 'theme';
}

export function parseDomains(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map(d => d.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''))
    .filter(Boolean);
}
