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

export async function readFile(path: string): Promise<RepoFile | null> {
  const res = await fetch(`${api()}/${path}?ref=${branch()}`, { headers: headers(), cache: 'no-store' });
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
