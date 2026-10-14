/**
 * Test de voix : `npm run tts:test` → out/test-*.wav|mp3.
 * Par défaut, lit environ une minute d'un vrai épisode (TEST_RUBRIQUE, défaut « foot ») pour comparer
 * les fournisseurs sur exactement le même texte. TEST_TEXT=court garde l'ancien extrait de 20 secondes.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, ensureDir } from './lib.js';
import { getProvider } from './tts/index.js';
import type { Turn } from './schema.js';

const SHORT: Turn[] = [
  { speaker: 'Léa', style: 'enjouée', text: "Bonjour et bienvenue dans la Matinale ! On a du lourd ce matin." },
  { speaker: 'Hugo', style: 'complice', text: "Bonjour Léa. Au programme : l'IA, l'OL, et une anecdote d'histoire pour finir." },
  { speaker: 'Léa', text: 'Alors on commence tout de suite.' },
];

function episodeExtract(maxChars = 1000): Turn[] | null {
  const dir = resolve(ROOT, 'episodes');
  if (!existsSync(dir)) return null;
  const dates = readdirSync(dir).filter(d => existsSync(resolve(dir, d, 'script.json'))).sort();
  const last = dates.at(-1);
  if (!last) return null;
  const script = JSON.parse(readFileSync(resolve(dir, last, 'script.json'), 'utf8'));
  const wanted = process.env.TEST_RUBRIQUE || 'foot';
  const seg = script.segments.find((s: { rubrique: string }) => s.rubrique === wanted) ?? script.segments[1] ?? script.segments[0];
  const out: Turn[] = [];
  let n = 0;
  for (const t of seg.turns as Turn[]) {
    if (n > 0 && n + t.text.length > maxChars) break;
    out.push(t); n += t.text.length;
  }
  console.log(`Extrait : épisode du ${last}, rubrique « ${seg.rubrique} », ${out.length} répliques, ${n} caractères.`);
  return out;
}

const turns = process.env.TEST_TEXT === 'court' ? SHORT : episodeExtract() ?? SHORT;
const { name, synth } = getProvider();
ensureDir(resolve(ROOT, 'out'));
const files = await synth(turns, resolve(ROOT, `out/test-${name}`));
console.log(`Fichiers générés avec ${name} :\n${files.join('\n')}`);
