'use server';
import { redirect } from 'next/navigation';
import { z, ZodError } from 'zod';
import { revalidatePath, updateTag } from 'next/cache';
import { REPO_TAG } from '@/lib/github';
import { closeSession, requireLogin } from '@/lib/auth';
import { loadConfig, parseDomains, Rubrique, saveConfig, slugify } from '@/lib/config';
import { loadRetours, replaceEpisodeFeedback, setPermanent } from '@/lib/retours';
import { loadEpisodes, todayInZurich } from '@/lib/episodes';
import { isRevealed, saveAnswer } from '@/lib/quiz';
import { loadSamedi, updateSamedi } from '@/lib/samedi';


const FIELDS: Record<string, string> = {
  id: 'Nom du thème', title: 'Nom du thème', minutes: 'Durée', brief: 'Consigne', domains: 'Sites de référence',
  targetMinutes: 'Durée en semaine', samedi: 'Durée du samedi', dimanche: 'Durée du dimanche', sujet: 'Sujet', chips: 'Précisions', note: 'Commentaire',
};

/** Erreurs de validation en français lisible : « Consigne : 10 caractères minimum ». */
function humanize(err: ZodError): string {
  const seen = new Set<string>();
  return err.issues
    .map(i => {
      const key = [...i.path].reverse().find(k => typeof k === 'string') as string | undefined;
      const field = (key && FIELDS[key]) || 'Valeur';
      let what = i.message;
      if (i.code === 'too_small') what = i.type === 'string' ? `${i.minimum} caractères minimum` : `minimum ${i.minimum}`;
      if (i.code === 'too_big') what = i.type === 'string' ? `${i.maximum} caractères maximum` : `maximum ${i.maximum}`;
      if (i.code === 'invalid_type') what = 'valeur manquante ou invalide';
      return `${field} : ${what}`;
    })
    .filter(m => !seen.has(m) && seen.add(m))
    .join(' · ');
}

export type Result = { ok: boolean; message: string };

/**
 * Message montré au téléphone : nos erreurs en français passent telles quelles ; les erreurs internes
 * (types inattendus, réponses brutes de GitHub) sont journalisées côté serveur et résumées.
 */
function publicMessage(err: unknown): string {
  if (err instanceof ZodError) return humanize(err);
  if (err instanceof TypeError || err instanceof SyntaxError || err instanceof RangeError) return 'Requête invalide.';
  const msg = err instanceof Error ? err.message : String(err);
  if (/^GitHub \d/.test(msg) || /Variable d'environnement|introuvable dans le dépôt/.test(msg)) {
    console.error('[action]', msg);
    return 'L’enregistrement a échoué côté stockage : réessaie dans un instant.';
  }
  return msg.slice(0, 300);
}

/** Arguments reçus du téléphone : jamais pris pour acquis. */
const Text = (max: number) => z.string().max(max);
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Id = z.string().regex(/^[a-z0-9-]{2,30}$/);

/** Exécute une écriture et renvoie un résultat lisible (jamais de redirection : la page reste en place). */
async function attempt<T extends object>(pages: string[], fn: () => Promise<T & Result>): Promise<T & Result> {
  await requireLogin();
  try {
    const res = await fn();
    updateTag(REPO_TAG);
    for (const p of pages) revalidatePath(p);
    return res;
  } catch (err) {
    return { ok: false, message: publicMessage(err) } as T & Result;
  }
}

export async function logout() {
  await closeSession();
  redirect('/login');
}

/* ---------- Mon avis ---------- */

const FeedbackItem = z.object({
  title: z.string().trim().min(1).max(80),
  vote: z.enum(['up', 'down', '']).default(''),
  chips: z.array(z.string().trim().max(40)).max(8).default([]),
  note: z.string().trim().max(300).default(''),
});

export type FeedbackResult = Result & { sent?: string[] };

/**
 * Envoie (ou corrige) l'avis sur un épisode. Seuls les sujets modifiés sont transmis ;
 * un sujet remis à blanc retire son avis. `general` : null = inchangé, '' = retiré.
 */
