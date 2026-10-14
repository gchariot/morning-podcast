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

const date = dateFromArgs();
const [foot, wiki] = await Promise.all([football(date), wikimedia(date)]);
const out = { date, generatedAt: new Date().toISOString(), football: foot, wikipedia: wiki };

ensureDir(resolve(ROOT, 'data'));
const file = resolve(ROOT, `data/${date}.json`);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Données écrites : ${file}`);
