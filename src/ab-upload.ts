/**
 * Test à l'aveugle : prend out/gemini.mp3 et out/elevenlabs.mp3, les tire au sort en A et B,
 * les dépose sur R2 (dossier privé du flux) et écrit les deux liens dans le résumé du run GitHub.
 * La correspondance A/B est cachée dans un bloc « Révéler » à ouvrir après l'écoute.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomInt } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ROOT, requireEnv } from './lib.js';

const providers = ['gemini', 'elevenlabs'];
const swap = randomInt(2) === 1;
const [a, b] = swap ? [...providers].reverse() : providers;

const s3 = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: requireEnv('S3_ENDPOINT'),
  forcePathStyle: true,
  credentials: { accessKeyId: requireEnv('S3_ACCESS_KEY_ID'), secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY') },
});
const prefix = requireEnv('FEED_SECRET');
const base = `${requireEnv('PUBLIC_BASE_URL').replace(/\/$/, '')}/${prefix}`;
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

const urls: Record<string, string> = {};
for (const [label, provider] of [['A', a], ['B', b]]) {
  const key = `tests/${stamp}-${label}.mp3`;
  await s3.send(new PutObjectCommand({
    Bucket: requireEnv('S3_BUCKET'), Key: `${prefix}/${key}`, Body: readFileSync(resolve(ROOT, `out/${provider}.mp3`)),
    ContentType: 'audio/mpeg', CacheControl: 'no-store',
  }));
  urls[label] = `${base}/${key}`;
}

const summary = `## Test à l'aveugle : quelle voix préfères-tu ?

Même texte, même volume. Écoute les deux, choisis, **puis** ouvre « Révéler ».

- 🅰️ [Écouter la version A](${urls.A})
- 🅱️ [Écouter la version B](${urls.B})

<details><summary>Révéler</summary>

- A = **${a === 'gemini' ? 'Gemini (actuel)' : 'ElevenLabs'}**
- B = **${b === 'gemini' ? 'Gemini (actuel)' : 'ElevenLabs'}**

</details>
`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(`A : ${urls.A}\nB : ${urls.B}\n(correspondance dans le résumé du run)`);

// Notification sur le téléphone, si ntfy est configuré.
if (process.env.NTFY_TOPIC) {
  await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
    method: 'POST',
    headers: { Title: 'Test de voix prêt', Tags: 'headphones', Actions: `view, Version A, ${urls.A}; view, Version B, ${urls.B}` },
    body: "Écoute A et B, puis regarde la réponse dans le résumé du run GitHub.",
  }).catch(() => {});
}