export async function saveFeedback(episode: string, rawItems: unknown[], general: string | null): Promise<FeedbackResult> {
  return attempt(['/avis'], async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(episode)) throw new Error('Aucun épisode à commenter pour l’instant.');
    const items = z.array(FeedbackItem).max(20).parse(rawItems);
    general = z.string().max(2000).nullable().parse(general);
    const tag = `(épisode du ${episode})`;
    const lines: string[] = [];
    const topics = items.map(i => i.title);
    for (const it of items) {
      const icon = it.vote === 'up' ? '👍' : it.vote === 'down' ? '👎' : '';
      const words = [it.chips.join(', '), it.note].filter(Boolean).join(' — ');
      if (icon || words) lines.push(`[${it.title}] ${icon} ${words} ${tag}`.replace(/\s+/g, ' ').trim());
    }
    if (general !== null) {
      topics.push('Général');
      const g = general.trim().slice(0, 600);
      if (g) lines.push(`[Général] ${g} ${tag}`.replace(/\s+/g, ' '));
    }
    if (!topics.length) throw new Error('Rien à envoyer : touche un pouce ou écris un mot.');
    const sent = await replaceEpisodeFeedback(tag, topics, lines, todayInZurich());
    const message = lines.length
      ? 'Avis envoyé.'
      : 'Avis retiré.';
    return { ok: true, message, sent };
  });
}

export type RulesResult = Result & { permanent?: string[]; index?: number };

export async function addRule(rule: string): Promise<RulesResult> {
  return attempt(['/avis'], async () => {
    const r = Text(2000).parse(rule).replace(/\s+/g, ' ').trim();
    if (r.length < 3) throw new Error('Consigne trop courte (3 caractères minimum).');
    const { permanent } = await loadRetours(true);
    if (permanent.includes(r)) return { ok: true, message: 'Cette consigne existe déjà.', permanent };
    const next = [...permanent, r];
    await setPermanent(next);
    return { ok: true, message: 'Consigne ajoutée.', permanent: next };
  });
}

/** Retire une consigne (par son texte, pas par sa position). L'index sert à l'annulation. */
export async function removeRule(rule: string): Promise<RulesResult> {
  return attempt(['/avis'], async () => {
    Text(2000).parse(rule);
    const { permanent } = await loadRetours(true);
    const index = permanent.indexOf(rule);
    if (index < 0) throw new Error('Cette consigne a déjà été retirée.');
    const next = permanent.filter((_, i) => i !== index);
    await setPermanent(next);
    return { ok: true, message: 'Consigne retirée.', permanent: next, index };
  });
}

export async function restoreRule(rule: string, index: number): Promise<RulesResult> {
  return attempt(['/avis'], async () => {
    Text(2000).parse(rule); z.number().int().min(0).max(100).parse(index);
    const { permanent } = await loadRetours(true);
    if (permanent.includes(rule)) return { ok: true, message: 'Consigne rétablie.', permanent };
    const next = [...permanent];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, rule);
    await setPermanent(next);
    return { ok: true, message: 'Consigne rétablie.', permanent: next };
  });
}

/* ---------- Réglages ---------- */

const SettingsPatch = z.object({
  targetMinutes: z.number().int().min(3).max(40).optional(),
  samedi: z.number().int().min(10).max(40).optional(),
  dimanche: z.number().int().min(5).max(30).optional(),
  sujet: z.string().max(200).optional(),
});

export type SettingsResult = Result & { targetMinutes?: number };

/** Enregistre un réglage dès qu'il change (comme les thèmes). */
export async function saveSettings(raw: z.input<typeof SettingsPatch>): Promise<SettingsResult> {
  return attempt(['/reglages', '/themes'], async () => {
    const patch = SettingsPatch.parse(raw);
    const { config, sha } = await loadConfig(true);
    if (patch.targetMinutes !== undefined) config.show.targetMinutes = patch.targetMinutes;
    const target = config.show.targetMinutes;
    const factor = (m: number) => Math.min(1.5, Math.max(0.2, Math.round((m / target) * 100) / 100));
    const ed = config.editions ?? {};
    const sm = patch.samedi ?? ed.samedi?.targetMinutes ?? 25;
    const dm = patch.dimanche ?? ed.dimanche?.targetMinutes ?? 10;
    // Samedi : toujours la grande édition ; dimanche : toujours le documentaire. Seules les durées se règlent.
    config.editions = {
      ...ed,
      samedi: { targetMinutes: sm, minutesFactor: factor(sm), skip: [] },
      dimanche: { targetMinutes: dm, minutesFactor: factor(dm), skip: [] },
    };
    if (patch.sujet !== undefined) (config as Record<string, unknown>).documentaire = { sujet: patch.sujet.trim() };
    const what = patch.targetMinutes !== undefined ? `durée en semaine : ${target} min`
      : patch.samedi !== undefined ? `samedi : ${sm} min`
      : patch.dimanche !== undefined ? `dimanche : ${dm} min`
      : 'sujet du documentaire';
    await saveConfig(config, sha, `réglages: ${what} (app)`);
    const message = patch.sujet !== undefined
      ? (patch.sujet.trim() ? 'Sujet enregistré pour dimanche.' : 'Sujet retiré : la rédaction choisira.')
      : `Enregistré : ${patch.targetMinutes !== undefined ? `semaine, ${target} min` : patch.samedi !== undefined ? `samedi, ${sm} min` : `dimanche, ${dm} min`}.`;
    return { ok: true, message, targetMinutes: target };
  });
}

