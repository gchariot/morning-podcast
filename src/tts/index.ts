/**
 * Synthèse vocale interchangeable : TTS_PROVIDER=gemini (défaut) ou elevenlabs.
 * Chaque fournisseur reçoit les répliques d'UNE rubrique et écrit un fichier audio.
 */
import type { Turn } from '../schema.js';
import { geminiSegment } from './gemini.js';
import { elevenlabsSegment } from './elevenlabs.js';

export type SegmentWriter = (turns: Turn[], outBase: string) => Promise<string[]>;

export function getProvider(): { name: string; synth: SegmentWriter } {
  const name = (process.env.TTS_PROVIDER || 'gemini').toLowerCase();
  if (name === 'gemini') return { name, synth: geminiSegment };
  if (name === 'elevenlabs') return { name, synth: elevenlabsSegment };
  throw new Error(`TTS_PROVIDER inconnu : ${name}`);
}

/**
 * Découpe une liste de répliques en lots de taille raisonnable (requêtes courtes = moins d'échecs),
 * avec au plus 2 voix par lot : la synthèse multi-locuteurs de Gemini n'en accepte pas davantage.
 */
export function chunkTurns(turns: Turn[], maxChars = 4000): Turn[][] {
  const chunks: Turn[][] = [];
  let cur: Turn[] = [];
  let size = 0;
  for (const t of turns) {
    const voices = new Set(cur.map(x => x.speaker)).add(t.speaker);
    if (cur.length && (size + t.text.length > maxChars || voices.size > 2)) {
      chunks.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(t);
    size += t.text.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}
