/** Test rapide de la voix : `npm run tts:test` → out/test-*.wav|mp3 (≈ 20 secondes). */
import { resolve } from 'node:path';
import { ROOT, ensureDir } from './lib.js';
import { getProvider } from './tts/index.js';

const turns = [
  { speaker: 'Léa', style: 'enjouée', text: "Bonjour et bienvenue dans la Matinale ! On a du lourd ce matin." },
  { speaker: 'Hugo', style: 'complice', text: "Bonjour Léa. Au programme : l'IA, l'OL, et une anecdote d'histoire pour finir." },
  { speaker: 'Léa', text: 'Alors on commence tout de suite.' },
];

const { name, synth } = getProvider();
ensureDir(resolve(ROOT, 'out'));
const files = await synth(turns, resolve(ROOT, `out/test-${name}`));
console.log(`Fichiers générés avec ${name} :\n${files.join('\n')}`);
