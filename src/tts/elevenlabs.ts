/**
 * ElevenLabs (optionnel, pour comparer les voix). Une requête par réplique.
 * ⚠️ Le plan Starter a un petit quota mensuel de caractères : bien pour tester,
 *    insuffisant pour un épisode quotidien de 20 minutes (~18 000 caractères).
 */
import { writeFileSync } from 'node:fs';
import type { Turn } from '../schema.js';
import { requireEnv } from '../lib.js';

const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_v3';

/** IDs de voix ElevenLabs (bibliothèque de voix → « ID »). Sans réglage : une voix féminine et une masculine du compte. */
let defaults: Promise<{ female: string; male: string }> | null = null;
async function defaultVoices(key: string) {
  defaults ??= (async () => {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} en listant les voix : ${(await res.text()).slice(0, 200)}`);
    const { voices } = (await res.json()) as { voices: { voice_id: string; name: string; labels?: { gender?: string } }[] };
    const pick = (g: string) => voices.find(v => v.labels?.gender === g) ?? voices[0];
    const female = pick('female'), male = pick('male');
    console.log(`Voix ElevenLabs par défaut : Léa = ${female.name} (${female.voice_id}), Hugo = ${male.name} (${male.voice_id})`);
    return { female: female.voice_id, male: male.voice_id };
  })();
  return defaults;
}

async function voiceFor(speaker: string, key: string): Promise<string> {
  if (speaker === 'Léa') return process.env.ELEVENLABS_VOICE_LEA || (await defaultVoices(key)).female;
  if (speaker === 'Hugo') return process.env.ELEVENLABS_VOICE_HUGO || (await defaultVoices(key)).male;
  if (speaker === 'Zoé') return process.env.ELEVENLABS_VOICE_ZOE || (await defaultVoices(key)).female;
  throw new Error(`Pas de voix ElevenLabs pour ${speaker}`);
}

export async function elevenlabsSegment(turns: Turn[], outBase: string): Promise<string[]> {
  const key = requireEnv('ELEVENLABS_API_KEY');
  const files: string[] = [];
  for (const [i, t] of turns.entries()) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${await voiceFor(t.speaker, key)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({ text: t.text, model_id: MODEL, language_code: 'fr' }),
      },
    );
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${await res.text()}`);
    const file = `${outBase}-${String(i).padStart(3, '0')}.mp3`;
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    files.push(file);
  }
  return files;
}
