import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type Rubrique = {
  id: string;
  title: string;
  minutes: number;
  brief: string;
  domains: string[];
};

export type Config = {
  show: {
    title: string;
    description: string;
    language: string;
    hosts: { name: string; role: string }[];
    targetMinutes: number;
    wordsPerMinute: number;
  };
  rubriques: Rubrique[];
  football: { competitions: string[]; favouriteTeams: string[] };
};

export function loadConfig(): Config {
  return JSON.parse(readFileSync(resolve(ROOT, 'config/rubriques.json'), 'utf8'));
}

/** Date du jour à Genève, au format YYYY-MM-DD (le runner GitHub est en UTC). */
export function todayInZurich(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(now);
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lit --date=YYYY-MM-DD dans les arguments, sinon aujourd'hui à Genève. */
export function dateFromArgs(argv = process.argv): string {
  const arg = argv.find(a => a.startsWith('--date='));
  const date = arg ? arg.slice('--date='.length) : todayInZurich();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Date invalide : ${date}`);
  return date;
}

export function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}
