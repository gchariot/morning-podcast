/**
 * Étape 3 — lancée par GitHub Actions quand episodes/<date>/script.json arrive.
 * script.json → voix (une rubrique à la fois) → montage MP3 avec chapitres → publication + flux RSS.
 * Une rubrique qui échoue est sautée : mieux vaut un épisode incomplet que pas d'épisode.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, dateFromArgs, ensureDir } from './lib.js';
import { loadScript } from './validate.js';
import { getProvider } from './tts/index.js';
import { assemble, computeChapters, durationSeconds, type SegmentAudio } from './assemble.js';
import { publish } from './publish.js';

const date = dateFromArgs();
const { script, words, minutes } = loadScript(date);
console.log(`Script du ${date} : ${script.segments.length} rubriques, ${words} mots (~${minutes.toFixed(1)} min).`);

const outDir = resolve(ROOT, `out/${date}`);
ensureDir(outDir);
const { name, synth } = getProvider();

const results: (SegmentAudio | null)[] = script.segments.map(() => null);
const errors = new Map<number, string>();
const synthOne = async (i: number) => {
  const seg = script.segments[i];
  try {
    console.log(`→ ${seg.titre} (${name})`);
    results[i] = { title: seg.titre, files: await synth(seg.turns, resolve(outDir, `${String(i).padStart(2, '0')}-${seg.rubrique}`)) };
    errors.delete(i);
  } catch (err) {
    errors.set(i, (err as Error).message);
    console.error(`⚠️ Rubrique « ${seg.titre} » en échec : ${(err as Error).message}`);
  }
};
for (const i of script.segments.keys()) await synthOne(i);
// Deuxième chance : les quotas « par minute » et les ratés passagers se dissipent vite.
if (errors.size) {
  console.log(`Nouvel essai dans 90 s pour : ${[...errors.keys()].map(i => script.segments[i].titre).join(', ')}`);
  await new Promise(r => setTimeout(r, 90_000));
  for (const i of [...errors.keys()]) await synthOne(i);
}
const segments = results.filter((s): s is SegmentAudio => s !== null);
const skipped = [...errors.entries()].map(([i, msg]) => `${script.segments[i].titre} (${msg.slice(0, 160)})`);
if (!segments.length) throw new Error('Aucune rubrique synthétisée : épisode annulé.');

const chapters = computeChapters(segments);
const mp3 = resolve(outDir, `matinale-${date}.mp3`);
assemble(segments.flatMap(s => s.files), mp3, { title: script.title, chapters });
const seconds = Math.round(durationSeconds(mp3));
// Voix réellement générée (hors jingle) : sert à estimer le coût de synthèse dans l'app.
const ttsSeconds = Math.round(segments.flatMap(s => s.files).reduce((n, f) => n + durationSeconds(f), 0));
console.log(`MP3 : ${mp3} (${Math.round(seconds / 60)} min, ${chapters.length} chapitres)`);

if (process.env.SKIP_PUBLISH === '1') {
  console.log('SKIP_PUBLISH=1 : publication ignorée.');
} else {
  const { feedUrl, episodeUrl } = await publish(date, mp3, seconds, script, chapters, ttsSeconds);
  console.log(`Publié : ${episodeUrl}\nFlux : ${feedUrl}`);
}
if (skipped.length) {
  console.error(`Rubriques manquantes : ${skipped.join(', ')}`);
  // Repris par la notification d'échec (les journaux d'Actions ne sont pas toujours lisibles depuis le téléphone).
  writeFileSync(resolve(outDir, 'manquantes.txt'), `${skipped.join(' · ')}\n`);
  process.exitCode = 1; // le run apparaît en échec → mail + notification, mais l'épisode est publié
}
