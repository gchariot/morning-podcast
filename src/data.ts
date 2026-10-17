/**
 * Étape 1 — données fiables, récupérées par GitHub Actions avant la rédaction.
 * - football-data.org : matchs d'hier, du jour et de demain + classement de Ligue 1
 * - Wikimedia : éphéméride et article du jour (fr)
 * Sortie : data/YYYY-MM-DD.json, lu ensuite par la tâche planifiée Claude.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
    // Le samedi, on prévoit tout le week-end : samedi et dimanche.
    start_date: date, end_date: jour === 'samedi' ? shiftDate(date, 1) : date,
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
    .map((t, i) => ({ day: t.slice(0, 10), h: Number(t.slice(11, 13)), p: j.hourly.precipitation_probability[i] }))
    .filter(x => x.day === date)
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
    ...(jour === 'samedi' && d.time?.[1] ? {
      dimanche: {
        ciel: WMO[d.weather_code[1]] ?? `code ${d.weather_code[1]}`,
        temperatureMin: d.temperature_2m_min[1], temperatureMax: d.temperature_2m_max[1],
        risquePluieMax: d.precipitation_probability_max[1], pluieTotaleMm: d.precipitation_sum[1],
        ventMaxKmh: d.wind_speed_10m_max[1], rafalesMaxKmh: d.wind_gusts_10m_max[1],
      },
    } : {}),
  };
}

/* ---------- Sorties du week-end (OpenAgenda, le samedi, si OPENAGENDA_KEY est défini) ---------- */

async function sorties(date: string) {
  const key = process.env.OPENAGENDA_KEY;
  if (!key) return { error: 'OPENAGENDA_KEY absent : sorties trouvées par recherche web' };
  const cfg = (loadConfig() as any).sorties ?? {};
  const headers = { key };
  const api = 'https://api.openagenda.com/v2';
  const fr = (v: any) => (typeof v === 'string' ? v : v?.fr ?? v?.en ?? (v ? Object.values(v)[0] : '')) as string;

  // 1. Agendas : ceux de la config + ceux trouvés par recherche (Genève, pays de Gex…).
  const uids = new Map<number, string>();
  for (const uid of cfg.agendas ?? []) uids.set(Number(uid), String(uid));
  const errors: string[] = [];
  for (const q of cfg.recherche ?? ['Genève']) {
    const r = await fetch(`${api}/agendas?search=${encodeURIComponent(q)}&size=50`, { headers });
    if (!r.ok) { errors.push(`agendas « ${q} » : ${r.status}`); continue; }
    const j: any = await r.json();
    for (const a of j.agendas ?? []) if (a?.uid && !a.private) uids.set(Number(a.uid), a.title ?? String(a.uid));
  }

  // 2. Événements du samedi et du dimanche dans la zone (Genève + pays de Gex).
  const z = cfg.zone ?? { sudOuest: { lat: 46.1, lng: 5.95 }, nordEst: { lat: 46.4, lng: 6.35 } };
  // Décalage horaire de Genève ce jour-là (+02:00 l'été, +01:00 l'hiver).
  const off = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Zurich', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${date}T12:00:00Z`)).find(p => p.type === 'timeZoneName')?.value.replace('GMT', '') || '+01:00';
  const start = new Date(`${date}T00:00:00${off}`), end = new Date(`${shiftDate(date, 1)}T23:59:59${off}`);
  const qs = new URLSearchParams({
    'timings[gte]': start.toISOString(), 'timings[lte]': end.toISOString(),
    'geo[northEast][lat]': String(z.nordEst.lat), 'geo[northEast][lng]': String(z.nordEst.lng),
    'geo[southWest][lat]': String(z.sudOuest.lat), 'geo[southWest][lng]': String(z.sudOuest.lng),
    size: '100', detailed: '1', monolingual: 'fr',
  });
  const seen = new Set<string>();
  const events: any[] = [];
  for (const [uid, agendaTitle] of [...uids].slice(0, 120)) {
    const r = await fetch(`${api}/agendas/${uid}/events?${qs}`, { headers });
    if (!r.ok) { errors.push(`agenda ${uid} : ${r.status}`); continue; }
    const j: any = await r.json();
    for (const e of j.events ?? []) {
      const id = `${e.uid}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const inWindow = (e.timings ?? []).filter((t: any) => { const b = new Date(t.begin); return b >= start && b <= end; });
      if (!inWindow.length) continue;
      events.push({
        titre: fr(e.title), resume: fr(e.description).slice(0, 300),
        lieu: e.location?.name, ville: e.location?.city, adresse: e.location?.address,
        horaires: inWindow.slice(0, 4).map((t: any) => ({ debut: t.begin, fin: t.end })),
        prix: fr(e.conditions).slice(0, 160) || undefined,
        url: e.slug ? `https://openagenda.com/agendas/${uid}/events/${e.slug}` : undefined,
        agenda: agendaTitle,
      });
    }
  }
  // Sans doublons (même titre), puis équilibré entre samedi et dimanche (45 max par jour).
  const byTitle = new Map<string, any>();
  for (const e of events) { const k = String(e.titre).toLowerCase().trim(); if (!byTitle.has(k)) byTitle.set(k, e); }
  const unique = [...byTitle.values()].sort((a, b) => String(a.horaires[0]?.debut ?? '').localeCompare(String(b.horaires[0]?.debut ?? '')));
  const sunday = shiftDate(date, 1);
  const dayOf = (e: any) => (String(e.horaires[0]?.debut ?? '').slice(0, 10) === sunday ? 'dimanche' : 'samedi');
  const picked = [...unique.filter(e => dayOf(e) === 'samedi').slice(0, 45), ...unique.filter(e => dayOf(e) === 'dimanche').slice(0, 45)];
  return {
    source: 'OpenAgenda', agendas: uids.size, trouves: unique.length,
    evenements: picked.map(e => ({ jour: dayOf(e), ...e })),
    ...(errors.length ? { erreurs: errors.slice(0, 10) } : {}),
  };
}

const date = dateFromArgs();
const isSaturday = new Date(`${date}T12:00:00Z`).getUTCDay() === 6;
const [foot, wiki, meteo, sortiesWe] = await Promise.all([
  football(date), wikimedia(date), weather(date).catch(e => ({ error: String(e) })),
  isSaturday ? sorties(date).catch(e => ({ error: String(e) })) : Promise.resolve(undefined),
]);
// L'entraînement course (src/garmin.py, lancé juste avant dans le workflow) : seulement s'il concerne ce jour.
const garminFile = resolve(ROOT, 'out/garmin.json');
let course: unknown;
if (existsSync(garminFile)) {
  try {
    const g = JSON.parse(readFileSync(garminFile, 'utf8'));
    course = g.error || g.date === date ? g : { error: `données Garmin d'un autre jour (${g.date})` };
  } catch (e) { course = { error: `out/garmin.json illisible : ${e}` }; }
}
const out = { date, generatedAt: new Date().toISOString(), football: foot, wikipedia: wiki, meteo, ...(sortiesWe ? { sorties: sortiesWe } : {}), ...(course ? { course } : {}) };

ensureDir(resolve(ROOT, 'data'));
const file = resolve(ROOT, `data/${date}.json`);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Données écrites : ${file}`);
