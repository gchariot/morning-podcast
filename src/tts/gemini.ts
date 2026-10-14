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
import { requireEnv } from '../lib.js';
import { chunkTurns } from './index.js';

const MODEL = process.env.GEMINI_TTS_MODEL ?? 'gemini-3.8-flash-tts';

/** Voix par animateur ; à changer après l'écoute comparative. */
const VOICES: Record<string, string> = {
  'Léa': process.env.VOICE_LEA ?? 'Kore',
  'Hugo': process.env.VOICE_HUGO ?? 'Puck',
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

async function synthChunk(turns: Turn[]): Promise<Buffer> {
  const key = requireEnv('GEMINI_API_KEY');
  const speakers = [...new Set(turns.map(t => t.speaker))];
  const body = {
    model: MODEL,
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

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const audio = findAudioBase64(await res.json());
      if (!audio) throw new Error('Réponse Gemini sans audio : vérifier le format de requête.');
      return Buffer.from(audio, 'base64');
    }
    const msg = await res.text();
    if (res.status < 500 && res.status !== 429) throw new Error(`Gemini TTS ${res.status} : ${msg}`);
    await new Promise(r => setTimeout(r, 5000 * attempt));
  }
  throw new Error('Gemini TTS : 3 échecs consécutifs.');
}

/** Écrit un ou plusieurs WAV pour une rubrique et renvoie le chemin du premier (les suivants sont suffixés). */
export async function geminiSegment(turns: Turn[], outBase: string): Promise<string[]> {
  const chunks = chunkTurns(turns);
  const files: string[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const file = `${outBase}-${String(i).padStart(2, '0')}.wav`;
    writeFileSync(file, await synthChunk(chunk));
    files.push(file);
  }
  return files;
}
