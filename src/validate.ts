/** Vérifie episodes/YYYY-MM-DD/script.json : format, locuteurs, longueur. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, dateFromArgs, loadConfig } from './lib.js';
import { Script } from './schema.js';

export function loadScript(date: string) {
  const file = resolve(ROOT, `episodes/${date}/script.json`);
  const parsed = Script.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    throw new Error(`script.json invalide :\n${parsed.error.issues.map(i => `- ${i.path.join('.')} : ${i.message}`).join('\n')}`);
  }
  const script = parsed.data;
  const { show } = loadConfig();
  const hosts = new Set(show.hosts.map(h => h.name));
  for (const seg of script.segments) {
    for (const t of seg.turns) {
      if (!hosts.has(t.speaker)) throw new Error(`Locuteur inconnu « ${t.speaker} » (attendu : ${[...hosts].join(', ')})`);
    }
  }
  const words = script.segments.flatMap(s => s.turns).reduce((n, t) => n + t.text.split(/\s+/).length, 0);
  return { script, words, minutes: words / show.wordsPerMinute };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const date = dateFromArgs();
  const { script, words, minutes } = loadScript(date);
  console.log(`OK : ${script.segments.length} rubriques, ${words} mots, ~${minutes.toFixed(1)} min.`);
}
