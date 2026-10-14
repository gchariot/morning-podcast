/** Vérifie episodes/YYYY-MM-DD/script.json : format, locuteurs, longueur. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, dateFromArgs, loadConfig } from './lib.js';
import { Script } from './schema.js';

export function loadScript(date: string) {
  const file = resolve(ROOT, `episodes/${date}/script.json`);
  const parsed = Script.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    throw new Error(`script.json invalide :\n${parsed.error.issues.map(i => `- ${i.path.join('.')} : ${i.message}`).join('\n')}`);
  }
  const script = parsed.data;
  const { show } = loadConfig();
  const hosts = new Set(show.hosts.map(h => h.name));
  // La voix météo ne parle que dans la rubrique météo.
  const meteoHost: string | undefined = (loadConfig() as { meteo?: { host?: string } }).meteo?.host;
  for (const seg of script.segments) {
    for (const t of seg.turns) {
      if (!hosts.has(t.speaker)) throw new Error(`Locuteur inconnu « ${t.speaker} » (attendu : ${[...hosts].join(', ')})`);
      if (meteoHost && t.speaker === meteoHost && seg.rubrique !== 'meteo') {
        throw new Error(`${meteoHost} ne parle que dans la rubrique « meteo » (trouvée dans « ${seg.rubrique} »).`);
      }
    }
  }
  const meteoIdx = script.segments.findIndex(sg => sg.rubrique === 'meteo');
  if (meteoIdx >= 0 && meteoIdx !== script.segments.length - 1) {
    throw new Error('La rubrique « meteo » doit être la dernière de l\'épisode (Léa dit au revoir à la fin de la météo).');
  }
  const words = script.segments.flatMap(s => s.turns).reduce((n, t) => n + t.text.split(/\s+/).length, 0);
  return { script, words, minutes: words / show.wordsPerMinute };
}

/** Durée visée pour cette date : édition du samedi/dimanche si elle existe, sinon la semaine. */
export function targetFor(date: string): { minutes: number; edition: string } {
  const config = loadConfig() as ReturnType<typeof loadConfig> & { editions?: Record<string, { targetMinutes: number }> };
  const day = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = dimanche, 6 = samedi
  const name = day === 6 ? 'samedi' : day === 0 ? 'dimanche' : null;
  const edition = name ? config.editions?.[name] : undefined;
  return edition ? { minutes: edition.targetMinutes, edition: name! } : { minutes: config.show.targetMinutes, edition: 'semaine' };
}

/** Bornes acceptées autour de la durée visée (en dessous : on refuse ; au-dessus : on prévient). */
export const MIN_RATIO = 0.85;
export const MAX_RATIO = 1.25;

if (import.meta.url === `file://${process.argv[1]}`) {
  const date = dateFromArgs();
  const { script, words, minutes } = loadScript(date);
  const { show } = loadConfig();
  const target = targetFor(date);
  const minWords = Math.round(target.minutes * MIN_RATIO * show.wordsPerMinute);
  const goalWords = Math.round(target.minutes * show.wordsPerMinute);
  console.log(`${script.segments.length} rubriques, ${words} mots, ~${minutes.toFixed(1)} min (visé : ${target.minutes} min, édition ${target.edition}, soit ~${goalWords} mots).`);
  if (words < minWords) {
    const perSeg = script.segments.map(s => `  - ${s.rubrique} : ${s.turns.reduce((n, t) => n + t.text.split(/\s+/).length, 0)} mots`).join('\n');
    console.error(`TROP COURT : ${words} mots, minimum ${minWords} (${Math.round(MIN_RATIO * 100)} % de ${target.minutes} min à ${show.wordsPerMinute} mots/min).`);
    console.error(`Il manque ~${goalWords - words} mots pour atteindre la durée visée. Développe les rubriques (contexte, enjeux, réactions, chiffres), sans meubler ni inventer :\n${perSeg}`);
    process.exit(1);
  }
  if (words > target.minutes * MAX_RATIO * show.wordsPerMinute) {
    console.warn(`Attention : plus long que prévu (~${minutes.toFixed(1)} min pour ${target.minutes} visées).`);
  }
  console.log('OK');
}
