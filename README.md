# La Matinale — podcast quotidien perso

Chaque matin, un épisode d'environ 20 minutes à deux voix (Léa et Hugo) : nouveautés IA, football, politique, jeux vidéo, cinéma et séries, culture générale. Il arrive dans ton appli de podcast via un flux RSS privé.

## Comment ça tourne

| Heure (Genève, été) | Étape | Où | Coût |
|---|---|---|---|
| 5h00 | **1 · Données** : scores et classement (football-data.org), éphéméride Wikipédia → `data/<date>.json` | GitHub Actions (`data.yml`) | 0 |
| 5h37 | **2 · Rédaction** : recherche web par rubrique + dialogue → `episodes/<date>/script.json`, puis push | Tâche planifiée Claude (abonnement Pro), consigne : `prompts/redaction.md` | inclus dans Pro |
| ~5h50 | **3 · Voix et publication** : TTS par rubrique → MP3 → stockage S3 → `feed.xml` | GitHub Actions (`episode.yml`), déclenché par le push | ~0,27 $ / épisode (Gemini) |

L'hiver, tout part une heure plus tôt (cron GitHub en UTC).

## Mise en route

### 1. Secrets GitHub (Settings → Secrets and variables → Actions)

**Secrets**

| Nom | Où le trouver |
|---|---|
| `FOOTBALL_DATA_TOKEN` | Mail reçu après inscription sur football-data.org (offre gratuite) |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key |
| `S3_ENDPOINT` | R2 : `https://<account_id>.r2.cloudflarestorage.com` · Supabase : `https://<ref>.supabase.co/storage/v1/s3` |
| `S3_BUCKET` | Nom du bucket (ex. `matinale`) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 : « Manage API tokens » (Object Read & Write) · Supabase : Storage → S3 access keys |
| `PUBLIC_BASE_URL` | R2 : URL publique du bucket (`https://pub-xxxx.r2.dev`) · Supabase : `https://<ref>.supabase.co/storage/v1/object/public/<bucket>` |
| `FEED_SECRET` | Une longue chaîne aléatoire, ex. `openssl rand -hex 16` — elle rend l'URL du flux impossible à deviner |

**Variables** (facultatives)

| Nom | Valeur |
|---|---|
| `TTS_PROVIDER` | `gemini` (défaut) ou `elevenlabs` |
| `VOICE_LEA` / `VOICE_HUGO` | Voix Gemini (défaut : `Kore` / `Puck`) |
| `ELEVENLABS_VOICE_LEA` / `ELEVENLABS_VOICE_HUGO` | IDs de voix ElevenLabs (+ secret `ELEVENLABS_API_KEY`) |

### 2. Premier test

1. Actions → **1 · Données du jour** → Run workflow : un fichier `data/<date>.json` est commité.
2. Lance la tâche planifiée Claude une fois à la main : `episodes/<date>/script.json` arrive dans le dépôt.
3. Le workflow **3 · Voix et publication** part tout seul. Le MP3 est aussi téléchargeable dans les artefacts du run.
4. Ajoute `PUBLIC_BASE_URL/FEED_SECRET/feed.xml` dans Pocket Casts, Overcast ou Apple Podcasts (« suivre par URL »).

### Tester une voix en local

```bash
npm ci
GEMINI_API_KEY=... npm run tts:test            # out/test-gemini-00.wav
TTS_PROVIDER=elevenlabs ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_LEA=... ELEVENLABS_VOICE_HUGO=... npm run tts:test
```

## Régler l'émission

- Rubriques, durées, consignes, sites de référence : `config/rubriques.json`
- Ton, format, règles éditoriales : `prompts/redaction.md`
- Jingle d'ouverture : dépose un `assets/jingle.mp3`, il est ajouté automatiquement.

## Points d'attention

- La forme de requête Gemini TTS (`src/tts/gemini.ts`) suit la doc d'octobre 2026 ; si `npm run tts:test` renvoie une erreur de champ, c'est là qu'il faut ajuster.
- Les prix Gemini TTS doublent au 1er janvier 2027.
- Flux privé, usage personnel : l'épisode résume la presse, ne le partage pas.
- Une rubrique qui échoue à la synthèse est sautée ; le run est alors marqué en échec (mail GitHub) mais l'épisode est publié.
