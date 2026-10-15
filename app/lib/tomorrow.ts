import 'server-only';
import { listCommits, readFileAsOf } from './github';
import { loadConfig } from './config';

/**
 * « Ce qui change demain » : les modifications faites depuis l'appli depuis la dernière rédaction (5 h 37),
 * relues dans l'historique du dépôt (chaque écriture de l'appli est un commit au message lisible).
 */
export type Tomorrow = { when: string; items: string[] };

const WRITE_HOUR = 5, WRITE_MIN = 37;

/** Dernier passage de la rédaction (5 h 37 à Genève), et le prochain. */
function lastWriting(now = new Date()): { last: Date; nextLabel: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const before = minutes < WRITE_HOUR * 60 + WRITE_MIN;
  // Décalage horaire de Genève à cet instant (été +2, hiver +1).
  const offsetMin = Math.round((Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - now.getTime()) / 60000);
  const day = Date.UTC(+parts.year, +parts.month - 1, +parts.day) - (before ? 86400000 : 0);
  const last = new Date(day + (WRITE_HOUR * 60 + WRITE_MIN - offsetMin) * 60000);
  return { last, nextLabel: before ? 'ce matin à 5 h 37' : 'demain à 5 h 37' };
}

/** Traduit un message de commit de l'appli en ligne lisible ; null pour les écritures sans effet sur l'épisode. */
function describe(message: string): { key: string; label: string | null } | null {
  if (!message.endsWith('(app)')) return null;
  const m = message.replace(/\s*\(app\)$/, '');
  let x: RegExpMatchArray | null;
  if ((x = m.match(/^thèmes: « (.+) » mis en pause$/))) return { key: `t:${x[1]}`, label: `« ${x[1]} » en pause` };
  if ((x = m.match(/^thèmes: « (.+) » réactivé$/))) return { key: `t:${x[1]}`, label: `« ${x[1]} » revient` };
  if ((x = m.match(/^thèmes: « (.+) » modifié$/))) return { key: `t:${x[1]}`, label: `« ${x[1]} » modifié (durée, consigne ou sites)` };
  if ((x = m.match(/^thèmes: nouveau thème « (.+) »$/))) return { key: `t:${x[1]}`, label: `Nouveau thème : « ${x[1]} »` };
  if ((x = m.match(/^thèmes: « (.+) » supprimé$/))) return { key: `t:${x[1]}`, label: `« ${x[1]} » supprimé` };
  if ((x = m.match(/^thèmes: « (.+) » (rétabli|déjà présent)$/))) return { key: `t:${x[1]}`, label: null };
  if (m === 'thèmes: ordre modifié') return { key: 'ordre', label: 'Nouvel ordre des thèmes' };
  if ((x = m.match(/^réglages: (durée en semaine|samedi|dimanche) : (\d+) min$/))) {
    const what = x[1] === 'durée en semaine' ? 'Durée en semaine' : x[1] === 'samedi' ? 'Samedi' : 'Dimanche';
    return { key: `r:${x[1]}`, label: `${what} : ${x[2]} min` };
  }
  if (m === 'réglages: sujet du documentaire') return { key: 'doc', label: 'Sujet du documentaire de dimanche' };
  if (m.startsWith('retours: consignes permanentes')) return { key: 'regles', label: 'Consignes permanentes modifiées' };
  return null;
}

export async function loadTomorrow(): Promise<Tomorrow> {
  const { last, nextLabel } = lastWriting();
  const commits = await listCommits(last).catch(() => []);
  // Par sujet : le premier et le dernier changement depuis 5 h 37 ; deux changements qui s'annulent ne s'affichent pas.
  const first = new Map<string, string | null>(), latest = new Map<string, string | null>();
  for (const c of [...commits].reverse()) { // du plus ancien au plus récent
    const d = describe(c.message);
    if (!d) continue;
    if (!first.has(d.key)) first.set(d.key, d.label);
    latest.delete(d.key);
    latest.set(d.key, d.label);
  }
  const cancels = (a: string | null | undefined, b: string | null | undefined) =>
    (!!a && !!b && ((a.endsWith('en pause') && b.endsWith('revient')) || (a.endsWith('revient') && b.endsWith('en pause'))))
    || (!!a && a.startsWith('Nouveau thème') && (b ?? '').endsWith('supprimé'));
  // Réglages : une valeur revenue à celle de 5 h 37 (21 → 17 → 21) n'est pas un changement.
  const unchanged = new Set<string>();
  if ([...latest.keys()].some(k => k.startsWith('r:') || k === 'doc')) {
    const [before, now] = await Promise.all([
      readFileAsOf('config/rubriques.json', last).then(f => (f ? JSON.parse(f.content) : null)).catch(() => null),
      loadConfig().then(c => c.config as unknown as Record<string, any>).catch(() => null),
    ]);
    if (before && now) {
      const pick = (c: Record<string, any>) => ({
        'r:durée en semaine': c.show?.targetMinutes, 'r:samedi': c.editions?.samedi?.targetMinutes,
        'r:dimanche': c.editions?.dimanche?.targetMinutes, doc: c.documentaire?.sujet ?? '',
      }) as Record<string, unknown>;
      const a = pick(before), b = pick(now);
      for (const k of Object.keys(a)) if (a[k] === b[k]) unchanged.add(k);
    }
  }
  const items = [...latest.entries()]
    .filter(([k, v]) => v && !cancels(first.get(k), v) && !unchanged.has(k))
    .map(([, v]) => v as string);
  return { when: nextLabel, items };
}
