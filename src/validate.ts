/** Vérifie episodes/YYYY-MM-DD/script.json : format, locuteurs, longueur. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, dateFromArgs, loadConfig } from './lib.js';
import { Script } from './schema.js';

/**
 * Lit et vérifie le script. `strict` (la validation de la rédaction) refuse aussi les écarts de forme ;
 * sans `strict` (fabrication de l'épisode) ces écarts sont seulement signalés : mieux vaut un épisode imparfait que pas d'épisode.
 */
export function loadScript(date: string, strict = false) {
  const file = resolve(ROOT, `episodes/${date}/script.json`);
  const parsed = Script.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    throw new Error(`script.json invalide :\n${parsed.error.issues.map(i => `- ${i.path.join('.')} : ${i.message}`).join('\n')}`);
  }
  const script = parsed.data;
  const { show } = loadConfig();
  const hosts = new Set(show.hosts.map(h => h.name));
  const problems: string[] = [];
  // La voix météo et les chroniqueurs ne parlent que dans leurs rubriques.
  const meteoHost: string | undefined = (loadConfig() as { meteo?: { host?: string } }).meteo?.host;
  const only = new Map(show.hosts.filter(h => h.rubriques?.length).map(h => [h.name, h.rubriques!]));
  if (meteoHost && !only.has(meteoHost)) only.set(meteoHost, ['meteo']);
  for (const seg of script.segments) {
    for (const t of seg.turns) {
      if (!hosts.has(t.speaker)) throw new Error(`Locuteur inconnu « ${t.speaker} » (attendu : ${[...hosts].join(', ')})`);
      const allowed = only.get(t.speaker);
      if (allowed && !allowed.includes(seg.rubrique)) {
        problems.push(`${t.speaker} ne parle que dans ${allowed.map(r => `« ${r} »`).join(', ')} (trouvé dans « ${seg.rubrique} »).`);
      }
    }
    // Une rubrique qui a son chroniqueur le fait parler.
    for (const [name, rubs] of only) {
      if (rubs.includes(seg.rubrique) && !seg.turns.some(t => t.speaker === name)) {
        problems.push(`La rubrique « ${seg.rubrique} » se fait avec ${name} : fais-le parler.`);
      }
    }
  }
  if (script.segments.some(sg => sg.rubrique === 'culture' || sg.rubrique === 'doc') && !script.quiz) {
    problems.push('La culture générale pose le quiz du jour : remplis `quiz` (question, 3 ou 4 choix, index de la bonne réponse, explication).');
  }
  const saturday = new Date(`${date}T12:00:00Z`).getUTCDay() === 6;
  if (saturday && (!script.game || script.game.questions.length !== 8)) problems.push('Le samedi : remplis `game` avec exactement 8 questions (celles lues dans la partie « jeu »).');
  if (saturday && !script.debate) problems.push('Le samedi : remplis `debate` (sujet du face-à-face et les deux positions).');
  // Jours de diffusion : en semaine, un thème hors de ses jours ne doit pas apparaître.
  const weekday = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'][new Date(`${date}T12:00:00Z`).getUTCDay()];
  if (weekday !== 'sam' && weekday !== 'dim') {
    for (const r of loadConfig().rubriques) {
      if (r.jours?.length && !r.jours.includes(weekday) && script.segments.some(sg => sg.rubrique === r.id)) {
        problems.push(`« ${r.title} » ne passe que ${r.jours.join(', ')} : retire ce segment de l'épisode du ${weekday}.`);
      }
    }
  }
  const meteoIdx = script.segments.findIndex(sg => sg.rubrique === 'meteo');
  if (meteoIdx >= 0 && meteoIdx !== script.segments.length - 1) {
    problems.push('La rubrique « meteo » doit être la dernière de l\'épisode (Léa dit au revoir à la fin de la météo).');
  }
  if (problems.length) {
    if (strict) throw new Error(problems.join('\n'));
    for (const p of [...new Set(problems)]) console.warn(`⚠️ ${p}`);
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
  const { script, words, minutes } = loadScript(date, true);
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
