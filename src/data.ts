/**
 * Étape 1 — données fiables, récupérées par GitHub Actions avant la rédaction.
 * - football-data.org : matchs d'hier, du jour et de demain + classement de Ligue 1
 * - Wikimedia : éphéméride et article du jour (fr)
 * Sortie : data/YYYY-MM-DD.json, lu ensuite par la tâche planifiée Claude.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, dateFromArgs, ensureDir, loadConfig, shiftDate } from './lib.js';

const UA = 'morning-podcast/0.1 (usage personnel; github.com/gchariot/morning-podcast)';

type Match = {
  competition: string;
  date: string;
  status: string;
  home: string;
  away: string;
  score: string | null;
  matchday: number | null;
};

async function football(date: string) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return { error: 'FOOTBALL_DATA_TOKEN absent : pas de scores aujourd\'hui.' };
  const { football: cfg } = loadConfig();
  const headers = { 'X-Auth-Token': token };
  const from = shiftDate(date, -1);
  const to = shiftDate(date, 1);

  const res = await fetch(
    `https://api.football-data.org/v4/matches?competitions=${cfg.competitions.join(',')}&dateFrom=${from}&dateTo=${to}`,
    { headers },
  );
  if (!res.ok) return { error: `football-data.org ${res.status} : ${await res.text()}` };
  const json: any = await res.json();
  const matches: Match[] = (json.matches ?? []).map((m: any) => ({
    competition: m.competition?.name,
    date: m.utcDate,
    status: m.status,
    home: m.homeTeam?.name,
    away: m.awayTeam?.name,
    score:
      m.score?.fullTime?.home == null ? null : `${m.score.fullTime.home}-${m.score.fullTime.away}`,
    matchday: m.matchday ?? null,
  }));

  // Classement de Ligue 1 (top 6 + l'OL où qu'il soit)
  let ligue1: unknown = null;
  const st = await fetch('https://api.football-data.org/v4/competitions/FL1/standings', { headers });
  if (st.ok) {
    const table = ((await st.json()) as any).standings?.find((s: any) => s.type === 'TOTAL')?.table ?? [];
    ligue1 = table
      .filter((r: any) => r.position <= 6 || cfg.favouriteTeams.includes(r.team?.name))
      .map((r: any) => ({ position: r.position, team: r.team?.name, points: r.points, played: r.playedGames }));
  }

  // Dernier et prochain match des équipes suivies, même pendant une trêve internationale.
  const teams: Record<string, unknown> = {};
  for (const team of cfg.favouriteTeamIds ?? []) {
    const simplify = (m: any) => m && ({
      competition: m.competition?.name, date: m.utcDate, home: m.homeTeam?.name, away: m.awayTeam?.name,
      score: m.score?.fullTime?.home == null ? null : `${m.score.fullTime.home}-${m.score.fullTime.away}`,
    });
    const get = async (qs: string) => {
      const r = await fetch(`https://api.football-data.org/v4/teams/${team.id}/matches?${qs}`, { headers });
      return r.ok ? (((await r.json()) as any).matches ?? []) : [];
    };
    const last = await get(`status=FINISHED&dateFrom=${shiftDate(date, -30)}&dateTo=${date}`);
    const next = await get(`status=SCHEDULED,TIMED&dateFrom=${date}&dateTo=${shiftDate(date, 30)}`);
    teams[team.name] = { lastMatch: simplify(last.at(-1)), nextMatch: simplify(next[0]) };
  }

  return { window: { from, to }, matches, ligue1Standings: ligue1, favouriteTeams: teams };
}

async function wikimedia(date: string) {
  const [y, m, d] = date.split('-');
  const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/fr/featured/${y}/${m}/${d}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) return { error: `Wikimedia ${res.status}` };
  const json: any = await res.json();
  return {
    articleDuJour: json.tfa
      ? { title: json.tfa.normalizedtitle ?? json.tfa.title, extract: json.tfa.extract, url: json.tfa.content_urls?.desktop?.page }
      : null,
    ephemeride: (json.onthisday ?? []).slice(0, 8).map((e: any) => ({
      year: e.year,
      text: e.text,
      url: e.pages?.[0]?.content_urls?.desktop?.page,
    })),
  };
}


/* ---------- Météo (Open-Meteo, gratuit, sans clé) ---------- */

