'use server';
import { redirect } from 'next/navigation';
import { z, ZodError } from 'zod';
import { revalidatePath, updateTag } from 'next/cache';
import { REPO_TAG } from '@/lib/github';
import { closeSession, requireLogin } from '@/lib/auth';
import { loadConfig, parseDomains, Rubrique, saveConfig, slugify } from '@/lib/config';
import { addRecent, loadRetours, removeRecent, setPermanent } from '@/lib/retours';
import { loadEpisodes, todayInZurich } from '@/lib/episodes';
import { isRevealed, saveAnswer } from '@/lib/quiz';
import { loadSamedi, updateSamedi } from '@/lib/samedi';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const num = (f: FormData, k: string) => Number(String(f.get(k) ?? '').replace(',', '.'));

const FIELDS: Record<string, string> = {
  id: 'Nom du thème', title: 'Nom du thème', minutes: 'Durée', brief: 'Consigne', domains: 'Sites de référence',
  targetMinutes: 'Durée visée', minutesFactor: 'Durée du week-end',
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

/** Exécute une modification et revient sur la page avec un message. */
async function run(page: string, fn: () => Promise<string>): Promise<never> {
  await requireLogin();
  let target: string;
  try {
    const ok = await fn();
    updateTag(REPO_TAG);
    revalidatePath(page);
    target = `${page}?ok=${encodeURIComponent(ok)}`;
  } catch (err) {
    const msg = err instanceof ZodError ? humanize(err) : err instanceof Error ? err.message : String(err);
    target = `${page}?err=${encodeURIComponent(msg.slice(0, 300))}`;
  }
  redirect(target);
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

export async function sendFeedback(formData: FormData) {
  return run('/avis', async () => {
    const episode = str(formData, 'episode');
    const lines: string[] = [];
    for (const raw of formData.getAll('item')) {
      const it = FeedbackItem.parse(JSON.parse(String(raw)));
      const icon = it.vote === 'up' ? '👍' : it.vote === 'down' ? '👎' : '';
      const words = [it.chips.join(', '), it.note].filter(Boolean).join(' — ');
      if (!icon && !words) continue;
      lines.push(`[${it.title}] ${icon} ${words}`.replace(/\s+/g, ' ').trim());
    }
    const general = str(formData, 'general');
    if (general) lines.push(`[Général] ${general}`);
    if (!lines.length) throw new Error('Rien à envoyer : touche un pouce ou écris un mot.');
    const tagged = episode ? lines.map(l => `${l} (épisode du ${episode})`) : lines;
    const n = await addRecent(tagged, todayInZurich());
    return `${n} retour${n > 1 ? 's' : ''} envoyé${n > 1 ? 's' : ''} : la rédaction en tiendra compte demain matin.`;
  });
}

export async function removeFeedback(formData: FormData) {
  return run('/avis', async () => {
    await removeRecent(str(formData, 'line'));
    return 'Retour retiré.';
  });
}

export async function addPermanentRule(formData: FormData) {
  return run('/avis', async () => {
    const rule = str(formData, 'rule');
    if (rule.length < 3) throw new Error('Consigne trop courte.');
    const r = await loadRetours(true);
    await setPermanent([...r.permanent, rule]);
    return 'Consigne permanente ajoutée.';
  });
}

export async function removePermanentRule(formData: FormData) {
  return run('/avis', async () => {
    const index = num(formData, 'index');
    const r = await loadRetours(true);
    if (!(index >= 0 && index < r.permanent.length)) throw new Error('Consigne introuvable.');
    await setPermanent(r.permanent.filter((_, i) => i !== index));
    return 'Consigne supprimée.';
  });
}

/* ---------- Thèmes ----------
   Chaque action renvoie un résultat (pas de redirection) : la page reste en place,
   ce qui est en cours de saisie n'est jamais perdu, et la liste renvoyée resynchronise l'écran. */

export type ThemeResult = { ok: boolean; message: string; rubriques?: Rubrique[] };

const ThemeInput = z.object({
  id: z.string().optional(),
  title: z.string(),
  minutes: z.number(),
  brief: z.string(),
  domains: z.array(z.string()).default([]),
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
    const msg = err instanceof ZodError ? humanize(err) : err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg.slice(0, 300) };
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
      return { commit: `thèmes: « ${fields.title} » modifié (app)`, message: 'Enregistré : effet dès l’épisode de demain.' };
    }
    let id = slugify(fields.title);
    while (config.rubriques.some(r => r.id === id)) id = `${id.slice(0, 27)}-${Math.floor(Math.random() * 90 + 10)}`;
    config.rubriques.push(Rubrique.parse({ id, ...fields, enabled: true }));
    return { commit: `thèmes: nouveau thème « ${fields.title} » (app)`, message: `« ${fields.title} » ajouté : il sera dans l’épisode de demain.` };
  });
}

