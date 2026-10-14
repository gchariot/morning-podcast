import 'server-only';

/**
 * Identifiant du déploiement qui répond, lu à l'exécution (jamais gravé à la compilation) :
 * la page et /api/version le lisent au même endroit, donc ils concordent toujours pour un même déploiement.
 */
export function currentVersion(): string {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_VERSION || 'dev';
}
