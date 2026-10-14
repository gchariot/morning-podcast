// Version actuellement en ligne (aucune donnée privée : juste l'identifiant du déploiement).
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { version: process.env.APP_VERSION },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
