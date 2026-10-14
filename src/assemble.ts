/** Montage ffmpeg : jingle (optionnel) + segments audio → un MP3 mono 64 kbit/s, avec chapitres. */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib.js';

export type Chapter = { title: string; startSec: number; endSec: number };
export type SegmentAudio = { title: string; files: string[] };

export function jinglePath(): string | null {
  const jingle = resolve(ROOT, 'assets/jingle.mp3');
  return existsSync(jingle) ? jingle : null;
}

export function durationSeconds(file: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]).toString();
  return Number(out.trim());
}

/** Chapitres à partir des durées réelles des fichiers (le jingle fait partie du premier chapitre). */
export function computeChapters(segments: SegmentAudio[]): Chapter[] {
  const jingle = jinglePath();
  let t = 0;
  const chapters: Chapter[] = [];
  segments.forEach((seg, i) => {
    const start = t;
    const extra = i === 0 && jingle ? durationSeconds(jingle) : 0;
    t += extra + seg.files.reduce((s, f) => s + durationSeconds(f), 0);
    chapters.push({ title: seg.title, startSec: start, endSec: t });
  });
  return chapters;
}

const escMeta = (s: string) => s.replace(/([=;#\\\n])/g, '\\$1');

export function assemble(files: string[], out: string, meta?: { title: string; chapters: Chapter[] }): void {
  const jingle = jinglePath();
  const inputs = jingle ? [jingle, ...files] : files;
  if (!inputs.length) throw new Error('Aucun segment audio à assembler.');

  // Le filtre concat accepte des formats différents (WAV Gemini, MP3 ElevenLabs, jingle).
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  for (const f of inputs) args.push('-i', f);

  if (meta) {
    const lines = [';FFMETADATA1', `title=${escMeta(meta.title)}`, 'artist=La Matinale', ''];
    for (const c of meta.chapters) {
      lines.push('[CHAPTER]', 'TIMEBASE=1/1000', `START=${Math.round(c.startSec * 1000)}`,
        `END=${Math.round(c.endSec * 1000)}`, `title=${escMeta(c.title)}`, '');
    }
    const metaFile = `${out}.ffmeta`;
    writeFileSync(metaFile, lines.join('\n'));
    args.push('-i', metaFile);
  }

  const streams = inputs.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono[a${i}]`).join(';');
  // loudnorm : volume homogène entre jingle et voix, au standard podcast (-16 LUFS).
  const concat = inputs.map((_, i) => `[a${i}]`).join('') +
    `concat=n=${inputs.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  args.push('-filter_complex', `${streams};${concat}`, '-map', '[out]');
  if (meta) args.push('-map_metadata', String(inputs.length), '-map_chapters', String(inputs.length), '-id3v2_version', '3');
  args.push('-ac', '1', '-b:a', '64k', out);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
}
