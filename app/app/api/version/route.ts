import { currentVersion } from '@/lib/version';

// Version actuellement en ligne (aucune donnée privée : juste l'identifiant du déploiement).
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ version: currentVersion() }, { headers: { 'Cache-Control': 'no-store' } });
}
