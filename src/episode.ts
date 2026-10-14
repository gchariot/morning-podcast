/**
 * Étape 3 — lancée par GitHub Actions quand episodes/<date>/script.json arrive.
 * script.json → voix (une rubrique à la fois) → montage MP3 → publication + flux RSS.
 * Une rubrique qui échoue est sautée : mieux vaut un épisode incomplet que pas d'épisode.
 */
import { resolve } from 'node:path';
import { ROOT, dateFromArgs, ensureDir } from './lib.js';
import { loadScript } from './validate.js';
import { getProvider } from './tts/index.js';
import { assemble, durationSeconds } from './assemble.js';
import { publish } from './publish.js';

const date = dateFromArgs();
const { script, words, minutes } = loadScript(date);
console.log(`Script du ${date} : ${script.segments.length} rubriques, ${words} mots (~${minutes.toFixed(1)} min).`);

const outDir = resolve(ROOT, `out/${date}`);
ensureDir(outDir);
const { name, synth } = getProvider();

const files: string[] = [];
const skipped: string[] = [];
for (const [i, seg] of script.segments.entries()) {
  try {
    console.log(`→ ${seg.titre} (${name})`);
    files.push(...(await synth(seg.turns, resolve(outDir, `${String(i).padStart(2, '0')}-${seg.rubrique}`))));
  } catch (err) {
    console.error(`⚠️ Rubrique « ${seg.titre} » sautée : ${(err as Error).message}`);
    skipped.push(seg.titre);
  }
}
if (!files.length) throw new Error('Aucune rubrique synthétisée : épisode annulé.');

const mp3 = resolve(outDir, `matinale-${date}.mp3`);
assemble(files, mp3);
const seconds = durationSeconds(mp3);
console.log(`MP3 : ${mp3} (${Math.round(seconds / 60)} min)`);

if (process.env.SKIP_PUBLISH === '1') {
  console.log('SKIP_PUBLISH=1 : publication ignorée.');
} else {
  const { feedUrl, episodeUrl } = await publish(date, mp3, seconds, script);
  console.log(`Publié : ${episodeUrl}\nFlux : ${feedUrl}`);
}
if (skipped.length) {
  console.error(`Rubriques manquantes : ${skipped.join(', ')}`);
  process.exitCode = 1; // le run apparaît en échec → mail de GitHub, mais l'épisode est publié
}
