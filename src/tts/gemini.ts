/**
 * Gemini 3.8 Flash TTS via l'API Interactions (REST), deux voix dans la même requête.
 * Doc : https://ai.google.dev/gemini-api/docs/speech-generation
 * Sortie : WAV 24 kHz mono 16 bits.
 *
 * ⚠️ Forme de requête reconstituée depuis la doc (oct. 2026). Lance `npm run tts:test`
 *    une fois avec ta clé : si l'API refuse un champ, le message d'erreur est affiché tel quel.
 */
import { writeFileSync } from 'node:fs';
import type { Turn } from '../schema.js';
import { loadConfig, requireEnv } from '../lib.js';
import { chunkTurns } from './index.js';

const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';

/** Voix par animateur ; à changer après l'écoute comparative. */
// Voix des chroniqueurs déclarées dans config/rubriques.json (show.hosts[].voice) ; Léa, Hugo et Zoé
// se règlent par les variables VOICE_* (prioritaires).
const VOICES: Record<string, string> = {
  ...Object.fromEntries(loadConfig().show.hosts.filter(h => h.voice).map(h => [h.name, h.voice!])),
  'Léa': process.env.VOICE_LEA || 'Kore',
  'Hugo': process.env.VOICE_HUGO || 'Puck',
  'Zoé': process.env.VOICE_ZOE || 'Zephyr',
  // Épisode English : Nora (la même voix que dans l'appli) et Sam, son collègue dans les scènes.
  'Nora': process.env.ENGLISH_VOICE || 'Erinome',
  'Sam': process.env.ENGLISH_PARTNER_VOICE || 'Iapetus',
};

function findAudioBase64(node: unknown): string | null {
  // L'audio peut être sous output_audio.data (SDK) ou steps[].content[].data (REST) :
  // on cherche le premier champ `data` base64 accompagné d'un type audio.
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;
  if (typeof obj.data === 'string' && obj.data.length > 1000) {
    const kind = String(obj.mime_type ?? obj.mimeType ?? obj.type ?? 'audio');
    if (kind.includes('audio')) return obj.data;
  }
  for (const value of Object.values(obj)) {
    const found = Array.isArray(value)
      ? value.map(findAudioBase64).find(Boolean) ?? null
      : findAudioBase64(value);
    if (found) return found;
  }
  return null;
}

/** Modèle de secours (quota gratuit séparé) si le modèle principal est saturé (429) ou indisponible (5xx). */
const FALLBACK_MODEL = process.env.GEMINI_TTS_FALLBACK_MODEL || 'gemini-3.8-flash-lite-tts';

class RetryableError extends Error {}

async function callModel(model: string, turns: Turn[], attempts: number): Promise<Buffer> {
  const key = requireEnv('GEMINI_API_KEY');
  const speakers = [...new Set(turns.map(t => t.speaker))];
  // L'API exige exactement 2 voix déclarées, même pour une réplique seule :
  // on complète avec une deuxième voix (qui ne parle pas dans ce lot).
  if (speakers.length === 1) speakers.push(Object.keys(VOICES).find(v => v !== speakers[0]) ?? 'Hugo');
  const body = {
    model,
    input: [
      {
        type: 'user_input',
        content: turns.map(t => ({
          type: 'text',
          text: t.text,
          annotations: [{ type: 'speech_metadata', speaker: t.speaker, ...(t.style ? { style: t.style } : {}) }],
        })),
      },
    ],
    response_format: { type: 'audio' },
    generation_config: {
      speech_config: { speakers: speakers.map(s => ({ speaker: s, voice: VOICES[s] ?? 'Kore' })) },
    },
  };

  let last = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response;
    try {
      res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Coupure réseau passagère : on réessaie comme pour un 5xx.
      last = `réseau : ${(err as Error).message}`;
      console.warn(`  Gemini ${model} ${last}, nouvel essai dans ${5 * attempt} s (${attempt}/${attempts})`);
      await new Promise(r => setTimeout(r, 5000 * attempt));
      continue;
    }
    if (res.ok) {
      const audio = findAudioBase64(await res.json().catch(() => null));
      if (audio) return Buffer.from(audio, 'base64');
      // Il arrive que le modèle réponde sans audio (texte seul, arrêt prématuré) : c'est passager, on réessaie.
      last = 'réponse sans audio';
      console.warn(`  Gemini ${model} ${last}, nouvel essai dans ${5 * attempt} s (${attempt}/${attempts})`);
      await new Promise(r => setTimeout(r, 5000 * attempt));
      continue;
    }
    last = `${res.status} : ${await res.text()}`;
    if (res.status < 500 && res.status !== 429) throw new Error(`Gemini TTS (${model}) ${last}`);
    // 429 = quota (souvent par minute) : attente longue ; 5xx : attente courte.
    const retryAfter = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : res.status === 429 ? 30000 * attempt : 5000 * attempt;
    console.warn(`  Gemini ${model} ${res.status}, nouvel essai dans ${Math.round(wait / 1000)} s (${attempt}/${attempts})`);
    await new Promise(r => setTimeout(r, wait));
  }
  throw new RetryableError(`Gemini TTS (${model}) : ${attempts} échecs, dernier ${last}`);
}

