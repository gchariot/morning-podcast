# Connecteur Claude « Garmin »

Tes données Garmin (sorties, forme, plan Campus Coach, prédictions, volume) dans Claude, en lecture seule.
Serveur MCP sans état en Python sur Vercel (bibliothèque non officielle `garminconnect`).

## Mise en place (une fois)
1. Vercel › Add New › Project › importer `morning-podcast` › **Root Directory : `garmin-mcp`** › Deploy.
2. Settings › Environment Variables : `GARMIN_EMAIL`, `GARMIN_PASSWORD`, `GARMIN_MCP_TOKEN` (24 caractères ou plus), puis Redeploy.
3. Vérifier `https://<projet>.vercel.app/status` : tout à « ok ».
4. Claude › Connecteurs › Ajouter un connecteur personnalisé : URL `https://<projet>.vercel.app/mcp`,
   Authentification « Aucune connexion », en-tête `X-Api-Key` = `GARMIN_MCP_TOKEN`.

## Outils
`sorties`, `detail_sortie`, `forme`, `plan`, `predictions`, `volume`.
