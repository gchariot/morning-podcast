/**
 * L'épisode English du matin (≈ 10 min), en semaine, juste après la Matinale.
 * Situation du jour (la même que Nora joue l'après-midi) + carnet d'erreurs → script écrit par Gemini
 * → voix (Nora et Sam) → MP3 avec chapitres → publié dans le même flux, à côté de la Matinale.
 *
 *   1. The scene    : Nora joue le rôle du jour, Sam joue le dev (le modèle à imiter).
 *   2. Les tournures: Nora reprend les phrases utiles, en français quand il faut expliquer.
 *   3. Ton carnet   : (si des erreurs reviennent) Nora les retravaille.
 *   4. À toi        : Nora donne une consigne en français, laisse un blanc, puis dit la bonne phrase.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { ROOT, dateFromArgs, ensureDir, requireEnv } from './lib.js';
import { getProvider } from './tts/index.js';
import { assemble, computeChapters, durationSeconds, type SegmentAudio } from './assemble.js';
import { publishEnglish } from './publish.js';
import type { Turn } from './schema.js';

type Scenario = { id: string; title: string; role: string; brief: string; setup: string; phrases: { en: string; fr: string }[] };
type CarnetEntry = { wrong: string; right: string; rule: string; count: number; last: string };

const date = dateFromArgs();
const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
if (weekday === 0 || weekday === 6) {
  console.log(`${date} : week-end, pas d'épisode English.`);
  process.exit(0);
}

const SCENARIOS: Scenario[] = JSON.parse(readFileSync(resolve(ROOT, 'app/lib/english-scenarios.json'), 'utf8'));
// Même rotation que l'appli (app/lib/english.ts) : la séance de l'après-midi reprend la même situation.
const scenario = SCENARIOS[Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000) % SCENARIOS.length];
const carnetFile = resolve(ROOT, 'english/carnet.json');
const carnet: CarnetEntry[] = existsSync(carnetFile) ? JSON.parse(readFileSync(carnetFile, 'utf8')) : [];
const recurring = carnet.filter(e => e.count > 1).slice(0, 3);

/* ---------- 1. Le script, écrit par Gemini ---------- */

const Line = z.object({ speaker: z.enum(['Nora', 'Sam']), text: z.string().min(1).max(600) });
const EnglishScript = z.object({
  summary: z.string().min(10).max(300),
  scene: z.array(Line).min(8).max(30),
  teach: z.array(z.object({ text: z.string().min(1).max(900) })).min(3).max(10),
  carnet: z.array(z.object({ text: z.string().min(1).max(900) })).max(4).default([]),
  drill: z.array(z.object({ prompt: z.string().min(5).max(200), answer: z.string().min(3).max(200) })).min(4).max(6),
  outro: z.string().min(5).max(300),
  phrases: z.array(z.object({ en: z.string().max(140), fr: z.string().max(120) })).min(3).max(8),
});
type EnglishScript = z.infer<typeof EnglishScript>;

const PROMPT = `You write a 10-minute daily English lesson podcast for one listener: a French-speaking front-end developer in a Swiss web agency, level B1 aiming at B2, professional English. He listens on the train at 6:50, so it is audio only: no visual references, no lists read as "bullet one".

Today's situation: "${scenario.title}". In the afternoon he will role-play it live with Nora, who plays ${scenario.role.replace(/^(ta|ton|une|un) /, 'his ')}.
Scene for Nora: ${scenario.setup}
Key phrases: ${scenario.phrases.map(p => `"${p.en}" (${p.fr})`).join('; ')}.
${recurring.length ? `His recurring mistakes from previous sessions:\n${recurring.map(e => `- "${e.wrong}" → "${e.right}" (${e.rule}, ${e.count} times)`).join('\n')}` : 'No recurring mistakes yet.'}

Write JSON with:
- "summary": one sentence in French describing today's episode.
- "scene": 14–22 lines of a realistic dialogue, about 3 minutes, in natural professional English at B1+/B2 level. Nora plays the role above; "Sam" plays the developer and models good answers using the key phrases. Start with Nora saying in French, in one or two sentences: hello, and what today's situation is ("Aujourd'hui…"), then "Let's listen." and the scene starts.
- "teach": 5–7 turns by Nora, about 3 minutes in total. She goes back over 5 or 6 useful phrases from the scene (including the key phrases): she says the phrase in English, explains in French when and why to use it (one or two sentences), points out a typical French-speaker trap when relevant, and says the phrase again slowly. Mostly French with the English phrases inside.
- "carnet": ${recurring.length ? '1–2 turns by Nora, in French with English examples: she revisits his recurring mistakes with two new example sentences each.' : 'an empty array.'}
- "drill": 5 items. "prompt": an instruction in French, in the second person, asking him to say something in English in the situation ("Dis-lui que tu préfères signaler le risque maintenant."). "answer": the natural English sentence. Reuse the phrases from the episode.
- "outro": Nora, in French, one or two sentences: see you this afternoon to play the scene for real.
- "phrases": the 6 most useful phrases of the episode with a short French gloss (2–5 words).
Never use emojis or stage directions in the texts. Nora is warm, direct, a bit playful.`;

