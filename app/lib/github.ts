import 'server-only';

/** Lecture / écriture de fichiers du dépôt via l'API GitHub « contents ». */

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

const api = () => `${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${env('GITHUB_REPO')}/contents`;
const branch = () => process.env.GITHUB_BRANCH || 'main';
const headers = () => ({
  Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'matinale-app',
});

export type RepoFile = { content: string; sha: string };

/** Tag de cache des lectures du dépôt : invalidé après chaque écriture faite par l'app. */
export const REPO_TAG = 'repo';

/**
 * Lit un fichier. Par défaut, la lecture est mise en cache 5 min (affichage rapide des pages) ;
 * `fresh` force une lecture à jour, obligatoire avant d'écrire (le sha doit être le dernier).
 */
export async function readFile(path: string, fresh = false): Promise<RepoFile | null> {
  const res = await fetch(`${api()}/${path}?ref=${branch()}`, {
    headers: headers(),
    ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: 300, tags: [REPO_TAG] } }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} en lisant ${path}`);
  const json = (await res.json()) as { content: string; sha: string };
  return { content: Buffer.from(json.content, 'base64').toString('utf8'), sha: json.sha };
}

export class ConflictError extends Error {}

/** Écrit un fichier. `sha` = version lue ; si quelqu'un a modifié entre-temps, GitHub refuse (409). */
export async function writeFile(path: string, content: string, message: string, sha?: string) {
  const res = await fetch(`${api()}/${path}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: branch(),
      ...(sha ? { sha } : {}),
      committer: { name: 'Matinale App', email: 'matinale-app@users.noreply.github.com' },
    }),
  });
  if (res.status === 409 || res.status === 422) throw new ConflictError('Le fichier a changé entre-temps : recharge la page et recommence.');
  if (!res.ok) throw new Error(`GitHub ${res.status} en écrivant ${path} : ${await res.text()}`);
}

/** Messages des commits sur la branche depuis une date (les plus récents d'abord). */
export async function listCommits(since: Date): Promise<{ message: string; date: string }[]> {
  const base = `${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${env('GITHUB_REPO')}/commits`;
  const res = await fetch(`${base}?sha=${branch()}&since=${since.toISOString()}&per_page=60`, {
    headers: headers(),
    next: { revalidate: 300, tags: [REPO_TAG] },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} en lisant l'historique`);
  const json = (await res.json()) as { commit: { message: string; author?: { date?: string }; committer?: { date?: string } } }[];
  return json.map(c => ({ message: c.commit.message.split('\n')[0], date: c.commit.committer?.date ?? c.commit.author?.date ?? '' }));
}