/* ---------- Thèmes ----------
   Chaque action renvoie un résultat (pas de redirection) : la page reste en place,
   ce qui est en cours de saisie n'est jamais perdu, et la liste renvoyée resynchronise l'écran. */

export type ThemeResult = { ok: boolean; message: string; rubriques?: Rubrique[] };

const ThemeInput = z.object({
  id: Id.optional(),
  title: Text(200),
  minutes: z.number(),
  brief: Text(5000),
  domains: z.array(Text(300)).max(50).default([]),
});

/** La météo clôt toujours l'épisode. */
function meteoLast(list: Rubrique[]): Rubrique[] {
  const i = list.findIndex(r => r.id === 'meteo');
  return i < 0 || i === list.length - 1 ? list : [...list.slice(0, i), ...list.slice(i + 1), list[i]];
}

async function themeOp(fn: (config: Awaited<ReturnType<typeof loadConfig>>['config']) => { commit: string; message: string }): Promise<ThemeResult> {
  await requireLogin();
  try {
    const { config, sha } = await loadConfig(true);
    const { commit, message } = fn(config);
    config.rubriques = meteoLast(config.rubriques);
    await saveConfig(config, sha, commit);
    updateTag(REPO_TAG);
    revalidatePath('/themes');
    revalidatePath('/avis');
    return { ok: true, message, rubriques: config.rubriques };
  } catch (err) {
    return { ok: false, message: publicMessage(err) };
  }
}

/** Crée (sans id) ou modifie un thème. */
export async function saveTheme(raw: z.input<typeof ThemeInput>): Promise<ThemeResult> {
  return themeOp(config => {
    const input = ThemeInput.parse(raw);
    const fields = {
      title: input.title.trim(),
      minutes: input.minutes,
      brief: input.brief.trim(),
      domains: parseDomains(input.domains.join(' ')),
    };
    if (input.id) {
      const i = config.rubriques.findIndex(r => r.id === input.id);
      if (i < 0) throw new Error('Ce thème n’existe plus : recharge la page.');
      config.rubriques[i] = Rubrique.parse({ ...config.rubriques[i], ...fields });
      return { commit: `thèmes: « ${fields.title} » modifié (app)`, message: `« ${fields.title} » enregistré.` };
    }
    let id = slugify(fields.title);
    while (config.rubriques.some(r => r.id === id)) id = `${id.slice(0, 27)}-${Math.floor(Math.random() * 90 + 10)}`;
    config.rubriques.push(Rubrique.parse({ id, ...fields, enabled: true }));
    return { commit: `thèmes: nouveau thème « ${fields.title} » (app)`, message: `« ${fields.title} » ajouté.` };
  });
}

export async function setThemeEnabled(id: string, enabled: boolean): Promise<ThemeResult> {
  return themeOp(config => {
    Id.parse(id); z.boolean().parse(enabled);
    const r = config.rubriques.find(x => x.id === id);
    if (!r) throw new Error('Ce thème n’existe plus : recharge la page.');
    r.enabled = enabled;
    if (!config.rubriques.some(x => x.enabled !== false)) throw new Error('Il faut garder au moins un thème actif.');
    return {
      commit: `thèmes: « ${r.title} » ${enabled ? 'réactivé' : 'mis en pause'} (app)`,
      message: enabled ? `« ${r.title} » réactivé.` : `« ${r.title} » en pause.`,
    };
  });
}

/** Supprime un thème ; le client garde une copie pour pouvoir l'annuler (restoreTheme). */
export async function deleteTheme(id: string): Promise<ThemeResult> {
  return themeOp(config => {
    Id.parse(id);
    const r = config.rubriques.find(x => x.id === id);
    if (!r) throw new Error('Ce thème n’existe plus : recharge la page.');
    if (r.id === 'meteo') throw new Error('La météo ne se supprime pas : mets-la en pause si besoin.');
    config.rubriques = config.rubriques.filter(x => x.id !== id);
    if (!config.rubriques.some(x => x.enabled !== false)) throw new Error('Il faut garder au moins un thème actif.');
    return { commit: `thèmes: « ${r.title} » supprimé (app)`, message: `« ${r.title} » supprimé.` };
  });
}

/** Annule une suppression : le thème revient à sa place. */
export async function restoreTheme(raw: Rubrique, index: number): Promise<ThemeResult> {
  return themeOp(config => {
    const r = Rubrique.parse(raw);
    z.number().int().min(0).max(100).parse(index);
    if (config.rubriques.some(x => x.id === r.id)) return { commit: `thèmes: « ${r.title} » déjà présent (app)`, message: `« ${r.title} » est déjà là.` };
    config.rubriques.splice(Math.max(0, Math.min(index, config.rubriques.length)), 0, r);
    return { commit: `thèmes: « ${r.title} » rétabli (app)`, message: `« ${r.title} » rétabli.` };
  });
}