const WMO: Record<number, string> = {
  0: 'ciel dégagé', 1: 'plutôt ensoleillé', 2: 'partiellement nuageux', 3: 'couvert',
  45: 'brouillard', 48: 'brouillard givrant',
  51: 'bruine légère', 53: 'bruine', 55: 'bruine dense', 56: 'bruine verglaçante', 57: 'bruine verglaçante dense',
  61: 'pluie faible', 63: 'pluie', 65: 'forte pluie', 66: 'pluie verglaçante', 67: 'forte pluie verglaçante',
  71: 'neige faible', 73: 'neige', 75: 'forte neige', 77: 'grains de neige',
  80: 'averses faibles', 81: 'averses', 82: 'fortes averses', 85: 'averses de neige', 86: 'fortes averses de neige',
  95: 'orage', 96: 'orage avec grêle', 99: 'orage avec forte grêle',
};
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

async function weather(date: string) {
  const cfg = (loadConfig() as any).meteo;
  if (!cfg) return { error: 'pas de section meteo dans config/rubriques.json' };
  const jour = JOURS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const placeId = cfg.schedule?.[jour];
  const place = cfg.places?.[placeId];
  if (!place) return { error: `aucune ville prévue le ${jour}` };
  const qs = new URLSearchParams({
    latitude: String(place.lat), longitude: String(place.lon), timezone: 'Europe/Zurich',
    start_date: date, end_date: date,
    daily: 'weather_code,temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${qs}`);
  if (!res.ok) return { error: `open-meteo ${res.status} : ${(await res.text()).slice(0, 200)}` };
  const j: any = await res.json();
  const d = j.daily;
  // Créneaux utiles pour quelqu'un qui part le matin et rentre le soir.
  const at = (h: number) => {
    const i = (j.hourly.time as string[]).findIndex(t => t.endsWith(`T${String(h).padStart(2, '0')}:00`));
    if (i < 0) return null;
    return {
      heure: `${h} h`, temperature: j.hourly.temperature_2m[i], ressenti: j.hourly.apparent_temperature[i],
      ciel: WMO[j.hourly.weather_code[i]] ?? `code ${j.hourly.weather_code[i]}`,
      risquePluie: j.hourly.precipitation_probability[i], pluieMm: j.hourly.precipitation[i], ventKmh: j.hourly.wind_speed_10m[i],
    };
  };
  const rainyHours = (j.hourly.time as string[])
    .map((t, i) => ({ h: Number(t.slice(11, 13)), p: j.hourly.precipitation_probability[i] }))
    .filter(x => x.h >= 6 && x.h <= 22 && x.p >= 50).map(x => `${x.h} h`);
  return {
    jour, ville: place.name, source: 'Open-Meteo (open-meteo.com)',
    journee: {
      ciel: WMO[d.weather_code[0]] ?? `code ${d.weather_code[0]}`,
      temperatureMin: d.temperature_2m_min[0], temperatureMax: d.temperature_2m_max[0],
      risquePluieMax: d.precipitation_probability_max[0], pluieTotaleMm: d.precipitation_sum[0],
      ventMaxKmh: d.wind_speed_10m_max[0], rafalesMaxKmh: d.wind_gusts_10m_max[0], indiceUV: d.uv_index_max[0],
      leverSoleil: String(d.sunrise[0]).slice(11), coucherSoleil: String(d.sunset[0]).slice(11),
      heuresProbablementPluvieuses: rainyHours,
    },
    creneaux: [7, 9, 12, 15, 18, 21].map(at).filter(Boolean),
  };
}

const date = dateFromArgs();
const [foot, wiki, meteo] = await Promise.all([
  football(date), wikimedia(date), weather(date).catch(e => ({ error: String(e) })),
]);
const out = { date, generatedAt: new Date().toISOString(), football: foot, wikipedia: wiki, meteo };

ensureDir(resolve(ROOT, 'data'));
const file = resolve(ROOT, `data/${date}.json`);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Données écrites : ${file}`);
