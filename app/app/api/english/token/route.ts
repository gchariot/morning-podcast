import { GoogleGenAI, Modality } from '@google/genai';
import { isLoggedIn } from '@/lib/auth';
import { LIVE_MODEL, NORA_VOICE, NOTE_CORRECTION, loadCarnet, noraInstruction, scenarioFor } from '@/lib/english';
import { todayInZurich } from '@/lib/episodes';

/**
 * Jeton à usage unique pour une séance avec Nora (Gemini Live), délivré au téléphone.
 * La clé Gemini ne quitte jamais le serveur ; le jeton est verrouillé sur le modèle et la consigne,
 * vaut une seule connexion, démarre dans la minute et expire après 20 minutes.
 */
export const dynamic = 'force-dynamic';

const DAILY_MAX = 8; // garde-fou de coût (≈ 0,15 $ la séance)
const issued = new Map<string, number>();

export async function POST() {
  if (!(await isLoggedIn())) return Response.json({ error: 'Connexion requise.' }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: 'La clé Gemini n’est pas configurée sur le serveur.' }, { status: 503 });

  const today = todayInZurich();
  const n = issued.get(today) ?? 0;
  if (n >= DAILY_MAX) return Response.json({ error: 'Assez parlé pour aujourd’hui : reviens demain.' }, { status: 429 });
  issued.clear();
  issued.set(today, n + 1);

  const scenario = scenarioFor(today);
  const { data: carnet } = await loadCarnet().catch(() => ({ data: [] }));
  const config = {
    responseModalities: [Modality.AUDIO],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: NORA_VOICE } } },
    systemInstruction: noraInstruction(scenario, carnet),
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    tools: [{ functionDeclarations: [NOTE_CORRECTION] }],
  };
  try {
    const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1alpha' } });
    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 20 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        // Verrouillé : le téléphone ne peut ni changer de modèle ni réécrire la consigne de Nora.
        liveConnectConstraints: { model: LIVE_MODEL, config: config as never },
      },
    });
    return Response.json({ token: token.name, model: LIVE_MODEL, config, scenario: scenario.id }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[english/token]', err instanceof Error ? err.message : err);
    return Response.json({ error: 'Nora n’est pas joignable pour le moment. Réessaie dans un instant.' }, { status: 502 });
  }
}