async function writeScript(): Promise<EnglishScript> {
  const key = requireEnv('GEMINI_API_KEY');
  const model = process.env.ENGLISH_TEXT_MODEL || 'gemini-3.8-flash';
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
      }),
    }).catch(err => ({ ok: false, status: 0, text: async () => String(err) }) as unknown as Response);
    if (res.ok) {
      const body = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = body.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
      try {
        const parsed = EnglishScript.safeParse(JSON.parse(text));
        if (parsed.success) return parsed.data;
        last = parsed.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      } catch { last = 'JSON illisible'; }
    } else {
      last = `${res.status} : ${(await res.text()).slice(0, 300)}`;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    }
    console.warn(`  Script English, essai ${attempt} raté (${last})`);
    await new Promise(r => setTimeout(r, 10_000 * attempt));
  }
  throw new Error(`Script English impossible : ${last}`);
}

/* ---------- 2. Les voix ---------- */

/** WAV de silence, pour laisser le temps de répondre dans « À toi ». */
function silence(file: string, seconds: number) {
  const rate = 24000, data = Buffer.alloc(Math.round(rate * seconds) * 2), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
  return file;
}

const script = await writeScript();
const outDir = resolve(ROOT, `out/${date}/english`);
ensureDir(outDir);
writeFileSync(resolve(outDir, 'script.json'), JSON.stringify(script, null, 2));
console.log(`English du ${date} : « ${scenario.title} », ${script.scene.length} répliques, ${script.drill.length} exercices.`);

const { synth } = getProvider();
const nora = (text: string): Turn => ({ speaker: 'Nora', text });
const segments: SegmentAudio[] = [];
const run = async (title: string, fn: () => Promise<string[]>) => {
  try { segments.push({ title, files: await fn() }); }
  catch (err) { console.error(`⚠️ « ${title} » en échec : ${(err as Error).message}`); if (title === 'The scene') throw err; }
};

await run('The scene', () => synth(script.scene, resolve(outDir, '1-scene')));
await run('Les tournures', () => synth(script.teach.map(t => nora(t.text)), resolve(outDir, '2-tournures')));
if (script.carnet.length) await run('Ton carnet', () => synth(script.carnet.map(t => nora(t.text)), resolve(outDir, '3-carnet')));
await run('À toi', async () => {
  const files: string[] = [];
  const intro = await synth([nora('À toi maintenant. Je te donne une situation, tu réponds à voix haute, ou dans ta tête si le train est plein. Ensuite, je te dis ma version.')], resolve(outDir, '4-intro'));
  files.push(...intro);
  for (const [i, d] of script.drill.entries()) {
    files.push(...await synth([nora(d.prompt)], resolve(outDir, `4-${i}-q`)));
    files.push(silence(resolve(outDir, `4-${i}-blanc.wav`), 5));
    files.push(...await synth([nora(d.answer)], resolve(outDir, `4-${i}-r`)));
    files.push(silence(resolve(outDir, `4-${i}-fin.wav`), 1.2));
  }
  files.push(...await synth([nora(script.outro)], resolve(outDir, '4-outro')));
  return files;
});

/* ---------- 3. Montage et publication ---------- */

const chapters = computeChapters(segments);
const mp3 = resolve(outDir, `english-${date}.mp3`);
const title = `English · ${scenario.title}`;
assemble(segments.flatMap(s => s.files), mp3, { title, chapters });
const seconds = Math.round(durationSeconds(mp3));
const ttsSeconds = Math.round(segments.flatMap(s => s.files).reduce((n, f) => n + durationSeconds(f), 0));
console.log(`MP3 : ${mp3} (${Math.round(seconds / 60)} min, ${chapters.length} chapitres)`);

if (process.env.SKIP_PUBLISH === '1') {
  console.log('SKIP_PUBLISH=1 : publication ignorée.');
} else {
  const { episodeUrl } = await publishEnglish(date, mp3, seconds, {
    title, summary: script.summary, scenario: scenario.id, phrases: script.phrases,
    chapters: chapters.map(c => ({ title: c.title, startSec: c.startSec })), ttsSeconds,
  });
  console.log(`Publié : ${episodeUrl}`);
}
if (segments.length < (script.carnet.length ? 4 : 3)) process.exitCode = 1;
