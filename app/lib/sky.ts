/**
 * Le ciel de la pochette, à l'heure de Genève : nuit étoilée, aube, jour, soir.
 * Le lever et le coucher sont calculés pour Genève au jour près (formule NOAA),
 * pour que le bandeau ressemble au ciel derrière la vitre du train.
 * Fonctions pures (serveur et téléphone) ; le bandeau se recalcule chaque minute.
 */
type Key = { at: number; top: string; mid: string; horizon: string; sun: number; stars: number };
type Look = Omit<Key, 'at'>;

const LAT = 46.2, LON = 6.15;
const rad = Math.PI / 180;

/** Décalage de Genève (minutes) à une date donnée : +60 l'hiver, +120 l'été. */
function zurichOffset(d: Date): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map(x => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - d.getTime()) / 60000);
}

/** Lever, midi solaire et coucher du soleil à Genève, en minutes de la journée (heure locale). */
export function sunTimes(d = new Date()): { rise: number; noon: number; set: number } {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start) / 86400000);
  const g = (2 * Math.PI / 365) * (day - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(LAT * rad) * Math.cos(decl)) - Math.tan(LAT * rad) * Math.tan(decl)) / rad;
  const off = zurichOffset(d);
  return { rise: 720 - 4 * (LON + ha) - eq + off, noon: 720 - 4 * LON - eq + off, set: 720 - 4 * (LON - ha) - eq + off };
}

const NIGHT: Look = { top: '#0b1030', mid: '#151a3d', horizon: '#1d2048', sun: 1.3, stars: 1 };
const LATE: Look = { top: '#0f1434', mid: '#1d1d48', horizon: '#2c2550', sun: 1.2, stars: 1 };
const PREDAWN: Look = { top: '#121838', mid: '#2e2650', horizon: '#6d4258', sun: 1.06, stars: 0.8 };
const COVER: Look = { top: '#141a3a', mid: '#3a2a55', horizon: '#a8604f', sun: 1, stars: 0.5 }; // l'instant de la pochette
const MORNING: Look = { top: '#222b58', mid: '#5a4472', horizon: '#d98a62', sun: 0.75, stars: 0.1 };
const FORENOON: Look = { top: '#244a86', mid: '#4d6ca6', horizon: '#e8b48a', sun: 0.45, stars: 0 };
const NOON: Look = { top: '#1f4f93', mid: '#3a6db0', horizon: '#9cc3e6', sun: 0.05, stars: 0 };
const AFTERNOON: Look = { top: '#244f8f', mid: '#3d6aa8', horizon: '#b6cfe6', sun: 0.45, stars: 0 };
const DUSK: Look = { top: '#2a2c62', mid: '#6a4670', horizon: '#d77a55', sun: 0.8, stars: 0.05 };
const SUNSET: Look = { top: '#1f2150', mid: '#4a3462', horizon: '#b5604a', sun: 1, stars: 0.3 };
const EVENING: Look = { top: '#141a3a', mid: '#2a2550', horizon: '#4a3058', sun: 1.2, stars: 0.8 };

function keys(d: Date): Key[] {
  const { rise, noon, set } = sunTimes(d);
  return [
    { at: 0, ...NIGHT }, { at: rise - 90, ...LATE }, { at: rise - 30, ...PREDAWN }, { at: rise, ...COVER },
    { at: rise + 45, ...MORNING }, { at: rise + 120, ...FORENOON }, { at: noon, ...NOON },
    { at: set - 120, ...AFTERNOON }, { at: set - 40, ...DUSK }, { at: set, ...SUNSET },
    { at: set + 50, ...EVENING }, { at: 1440, ...NIGHT },
  ];
}

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) =>
  `#${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;

export type Sky = Look;

/** Minute de la journée à Genève. */
export function zurichMinutes(d = new Date()): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Le ciel à une minute de la journée (le jour sert au lever et au coucher). */
export function skyAt(minutes: number, d = new Date()): Sky {
  const K = keys(d);
  const i = Math.max(0, K.findIndex(k => k.at > minutes) - 1);
  const a = K[i], b = K[i + 1] ?? K[i];
  const t = b.at === a.at ? 0 : Math.min(1, Math.max(0, (minutes - a.at) / (b.at - a.at)));
  return {
    top: mix(a.top, b.top, t), mid: mix(a.mid, b.mid, t), horizon: mix(a.horizon, b.horizon, t),
    sun: a.sun + (b.sun - a.sun) * t, stars: a.stars + (b.stars - a.stars) * t,
  };
}

/** Temps avant la prochaine rédaction (5 h 37), en clair : « dans 16 h 20 », « dans 12 min ». */
export function untilWriting(minutes: number): string {
  const target = 5 * 60 + 37;
  const left = (target - minutes + 1440) % 1440 || 1440;
  const h = Math.floor(left / 60), m = left % 60;
  // Espaces insécables : « 8 h 07 » ne se coupe jamais en fin de ligne.
  return h ? `dans ${h}\u00a0h\u00a0${String(m).padStart(2, '0')}` : `dans ${m}\u00a0min`;
}

/** Numéro d'édition : N° 1 = premier épisode, une édition par jour. */
export function editionNumber(date: string, first: string | undefined): number | null {
  if (!first) return null;
  const n = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000) + 1;
  return n >= 1 ? n : null;
}
