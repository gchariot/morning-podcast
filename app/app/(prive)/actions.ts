'use server';
import { redirect } from 'next/navigation';
import { z, ZodError } from 'zod';
import { revalidatePath, updateTag } from 'next/cache';
import { REPO_TAG } from '@/lib/github';
import { closeSession, requireLogin } from '@/lib/auth';
import { loadConfig, parseDomains, saveConfig, slugify, type Rubrique } from '@/lib/config';
import { addRecent, loadRetours, removeRecent, setPermanent } from '@/lib/retours';
import { loadEpisodes, todayInZurich } from '@/lib/episodes';
import { isRevealed, saveAnswer } from '@/lib/quiz';

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

/* ---------- Thèmes ---------- */

function rubriqueFromForm(formData: FormData, id: string, previous?: Rubrique): Rubrique {
  return {
    id,
    title: str(formData, 'title'),
    minutes: num(formData, 'minutes'),
    brief: str(formData, 'brief'),
    domains: parseDomains(str(formData, 'domains')),
    enabled: previous?.enabled ?? true,
  };
}

export async function updateRubrique(formData: FormData) {
  return run('/themes', async () => {
    const id = str(formData, 'id');
    const { config, sha } = await loadConfig(true);
    const i = config.rubriques.findIndex(r => r.id === id);
    if (i < 0) throw new Error('Thème introuvable.');
    config.rubriques[i] = rubriqueFromForm(formData, id, config.rubriques[i]);
    await saveConfig(config, sha, `thèmes: « ${config.rubriques[i].title} » modifié (app)`);
    return `« ${config.rubriques[i].title} » enregistré.`;
  });
}

export async function addRubrique(formData: FormData) {
  return run('/themes', async () => {
    const { config, sha } = await loadConfig(true);
    const title = str(formData, 'title');
    let id = slugify(title);
    while (config.rubriques.some(r => r.id === id)) id = `${id.slice(0, 27)}-${Math.floor(Math.random() * 90 + 10)}`;
    const rubrique = rubriqueFromForm(formData, id);
    // Insérée juste avant la culture générale, qui clôt l'épisode avec le quiz.
    const culture = config.rubriques.findIndex(r => r.id === 'culture');
    config.rubriques.splice(culture >= 0 ? culture : config.rubriques.length, 0, rubrique);
    await saveConfig(config, sha, `thèmes: nouveau thème « ${rubrique.title} » (app)`);
    return `Nouveau thème « ${rubrique.title} » ajouté : il sera dans l'épisode de demain.`;
  });
}

export async function toggleRubrique(formData: FormData) {
  return run('/themes', async () => {
    const id = str(formData, 'id');
    const { config, sha } = await loadConfig(true);
    const r = config.rubriques.find(x => x.id === id);
    if (!r) throw new Error('Thème introuvable.');
    r.enabled = r.enabled === false;
    if (!config.rubriques.some(x => x.enabled !== false)) throw new Error('Il faut garder au moins un thème actif.');
    await saveConfig(config, sha, `thèmes: « ${r.title} » ${r.enabled ? 'réactivé' : 'mis en pause'} (app)`);
    return `« ${r.title} » ${r.enabled ? 'réactivé' : 'mis en pause'}.`;
  });
}

export async function moveRubrique(formData: FormData) {
  return run('/themes', async () => {
    const id = str(formData, 'id');
    const dir = str(formData, 'dir') === 'up' ? -1 : 1;
    const { config, sha } = await loadConfig(true);
    const i = config.rubriques.findIndex(r => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= config.rubriques.length) return 'Rien à déplacer.';
    [config.rubriques[i], config.rubriques[j]] = [config.rubriques[j], config.rubriques[i]];
    await saveConfig(config, sha, `thèmes: ordre modifié (app)`);
    return 'Ordre mis à jour.';
  });
}

export async function deleteRubrique(formData: FormData) {
  return run('/themes', async () => {
    const id = str(formData, 'id');
    if (str(formData, 'confirm') !== 'oui') throw new Error('Coche la case de confirmation pour supprimer.');
    const { config, sha } = await loadConfig(true);
    const r = config.rubriques.find(x => x.id === id);
    if (!r) throw new Error('Thème introuvable.');
    config.rubriques = config.rubriques.filter(x => x.id !== id);
    await saveConfig(config, sha, `thèmes: « ${r.title} » supprimé (app)`);
    return `« ${r.title} » supprimé.`;
  });
}

/* ---------- Réglages ---------- */

export async function updateSettings(formData: FormData) {
  return run('/reglages', async () => {
    const { config, sha } = await loadConfig(true);
    config.show.targetMinutes = num(formData, 'targetMinutes');
    const editions: NonNullable<typeof config.editions> = {};
    const factor = (m: number) => Math.min(1.5, Math.max(0.2, Math.round((m / config.show.targetMinutes) * 100) / 100));
    if (formData.get('samedi_on') === 'on') {
      const m = num(formData, 'samedi_minutes');
      editions.samedi = { targetMinutes: m, minutesFactor: factor(m), skip: formData.getAll('samedi_skip').map(String) };
    }
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

/** Nouvel ordre complet des thèmes (glisser-déposer). Renvoie un message au lieu de rediriger. */
export async function reorderRubriques(ids: string[]): Promise<{ ok: boolean; message: string }> {
  await requireLogin();
  try {
    const { config, sha } = await loadConfig(true);
    const current = config.rubriques.map(r => r.id);
    if (ids.length !== current.length || [...ids].sort().join() !== [...current].sort().join()) {
      return { ok: false, message: 'La liste a changé entre-temps : recharge la page.' };
    }
    if (ids.join() === current.join()) return { ok: true, message: 'Ordre inchangé.' };
    config.rubriques = ids.map(id => config.rubriques.find(r => r.id === id)!);
    // La météo clôt toujours l'épisode : elle reste en dernier.
    const meteo = config.rubriques.findIndex(r => r.id === 'meteo');
    if (meteo >= 0) config.rubriques.push(...config.rubriques.splice(meteo, 1));
    await saveConfig(config, sha, 'thèmes: ordre modifié (app)');
    updateTag(REPO_TAG);
    revalidatePath('/themes');
    return { ok: true, message: 'Ordre enregistré.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
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