async function synthChunk(turns: Turn[]): Promise<Buffer> {
  try {
    return await callModel(MODEL, turns, 3);
  } catch (err) {
    if (!(err instanceof RetryableError) || !FALLBACK_MODEL || FALLBACK_MODEL === MODEL) throw err;
    console.warn(`  ⚠️ ${MODEL} saturé : bascule sur ${FALLBACK_MODEL}`);
    return callModel(FALLBACK_MODEL, turns, 3);
  }
}

/** Lit la fréquence d'échantillonnage d'un WAV (octets 24-27), 24 kHz par défaut. */
function sampleRateOf(wav: Buffer): number {
  return wav.length > 28 && wav.toString('ascii', 0, 4) === 'RIFF' ? wav.readUInt32LE(24) : 24000;
}

/** WAV de silence (mono 16 bits) : le petit temps entre deux répliques. */
function silenceWav(ms: number, rate: number): Buffer {
  const samples = Math.round((rate * ms) / 1000);
  const data = Buffer.alloc(samples * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Exécute des tâches avec au plus `limit` en parallèle, en gardant l'ordre des résultats. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) { const i = next++; out[i] = await tasks[i](); }
  }));
  return out;
}

// Réplique par réplique : à activer avec TTS_PER_TURN=1. Par défaut, mode groupé : c'est celui qui a produit
// tous les épisodes jusqu'ici (le mode réplique était refusé par l'API, faute de 2 voix déclarées), et il fait
// ~5× moins d'appels, donc moins de refus de quota (429).
const PER_TURN = process.env.TTS_PER_TURN === '1';
const GAP_MS = Number(process.env.TTS_TURN_GAP_MS || 350);

/**
 * Écrit les WAV d'une rubrique et renvoie leurs chemins, dans l'ordre.
 * Avec TTS_PER_TURN=1, une réplique par appel, avec un court silence (≈ 0,35 s, légèrement variable) à chaque
 * changement de voix. Sinon (défaut), plusieurs répliques par appel. Si l'API refuse le mode réplique par réplique,
 * on bascule automatiquement sur l'ancien mode pour la rubrique.
 */
export async function geminiSegment(turns: Turn[], outBase: string): Promise<string[]> {
  if (PER_TURN) {
    try {
      const audios = await pool(turns.map(t => () => synthChunk([t])), 3);
      const files: string[] = [];
      const rate = sampleRateOf(audios[0]);
      audios.forEach((audio, i) => {
        if (i > 0) {
          const changed = turns[i].speaker !== turns[i - 1].speaker;
          const ms = changed ? GAP_MS + Math.round((Math.random() - 0.5) * 120) : Math.round(GAP_MS / 2);
          const gap = `${outBase}-${String(i).padStart(3, '0')}-pause.wav`;
          writeFileSync(gap, silenceWav(ms, rate));
          files.push(gap);
        }
        const file = `${outBase}-${String(i).padStart(3, '0')}.wav`;
        writeFileSync(file, audio);
        files.push(file);
      });
      return files;
    } catch (err) {
      if (err instanceof RetryableError) throw err;
      console.warn(`  ⚠️ Mode réplique par réplique refusé (${(err as Error).message.slice(0, 160)}) : retour au mode groupé.`);
    }
  }
  const chunks = chunkTurns(turns);
  const files: string[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const file = `${outBase}-${String(i).padStart(2, '0')}.wav`;
    writeFileSync(file, await synthChunk(chunk));
    files.push(file);
  }
  return files;
}
