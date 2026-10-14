# La Matinale — l'app

Petite appli web privée pour piloter l'émission depuis le téléphone :

| Écran | Rôle | Fichier modifié dans le dépôt |
|---|---|---|
| 🎧 **Écouter** | Épisode du jour, chapitres cliquables, vitesse, reprise là où tu t'étais arrêté, épisodes précédents | — (lecture seule depuis R2) |
| 💬 **Mon avis** | 👍/👎 et un mot par rubrique, avis général, consignes permanentes | `retours.md` |
| 🧩 **Thèmes** | Modifier, mettre en pause, réordonner, supprimer, **créer** un thème | `config/rubriques.json` |
| ⚙️ **Réglages** | Durée visée, éditions du samedi et du dimanche | `config/rubriques.json` |

Chaque modification est un commit sur `main`, validé avant écriture : la rédaction de 5h37 la prend en compte dès le lendemain.

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Valeur |
|---|---|
| `APP_PASSWORD` | Ton mot de passe de connexion |
| `APP_SECRET` | Chaîne aléatoire (≥ 16 caractères) qui signe le cookie de session |
| `GITHUB_TOKEN` | Jeton GitHub *fine-grained* : dépôt `morning-podcast` uniquement, permission **Contents : Read and write** |
| `GITHUB_REPO` | `gchariot/morning-podcast` |
| `GITHUB_BRANCH` | `main` |
| `PUBLIC_BASE_URL` / `FEED_SECRET` | Les mêmes valeurs que les secrets GitHub Actions |

## Développement

```bash
cd app
cp .env.example .env.local   # puis remplis les valeurs
npm install
npm run dev                  # http://localhost:3000
```

Sur Vercel : *Root Directory* = `app`.
