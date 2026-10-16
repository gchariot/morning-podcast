# La Matinale — l'app

Petite appli web privée pour piloter l'émission depuis le téléphone :

| Écran | Rôle | Fichier modifié dans le dépôt |
|---|---|---|
| 🎧 **Écouter** | Lecteur (chapitres, −15 s / +30 s, vitesse, reprise), quiz du jour, jeu et face-à-face du samedi, sources, épisodes précédents. Le son continue d'un onglet à l'autre grâce au mini-lecteur. | `quiz.json`, `samedi.json` |
| 💬 **Mon avis** | « Dis-le » : un ressenti à voix haute (reconnaissance vocale de Chrome, épisode en pause pendant la dictée) ou au clavier, interprété par la rédaction ; pouce par thème, pastilles, consignes permanentes | `retours.md` |
| 🧩 **Thèmes** | Ordre par glisser-déposer (appui long), modifier, mettre en pause, supprimer, créer ; la météo reste en dernier | `config/rubriques.json` |
| ⚙️ **Réglages** | Durée en semaine, grande édition du samedi, documentaire du dimanche (durée, sujet souhaité), coût estimé du mois | `config/rubriques.json` |

Chaque modification est un commit sur `main`, validé avant écriture (relecture à jour juste avant, refus propre si le fichier a changé entre-temps) : la rédaction de 5h37 la prend en compte dès le lendemain.

**Bon à savoir**
- Les lectures du dépôt et de R2 sont en cache 5 minutes ; une modification faite dans l'app est visible tout de suite, une modification faite à la main sur GitHub peut mettre 5 minutes.
- Les bonnes réponses du quiz et du jeu ne sont envoyées au téléphone qu'une fois révélées.
- Un bandeau « Nouvelle version » apparaît quand un déploiement plus récent est en ligne (identifiant du déploiement Vercel lu à l'exécution).
- La fonction tourne à Francfort (`vercel.json`), près de Genève.
- Vercel ne reconstruit l'appli que si un fichier de `app/` a changé (`ignoreCommand`) : les écritures de l'appli et de la routine (avis, thèmes, épisodes) ne déclenchent ni déploiement ni bandeau « Nouvelle version ».

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Valeur |
|---|---|
| `APP_PASSWORD` | *Fortement conseillé.* Mot de passe de connexion. Sans lui, l'appli est ouverte à quiconque a l'adresse, y compris l'écriture des consignes lues par la rédaction. Le changer déconnecte tous les appareils |
| `APP_SECRET` | Chaîne aléatoire (≥ 16 caractères) qui signe le cookie de session ; utile seulement avec `APP_PASSWORD` |
| `GITHUB_TOKEN` | Jeton GitHub *fine-grained* : dépôt `morning-podcast` uniquement, permission **Contents : Read and write** |
| `GITHUB_REPO` | `gchariot/morning-podcast` |
| `GITHUB_BRANCH` | `main` |
| `PUBLIC_BASE_URL` / `FEED_SECRET` | Les mêmes valeurs que les secrets GitHub Actions |
| `GEMINI_API_KEY` | Pour l'onglet English (séance orale avec Nora). Reste sur le serveur : le téléphone ne reçoit qu'un jeton à usage unique (8 par jour au plus). Même clé que le secret GitHub |
| `ENGLISH_VOICE` / `ENGLISH_LIVE_MODEL` | *Facultatifs.* Voix de Nora (`Erinome`) et modèle Gemini Live (`gemini-3.8-live`) |

## Développement

```bash
cd app
cp .env.example .env.local   # puis remplis les valeurs
npm install
npm run dev                  # http://localhost:3000
```

Sur Vercel : *Root Directory* = `app`.

## Sécurité

- Le dépôt GitHub doit rester **privé** : il contient les avis, les consignes, les réponses au quiz et les scripts des épisodes.
- Connexion : 5 essais ratés en 15 min depuis une même adresse bloquent 15 min ; session de 90 jours signée avec `APP_SECRET` et liée au mot de passe.
- En-têtes : CSP, pas d'affichage dans un cadre, `nosniff`, `Referrer-Policy: same-origin`, HSTS, `noindex`.
- Actions serveur : session vérifiée et arguments validés à chaque appel ; les erreurs internes ne sont jamais renvoyées au téléphone.

