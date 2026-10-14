/** Montage ffmpeg : jingle (optionnel) + segments audio → un MP3 mono 64 kbit/s. */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib.js';

export function assemble(files: string[], out: string): void {
  const jingle = resolve(ROOT, 'assets/jingle.mp3');
  const inputs = existsSync(jingle) ? [jingle, ...files] : files;
  if (!inputs.length) throw new Error('Aucun segment audio à assembler.');

  // Le filtre concat accepte des formats différents (WAV Gemini, MP3 ElevenLabs, jingle).
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const f of inputs) args.push('-i', f);
  const streams = inputs.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono[a${i}]`).join(';');
  // loudnorm : volume homogène entre jingle et voix, au standard podcast (-16 LUFS).
  const concat = inputs.map((_, i) => `[a${i}]`).join('') +
    `concat=n=${inputs.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  args.push('-filter_complex', `${streams};${concat}`, '-map', '[out]', '-ac', '1', '-b:a', '64k', out);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
}

export function durationSeconds(file: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]).toString();
  return Math.round(Number(out.trim()));
}
