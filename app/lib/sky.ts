/**
 * Le ciel de la pochette, à l'heure de Genève : nuit étoilée, aube, jour, soir.
 * Fonctions pures (serveur et téléphone) ; le bandeau se recalcule chaque minute.
 */
type Key = { at: number; top: string; mid: string; horizon: string; sun: number; stars: number };

// at = minute de la journée ; sun = hauteur du soleil (0 = haut du ciel, 1 = sur l'horizon, >1 = couché).
const KEYS: Key[] = [
  { at: 0, top: '#0b1030', mid: '#151a3d', horizon: '#1d2048', sun: 1.25, stars: 1 },
  { at: 300, top: '#0f1434', mid: '#1d1d48', horizon: '#2c2550', sun: 1.2, stars: 1 },
  { at: 360, top: '#141a3a', mid: '#3a2a55', horizon: '#a8604f', sun: 0.95, stars: 0.75 },
  { at: 420, top: '#222b58', mid: '#5a4472', horizon: '#d98a62', sun: 0.72, stars: 0.3 },
  { at: 510, top: '#244a86', mid: '#4d6ca6', horizon: '#e8b48a', sun: 0.48, stars: 0 },
  { at: 660, top: '#1f4f93', mid: '#3a6db0', horizon: '#9cc3e6', sun: 0.18, stars: 0 },
  { at: 960, top: '#244f8f', mid: '#3d6aa8', horizon: '#b6cfe6', sun: 0.32, stars: 0 },
  { at: 1110, top: '#2a2c62', mid: '#6a4670', horizon: '#d77a55', sun: 0.88, stars: 0.1 },
  { at: 1230, top: '#141a3a', mid: '#2a2550', horizon: '#4a3058', sun: 1.15, stars: 0.8 },
  { at: 1440, top: '#0b1030', mid: '#151a3d', horizon: '#1d2048', sun: 1.25, stars: 1 },
];

const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) =>
  `#${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;

export type Sky = { top: string; mid: string; horizon: string; sun: number; stars: number };

/** Minute de la journée à Genève. */
export function zurichMinutes(d = new Date()): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}

export function skyAt(minutes: number): Sky {
  const i = Math.max(0, KEYS.findIndex(k => k.at > minutes) - 1);
  const a = KEYS[i], b = KEYS[i + 1] ?? KEYS[i];
  const t = b.at === a.at ? 0 : (minutes - a.at) / (b.at - a.at);
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
  return h ? `dans ${h} h ${String(m).padStart(2, '0')}` : `dans ${m} min`;
}

/** Numéro d'édition : N° 1 = premier épisode, une édition par jour. */
export function editionNumber(date: string, first: string | undefined): number | null {
  if (!first) return null;
  const n = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000) + 1;
  return n >= 1 ? n : null;
}
