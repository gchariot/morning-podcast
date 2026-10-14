/**
 * ElevenLabs (optionnel, pour comparer les voix). Une requête par réplique.
 * ⚠️ Le plan Starter a un petit quota mensuel de caractères : bien pour tester,
 *    insuffisant pour un épisode quotidien de 20 minutes (~18 000 caractères).
 */
import { writeFileSync } from 'node:fs';
import type { Turn } from '../schema.js';
import { requireEnv } from '../lib.js';

const MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_v3';

/** IDs de voix ElevenLabs (bibliothèque de voix → « ID »). */
function voiceFor(speaker: string): string {
  if (speaker === 'Léa') return requireEnv('ELEVENLABS_VOICE_LEA');
  if (speaker === 'Hugo') return requireEnv('ELEVENLABS_VOICE_HUGO');
  throw new Error(`Pas de voix ElevenLabs pour ${speaker}`);
}

export async function elevenlabsSegment(turns: Turn[], outBase: string): Promise<string[]> {
  const key = requireEnv('ELEVENLABS_API_KEY');
  const files: string[] = [];
  for (const [i, t] of turns.entries()) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceFor(t.speaker)}?output_format=mp3_44100_128`,
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
