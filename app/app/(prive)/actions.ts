'use server';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { revalidatePath } from 'next/cache';
import { closeSession, requireLogin } from '@/lib/auth';
import { loadConfig, parseDomains, saveConfig, slugify, type Rubrique } from '@/lib/config';
import { addRecent, loadRetours, setPermanent } from '@/lib/retours';
import { todayInZurich } from '@/lib/episodes';

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

export async function sendFeedback(formData: FormData) {
  return run('/avis', async () => {
    const { config } = await loadConfig();
    const episode = str(formData, 'episode');
    const lines: string[] = [];
    for (const r of config.rubriques) {
      const vote = str(formData, `vote_${r.id}`);
      const note = str(formData, `note_${r.id}`);
      if (!vote && !note) continue;
      const icon = vote === 'up' ? '👍' : vote === 'down' ? '👎' : '';
      lines.push(`[${r.title}] ${icon} ${note}`.replace(/\s+/g, ' ').trim());
    }
    const general = str(formData, 'general');
    if (general) lines.push(`[Général] ${general}`);
    if (!lines.length) throw new Error('Rien à envoyer : choisis un 👍/👎 ou écris un mot.');
    const tagged = episode ? lines.map(l => `${l} (épisode du ${episode})`) : lines;
    const n = await addRecent(tagged, todayInZurich());
    return `${n} retour${n > 1 ? 's' : ''} enregistré${n > 1 ? 's' : ''} : la rédaction en tiendra compte demain matin.`;
  });
}

export async function addPermanentRule(formData: FormData) {
  return run('/avis', async () => {
    const rule = str(formData, 'rule');
    if (rule.length < 3) throw new Error('Consigne trop courte.');
    const r = await loadRetours();
    await setPermanent([...r.permanent, rule]);
    return 'Consigne permanente ajoutée.';
  });
}

export async function removePermanentRule(formData: FormData) {
  return run('/avis', async () => {
    const index = num(formData, 'index');
    const r = await loadRetours();
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
    const { config, sha } = await loadConfig();
    const i = config.rubriques.findIndex(r => r.id === id);
    if (i < 0) throw new Error('Thème introuvable.');
    config.rubriques[i] = rubriqueFromForm(formData, id, config.rubriques[i]);
    await saveConfig(config, sha, `thèmes: « ${config.rubriques[i].title} » modifié (app)`);
    return `« ${config.rubriques[i].title} » enregistré.`;
  });
}

export async function addRubrique(formData: FormData) {
  return run('/themes', async () => {
    const { config, sha } = await loadConfig();
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
    const { config, sha } = await loadConfig();
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
    const { config, sha } = await loadConfig();
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
    const { config, sha } = await loadConfig();
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
    const { config, sha } = await loadConfig();
    config.show.targetMinutes = num(formData, 'targetMinutes');
    const editions: NonNullable<typeof config.editions> = {};
    for (const day of ['samedi', 'dimanche']) {
      if (formData.get(`${day}_on`) !== 'on') continue;
      editions[day] = {
        targetMinutes: num(formData, `${day}_minutes`),
        minutesFactor: Math.round((num(formData, `${day}_minutes`) / config.show.targetMinutes) * 100) / 100,
        skip: formData.getAll(`${day}_skip`).map(String),
      };
    }
    config.editions = editions;
    await saveConfig(config, sha, 'réglages: durée et éditions du week-end (app)');
    return 'Réglages enregistrés : effet dès le prochain épisode.';
  });
}