export async function setThemeEnabled(id: string, enabled: boolean): Promise<ThemeResult> {
  return themeOp(config => {
    const r = config.rubriques.find(x => x.id === id);
    if (!r) throw new Error('Ce thème n’existe plus : recharge la page.');
    r.enabled = enabled;
    if (!config.rubriques.some(x => x.enabled !== false)) throw new Error('Il faut garder au moins un thème actif.');
    return {
      commit: `thèmes: « ${r.title} » ${enabled ? 'réactivé' : 'mis en pause'} (app)`,
      message: enabled ? `« ${r.title} » revient demain.` : `« ${r.title} » en pause à partir de demain.`,
    };
  });
}

/** Supprime un thème ; le client garde une copie pour pouvoir l'annuler (restoreTheme). */
export async function deleteTheme(id: string): Promise<ThemeResult> {
  return themeOp(config => {
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
    if (config.rubriques.some(x => x.id === r.id)) return { commit: `thèmes: « ${r.title} » déjà présent (app)`, message: `« ${r.title} » est déjà là.` };
    config.rubriques.splice(Math.max(0, Math.min(index, config.rubriques.length)), 0, r);
    return { commit: `thèmes: « ${r.title} » rétabli (app)`, message: `« ${r.title} » rétabli.` };
  });
}

/** Nouvel ordre complet des thèmes (glisser-déposer). */
export async function reorderRubriques(ids: string[]): Promise<ThemeResult> {
  return themeOp(config => {
    const current = config.rubriques.map(r => r.id);
    if (ids.length !== current.length || [...ids].sort().join() !== [...current].sort().join()) {
      throw new Error('La liste a changé entre-temps : recharge la page.');
    }
    config.rubriques = ids.map(id => config.rubriques.find(r => r.id === id)!);
    return { commit: 'thèmes: ordre modifié (app)', message: 'Ordre enregistré : effet dès demain.' };
  });
}

/* ---------- Réglages ---------- */

export async function updateSettings(formData: FormData) {
  return run('/reglages', async () => {
    const { config, sha } = await loadConfig(true);
    config.show.targetMinutes = num(formData, 'targetMinutes');
    const editions: NonNullable<typeof config.editions> = {};
    const factor = (m: number) => Math.min(1.5, Math.max(0.2, Math.round((m / config.show.targetMinutes) * 100) / 100));
    // Samedi : toujours la grande édition (face-à-face, jeu, guide) ; seule sa durée se règle.
    const sm = num(formData, 'samedi_minutes');
    editions.samedi = { targetMinutes: sm, minutesFactor: factor(sm), skip: [] };
    // Dimanche : toujours le documentaire ; seule sa durée se règle (les thèmes ne s'appliquent pas ce jour-là).
    const dm = num(formData, 'dimanche_minutes');
    editions.dimanche = { targetMinutes: dm, minutesFactor: factor(dm), skip: [] };
    config.editions = editions;
    const sujet = str(formData, 'dimanche_sujet').slice(0, 200);
    (config as Record<string, unknown>).documentaire = { sujet };
    await saveConfig(config, sha, 'réglages: durée et éditions du week-end (app)');
    return 'Réglages enregistrés : effet dès le prochain épisode.';
  });
}

/* ---------- Quiz ---------- */

/** Enregistre la réponse au quiz d'un épisode (modifiable tant que la réponse n'a pas été donnée). */
export async function answerQuiz(date: string, choice: number): Promise<{ ok: boolean; message: string }> {
  await requireLogin();
  try {
    const episodes = await loadEpisodes();
    const ep = episodes.find(e => e.date === date);
    if (!ep?.quiz) return { ok: false, message: 'Pas de quiz pour cet épisode.' };
    if (!(Number.isInteger(choice) && choice >= 0 && choice < ep.quiz.choices.length)) return { ok: false, message: 'Choix invalide.' };
    if (isRevealed(date, episodes)) return { ok: false, message: 'Trop tard : la réponse a déjà été donnée dans l’épisode suivant.' };
    await saveAnswer(date, choice);
    updateTag(REPO_TAG);
    revalidatePath('/');
    return { ok: true, message: 'Réponse enregistrée : verdict demain matin dans la Matinale.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/* ---------- Samedi : jeu et face-à-face ---------- */

export type GameResult = { ok: boolean; message: string; answers?: number[]; correct?: number[]; explanations?: (string | undefined)[] };

/** Valide les réponses au jeu (une seule fois) et renvoie la correction. */
export async function submitGame(date: string, answers: number[]): Promise<GameResult> {
  await requireLogin();
  try {
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
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** Vote du face-à-face (0 = Léa, 1 = Hugo), modifiable jusqu'au samedi suivant. */
export async function voteDebate(date: string, side: 0 | 1): Promise<{ ok: boolean; message: string }> {
  await requireLogin();
  try {
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
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