/** Nouvel ordre complet des thèmes (glisser-déposer). */
export async function reorderRubriques(ids: string[]): Promise<ThemeResult> {
  return themeOp(config => {
    z.array(Id).max(50).parse(ids);
    const current = config.rubriques.map(r => r.id);
    if (ids.length !== current.length || [...ids].sort().join() !== [...current].sort().join()) {
      throw new Error('La liste a changé entre-temps : recharge la page.');
    }
    config.rubriques = ids.map(id => config.rubriques.find(r => r.id === id)!);
    return { commit: 'thèmes: ordre modifié (app)', message: 'Ordre enregistré.' };
  });
}

/* ---------- Quiz ---------- */

/** Enregistre la réponse au quiz d'un épisode (modifiable tant que la réponse n'a pas été donnée). */
export async function answerQuiz(date: string, choice: number): Promise<{ ok: boolean; message: string }> {
  await requireLogin();
  try {
    Day.parse(date);
    const episodes = await loadEpisodes();
    const ep = episodes.find(e => e.date === date);
    if (!ep?.quiz) return { ok: false, message: 'Pas de quiz pour cet épisode.' };
    if (!(Number.isInteger(choice) && choice >= 0 && choice < ep.quiz.choices.length)) return { ok: false, message: 'Choix invalide.' };
    if (isRevealed(date, episodes)) return { ok: false, message: 'Trop tard : la réponse a déjà été donnée dans l’épisode suivant.' };
    await saveAnswer(date, choice);
    updateTag(REPO_TAG);
    revalidatePath('/');
    return { ok: true, message: 'Réponse enregistrée.' };
  } catch (err) {
    return { ok: false, message: publicMessage(err) };
  }
}

/* ---------- Samedi : jeu et face-à-face ---------- */

export type GameResult = { ok: boolean; message: string; answers?: number[]; correct?: number[]; explanations?: (string | undefined)[] };

/** Valide les réponses au jeu (une seule fois) et renvoie la correction. */
export async function submitGame(date: string, answers: number[]): Promise<GameResult> {
  await requireLogin();
  try {
    Day.parse(date); z.array(z.number().int()).max(20).parse(answers);
    const ep = (await loadEpisodes()).find(e => e.date === date);
    const qs = ep?.game?.questions;
    if (!qs) return { ok: false, message: 'Pas de jeu pour cet épisode.' };
    if (answers.length !== qs.length || answers.some((a, i) => !(Number.isInteger(a) && a >= 0 && a < qs[i].choices.length))) {
      return { ok: false, message: 'Réponds à toutes les questions avant de valider.' };
    }
    const { data } = await loadSamedi(true);
    const already = data[date]?.jeu;
    if (!already) await updateSamedi(date, { jeu: { answers, at: new Date().toISOString() } }, `samedi: réponses au jeu du ${date} (app)`);
    updateTag(REPO_TAG);
    const mine = already?.answers ?? answers;
    const score = mine.filter((a, i) => a === qs[i].answer).length;
    return {
      ok: true, message: already ? 'Tu avais déjà joué : voici ta correction.' : `${score}/${qs.length} !`,
      answers: mine, correct: qs.map(q => q.answer), explanations: qs.map(q => q.explanation),
    };
  } catch (err) {
    return { ok: false, message: publicMessage(err) };
  }
}

/** Vote du face-à-face (0 = Léa, 1 = Hugo), modifiable jusqu'au samedi suivant. */
export async function voteDebate(date: string, side: 0 | 1): Promise<{ ok: boolean; message: string }> {
  await requireLogin();
  try {
    Day.parse(date);
    const episodes = await loadEpisodes();
    const ep = episodes.find(e => e.date === date);
    if (!ep?.debate) return { ok: false, message: 'Pas de face-à-face pour cet épisode.' };
    if (side !== 0 && side !== 1) return { ok: false, message: 'Vote invalide.' };
    if (episodes.some(e => e.date > date && e.debate)) return { ok: false, message: 'Trop tard : le résultat a déjà été annoncé.' };
    await updateSamedi(date, { vote: side }, `samedi: vote du face-à-face du ${date} (app)`);
    updateTag(REPO_TAG);
    revalidatePath('/');
    return { ok: true, message: `Vote enregistré pour ${side === 0 ? 'Léa' : 'Hugo'} : résultat annoncé samedi prochain.` };
  } catch (err) {
    return { ok: false, message: publicMessage(err) };
  }
}
