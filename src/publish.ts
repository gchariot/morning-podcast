/**
 * Publication sur un stockage compatible S3 : Cloudflare R2 (recommandé) ou Supabase Storage.
 * Tout est rangé sous un préfixe secret pour que l'URL du flux soit impossible à deviner :
 *   <FEED_SECRET>/feed.xml, episodes.json, cover-<hash>.jpg, episodes/<date>.mp3, episodes/<date>.chapters.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ROOT, loadConfig, requireEnv } from './lib.js';
import type { Script } from './schema.js';
import type { Chapter } from './assemble.js';

export type EpisodeEntry = {
  date: string;
  title: string;
  summary: string;
  url: string;
  bytes: number;
  seconds: number;
  sources: { title: string; url: string }[];
  chaptersUrl?: string;
  chapters?: { title: string; startSec: number }[];
  /** Quiz du jour (la réponse est révélée par l'app une fois l'épisode suivant publié). */
  quiz?: { question: string; choices: string[]; answer: number; explanation?: string };
  /** Samedi : le jeu (8 questions) et le face-à-face. */
  game?: { questions: { question: string; choices: string[]; answer: number; explanation?: string }[] };
  debate?: { topic: string; sides: [string, string] };
  /** Ce que la rédaction a changé grâce aux retours (affiché dans l'appli). */
  applied?: string[];
  /** Secondes de voix réellement générées (pour estimer le coût de synthèse). */
  ttsSeconds?: number;
};

const KEEP = 30; // épisodes conservés dans le flux

/** Pochette : nom versionné par son contenu, pour que les applis rechargent l'image quand elle change. */
function coverAsset(): { key: string; body: Buffer } | null {
  const file = resolve(ROOT, 'assets/cover.jpg');
  if (!existsSync(file)) return null;
  const body = readFileSync(file);
  const hash = createHash('sha1').update(body).digest('hex').slice(0, 8);
  return { key: `cover-${hash}.jpg`, body };
}

function client() {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: requireEnv('S3_ENDPOINT'),
    forcePathStyle: true,
    credentials: { accessKeyId: requireEnv('S3_ACCESS_KEY_ID'), secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY') },
  });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function hms(sec: number) {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return [h, m, r].map(n => String(n).padStart(2, '0')).join(':');
}

export function buildFeed(episodes: EpisodeEntry[], base: string, coverUrl: string | null): string {
  const { show } = loadConfig();
  const items = episodes
    .map(e => {
      const toc = e.chapters?.length
        ? `<br/><br/>Au programme :<br/>${e.chapters.map(c => `${hms(c.startSec)} ${esc(c.title)}`).join('<br/>')}`
        : '';
      const notes = `${esc(e.summary)}${toc}<br/><br/>Sources :<br/>${e.sources.map(s => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join('<br/>')}`;
      return `    <item>
      <title>${esc(e.title)}</title>
      <description><![CDATA[${notes}]]></description>
      <pubDate>${new Date(`${e.date}T05:00:00+02:00`).toUTCString()}</pubDate>
      <guid isPermaLink="false">matinale-${e.date}</guid>
      <enclosure url="${esc(e.url)}" length="${e.bytes}" type="audio/mpeg"/>
      <itunes:duration>${hms(e.seconds)}</itunes:duration>${coverUrl ? `
      <itunes:image href="${esc(coverUrl)}"/>` : ''}${e.chaptersUrl ? `
      <podcast:chapters url="${esc(e.chaptersUrl)}" type="application/json+chapters"/>` : ''}
    </item>`;
    })
    .join('\n');
  const image = coverUrl
    ? `
    <itunes:image href="${esc(coverUrl)}"/>
    <image><url>${esc(coverUrl)}</url><title>${esc(show.title)}</title><link>${esc(base)}</link></image>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>${esc(show.title)}</title>
    <link>${esc(base)}</link>
    <description>${esc(show.description)}</description>
    <language>${show.language}</language>
    <itunes:author>La Matinale</itunes:author>
    <itunes:explicit>false</itunes:explicit>${image}
${items}
  </channel>
</rss>
`;
}

