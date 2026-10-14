/**
 * Publication sur un stockage compatible S3 : Cloudflare R2 (recommandé) ou Supabase Storage.
 * Tout est rangé sous un préfixe secret pour que l'URL du flux soit impossible à deviner :
 *   <FEED_SECRET>/feed.xml, <FEED_SECRET>/episodes.json, <FEED_SECRET>/episodes/<date>.mp3
 */
import { readFileSync, statSync } from 'node:fs';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadConfig, requireEnv } from './lib.js';
import type { Script } from './schema.js';

export type EpisodeEntry = {
  date: string;
  title: string;
  summary: string;
  url: string;
  bytes: number;
  seconds: number;
  sources: { title: string; url: string }[];
};

const KEEP = 30; // épisodes conservés dans le flux

function client() {
  return new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: requireEnv('S3_ENDPOINT'),
    forcePathStyle: true,
    credentials: { accessKeyId: requireEnv('S3_ACCESS_KEY_ID'), secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY') },
  });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function hms(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

export function buildFeed(episodes: EpisodeEntry[], base: string): string {
  const { show } = loadConfig();
  const items = episodes
    .map(e => {
      const notes = `${esc(e.summary)}<br/><br/>Sources :<br/>${e.sources.map(s => `<a href="${esc(s.url)}">${esc(s.title)}</a>`).join('<br/>')}`;
      return `    <item>
      <title>${esc(e.title)}</title>
      <description><![CDATA[${notes}]]></description>
      <pubDate>${new Date(`${e.date}T05:00:00+02:00`).toUTCString()}</pubDate>
      <guid isPermaLink="false">matinale-${e.date}</guid>
      <enclosure url="${esc(e.url)}" length="${e.bytes}" type="audio/mpeg"/>
      <itunes:duration>${hms(e.seconds)}</itunes:duration>
    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${esc(show.title)}</title>
    <link>${esc(base)}</link>
    <description>${esc(show.description)}</description>
    <language>${show.language}</language>
    <itunes:block>Yes</itunes:block>
    <itunes:explicit>false</itunes:explicit>
${items}
  </channel>
</rss>
`;
}

export async function publish(date: string, mp3: string, seconds: number, script: Script) {
  const s3 = client();
  const Bucket = requireEnv('S3_BUCKET');
  const prefix = requireEnv('FEED_SECRET');
  const base = `${requireEnv('PUBLIC_BASE_URL').replace(/\/$/, '')}/${prefix}`;

  const mp3Key = `${prefix}/episodes/${date}.mp3`;
  await s3.send(new PutObjectCommand({ Bucket, Key: mp3Key, Body: readFileSync(mp3), ContentType: 'audio/mpeg' }));

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
  };
  episodes = [entry, ...episodes.filter(e => e.date !== date)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP);

  await s3.send(new PutObjectCommand({ Bucket, Key: `${prefix}/episodes.json`, Body: JSON.stringify(episodes, null, 2), ContentType: 'application/json' }));
  await s3.send(new PutObjectCommand({
    Bucket, Key: `${prefix}/feed.xml`, Body: buildFeed(episodes, base),
    ContentType: 'application/rss+xml; charset=utf-8', CacheControl: 'max-age=300',
  }));
  return { feedUrl: `${base}/feed.xml`, episodeUrl: entry.url };
}