export async function publish(date: string, mp3: string, seconds: number, script: Script, chapters: Chapter[] = [], ttsSeconds?: number) {
  const s3 = client();
  const Bucket = requireEnv('S3_BUCKET');
  const prefix = requireEnv('FEED_SECRET');
  const base = `${requireEnv('PUBLIC_BASE_URL').replace(/\/$/, '')}/${prefix}`;
  const put = (Key: string, Body: Buffer | string, ContentType: string, CacheControl?: string) =>
    s3.send(new PutObjectCommand({ Bucket, Key: `${prefix}/${Key}`, Body, ContentType, CacheControl }));

  await put(`episodes/${date}.mp3`, readFileSync(mp3), 'audio/mpeg');

  // Chapitres au format Podcasting 2.0 (Pocket Casts, Overcast…) ; ils sont aussi dans le MP3 (ID3).
  let chaptersUrl: string | undefined;
  if (chapters.length) {
    const json = { version: '1.2.0', chapters: chapters.map(c => ({ startTime: Math.round(c.startSec), title: c.title })) };
    await put(`episodes/${date}.chapters.json`, JSON.stringify(json, null, 2), 'application/json+chapters');
    chaptersUrl = `${base}/episodes/${date}.chapters.json`;
  }

  // Pochette : envoyée à chaque publication (petit fichier, et ça garde le flux à jour si elle change).
  const cover = coverAsset();
  let coverUrl: string | null = null;
  if (cover) {
    await put(cover.key, cover.body, 'image/jpeg', 'max-age=31536000');
    coverUrl = `${base}/${cover.key}`;
  }

  let episodes: EpisodeEntry[] = [];
  try {
    const got = await s3.send(new GetObjectCommand({ Bucket, Key: `${prefix}/episodes.json` }));
    episodes = JSON.parse(await got.Body!.transformToString());
  } catch {
    // premier épisode : pas encore d'index
  }
  const entry: EpisodeEntry = {
    date,
    title: script.title,
    summary: script.summary,
    url: `${base}/episodes/${date}.mp3`,
    bytes: statSync(mp3).size,
    seconds,
    sources: script.segments.flatMap(s => s.sources),
    chaptersUrl,
    chapters: chapters.map(c => ({ title: c.title, startSec: c.startSec })),
    ...(script.quiz ? { quiz: script.quiz } : {}),
    ...(script.game ? { game: script.game } : {}),
    ...(script.debate ? { debate: script.debate } : {}),
    ...(script.applied?.length ? { applied: script.applied } : {}),
    ...(ttsSeconds ? { ttsSeconds } : {}),
  };
  episodes = [entry, ...episodes.filter(e => e.date !== date)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP);

  await put('episodes.json', JSON.stringify(episodes, null, 2), 'application/json');
  await put('feed.xml', buildFeed(episodes, base, coverUrl), 'application/rss+xml; charset=utf-8', 'max-age=300');
  return { feedUrl: `${base}/feed.xml`, episodeUrl: entry.url };
}

/** Régénère feed.xml à partir de episodes.json, sans refaire l'audio (après un changement de format du flux). */
export async function regenerateFeed() {
  const s3 = client();
  const Bucket = requireEnv('S3_BUCKET');
  const prefix = requireEnv('FEED_SECRET');
  const base = `${requireEnv('PUBLIC_BASE_URL').replace(/\/$/, '')}/${prefix}`;
  const got = await s3.send(new GetObjectCommand({ Bucket, Key: `${prefix}/episodes.json` }));
  const episodes: EpisodeEntry[] = JSON.parse(await got.Body!.transformToString());
  const cover = coverAsset();
  let coverUrl: string | null = null;
  if (cover) {
    await s3.send(new PutObjectCommand({ Bucket, Key: `${prefix}/${cover.key}`, Body: cover.body, ContentType: 'image/jpeg', CacheControl: 'max-age=31536000' }));
    coverUrl = `${base}/${cover.key}`;
  }
  await s3.send(new PutObjectCommand({
    Bucket, Key: `${prefix}/feed.xml`, Body: buildFeed(episodes, base, coverUrl),
    ContentType: 'application/rss+xml; charset=utf-8', CacheControl: 'max-age=300',
  }));
  return { feedUrl: `${base}/feed.xml`, count: episodes.length };
}
