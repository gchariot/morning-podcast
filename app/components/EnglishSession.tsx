'use client';
/**
 * La séance orale avec Nora (Gemini Live) : micro → Gemini en direct → voix de Nora, sous-titres,
 * corrections notées par Nora (outil note_correction), puis récap et carnet d'erreurs.
 * La clé Gemini reste sur le serveur : le téléphone reçoit un jeton à usage unique (/api/english/token).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleGenAI, type LiveServerMessage, type Session } from '@google/genai';
import { Icon } from './Icon';
import { useAudio } from './Audio';
import { useOnline } from './Connectivity';
import { saveEnglishSession, type SessionResult } from '@/app/(prive)/english-actions';
import { safeCall } from '@/lib/safe';

type Fix = { wrong: string; right: string; rule: string };
type Turn = { who: 'me' | 'nora'; text: string; done: boolean; fix?: Fix };
type Phase = 'idle' | 'connecting' | 'live' | 'saving' | 'recap' | 'denied' | 'cut' | 'error';

const TARGET_MIN = 12;
const HARD_STOP_S = 14 * 60; // les séances audio Gemini Live s'arrêtent à 15 min
const IN_RATE = 16000;
const OUT_RATE = 24000;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function toBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Ramène le micro (souvent 48 kHz) à 16 kHz, en entiers 16 bits. */
function downsample(input: Float32Array, rate: number): Int16Array {
  const ratio = rate / IN_RATE;
  const out = new Int16Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

export function EnglishSession({ scenario, role, brief, children }: {
  scenario: string; role: string; brief: string; children?: React.ReactNode;
}) {
  const router = useRouter();
  const online = useOnline();
  const audio = useAudio();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [secs, setSecs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recap, setRecap] = useState<(Fix & { count?: number })[]>([]);

  const session = useRef<Session | null>(null);
  const micCtx = useRef<AudioContext | null>(null);
  const outCtx = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const sources = useRef<AudioBufferSourceNode[]>([]);
  const nextAt = useRef(0);
  const pausedRef = useRef(false);
  const ending = useRef(false);
  const startedAt = useRef(0);
  const fixes = useRef<Fix[]>([]);
  const log = useRef<Turn[]>([]);
  const pending = useRef<Int16Array[]>([]);

  const push = useCallback((fn: (t: Turn[]) => Turn[]) => { log.current = fn(log.current); setTurns(log.current); }, []);

  const stopPlayback = useCallback(() => {
    for (const s of sources.current) { try { s.stop(); } catch { /* déjà fini */ } }
    sources.current = [];
    nextAt.current = 0;
    setSpeaking(false);
  }, []);

  const play = useCallback((b64: string) => {
    const ctx = outCtx.current;
    if (!ctx) return;
    const bin = atob(b64);
    const pcm = new Int16Array(bin.length / 2);
    for (let i = 0; i < pcm.length; i++) pcm[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16 >> 16;
    const buf = ctx.createBuffer(1, pcm.length, OUT_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const at = Math.max(ctx.currentTime + 0.02, nextAt.current);
    src.start(at);
    nextAt.current = at + buf.duration;
    sources.current.push(src);
    setSpeaking(true);
    src.onended = () => {
      sources.current = sources.current.filter(s => s !== src);
      if (!sources.current.length) setSpeaking(false);
    };
  }, []);

  const teardown = useCallback(() => {
    try { session.current?.close(); } catch { /* ignoré */ }
    session.current = null;
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    stopPlayback();
    void micCtx.current?.close().catch(() => {});
    void outCtx.current?.close().catch(() => {});
    micCtx.current = null; outCtx.current = null;
    audio.setHeld(false);
  }, [stopPlayback, audio]);

  const onMessage = useCallback((m: LiveServerMessage) => {
    const sc = m.serverContent;
    if (sc?.interrupted) stopPlayback();
    for (const part of sc?.modelTurn?.parts ?? []) if (part.inlineData?.data) play(part.inlineData.data);
    const heard = sc?.inputTranscription?.text;
    if (heard) push(t => {
      const last = t[t.length - 1];
      return last && last.who === 'me' && !last.done ? [...t.slice(0, -1), { ...last, text: last.text + heard }] : [...t, { who: 'me', text: heard.trimStart(), done: false }];
    });
    const said = sc?.outputTranscription?.text;
    if (said) push(t => {
      const closed = t.map(x => (x.who === 'me' ? { ...x, done: true } : x));
      const last = closed[closed.length - 1];
      return last && last.who === 'nora' && !last.done ? [...closed.slice(0, -1), { ...last, text: last.text + said }] : [...closed, { who: 'nora', text: said.trimStart(), done: false }];
    });
    if (sc?.turnComplete) push(t => t.map(x => ({ ...x, done: true })));
    const calls = m.toolCall?.functionCalls ?? [];
    if (calls.length) {
      for (const c of calls) {
        if (c.name !== 'note_correction') continue;
        const a = (c.args ?? {}) as Partial<Fix>;
        const fix = { wrong: String(a.wrong ?? '').slice(0, 300), right: String(a.right ?? '').slice(0, 300), rule: String(a.rule ?? '').slice(0, 200) };
        if (!fix.right) continue;
        fixes.current.push(fix);
        // La correction s'accroche à ta dernière phrase.
        push(t => {
          const i = t.map(x => x.who).lastIndexOf('me');
          if (i < 0) return t;
          const copy = [...t];
          copy[i] = { ...copy[i], fix };
          return copy;
        });
      }
      session.current?.sendToolResponse({ functionResponses: calls.map(c => ({ id: c.id, name: c.name, response: { result: 'ok' } })) });
    }
  }, [play, push, stopPlayback]);

  const finish = useCallback(async () => {
    if (ending.current) return;
    ending.current = true;
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    teardown();
    setPhase('saving');
    const transcript = log.current.map(t => `${t.who === 'me' ? 'Me' : 'Nora'}: ${t.text.trim()}`).join('\n');
    const res = await safeCall<SessionResult>(() => saveEnglishSession({ scenario, seconds, fixes: fixes.current, transcript }));
    setRecap(res.ok && res.fixes ? res.fixes : fixes.current);
    if (!res.ok) setError(res.message);
    setPhase('recap');
    router.refresh();
  }, [teardown, scenario, router]);

  const start = useCallback(async () => {
    setError('');
    setPhase('connecting');
    ending.current = false;
    fixes.current = []; log.current = []; setTurns([]); setSecs(0); setPaused(false); pausedRef.current = false;
    // L'épisode en cours se met en pause : le micro capterait Léa et Hugo.
    if (audio.playing) audio.toggle();
    audio.setHeld(Boolean(audio.track));
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      audio.setHeld(false);
      setPhase((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error');
      setError('Micro introuvable ou indisponible.');
      return;
    }
    try {
      const res = await fetch('/api/english/token', { method: 'POST' });
      const body = await res.json() as { token?: string; model?: string; config?: Record<string, unknown>; error?: string };
      if (!res.ok || !body.token) throw new Error(body.error || 'Nora n’est pas joignable pour le moment.');
      outCtx.current = new AudioContext();
      const ctx = new AudioContext();
      micCtx.current = ctx;
      await ctx.audioWorklet.addModule('/english-mic.js');
      const ai = new GoogleGenAI({ apiKey: body.token, httpOptions: { apiVersion: 'v1alpha' } });
      session.current = await ai.live.connect({
        model: body.model!,
        config: body.config as never,
        callbacks: {
          onmessage: onMessage,
          onerror: () => { if (!ending.current) { teardown(); setPhase('cut'); } },
          onclose: () => { if (!ending.current && session.current) { teardown(); setPhase('cut'); } },
        },
      });
      // Micro → 16 kHz → Gemini, par blocs d'environ 100 ms.
      const node = new AudioWorkletNode(ctx, 'english-mic');
      node.port.onmessage = ev => {
        if (pausedRef.current || !session.current) return;
        pending.current.push(downsample(ev.data as Float32Array, ctx.sampleRate));
        const total = pending.current.reduce((n, b) => n + b.length, 0);
        if (total < IN_RATE / 10) return;
        const all = new Int16Array(total);
        let o = 0;
        for (const b of pending.current) { all.set(b, o); o += b.length; }
        pending.current = [];
        session.current.sendRealtimeInput({ audio: { data: toBase64(all), mimeType: `audio/pcm;rate=${IN_RATE}` } });
      };
      ctx.createMediaStreamSource(stream.current).connect(node);
      startedAt.current = Date.now();
      setPhase('live');
      // Nora ouvre la séance.
      session.current.sendClientContent({ turns: [{ role: 'user', parts: [{ text: 'Start the session now.' }] }], turnComplete: true });
    } catch (e) {
      teardown();
      setError(e instanceof Error ? e.message : 'Nora n’est pas joignable pour le moment.');
      setPhase('error');
    }
  }, [audio, onMessage, teardown]);

  // Minuterie, arrêt automatique avant la limite de 15 min de Gemini Live.
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => {
      const s = Math.round((Date.now() - startedAt.current) / 1000);
      setSecs(s);
      if (s >= HARD_STOP_S) void finish();
    }, 1000);
    return () => clearInterval(t);
  }, [phase, finish]);

  // Quitter la page coupe proprement la séance.
  useEffect(() => () => { ending.current = true; teardown(); }, [teardown]);

  const togglePause = () => {
    const p = !pausedRef.current;
    pausedRef.current = p;
    setPaused(p);
    if (p) void outCtx.current?.suspend(); else void outCtx.current?.resume();
  };

  /* ---------- Rendu ---------- */

  if (phase === 'live' || phase === 'connecting' || phase === 'saving') {
    const nCorr = turns.filter(t => t.fix).length;
    const recent = turns.slice(-4);
    return (
      <section aria-label="Conversation avec Nora">
        <div className="talk-status">
          <span><span className="live-dot" aria-hidden />{phase === 'live' ? <>En direct · <time className="num">{mmss(secs)}</time> / {TARGET_MIN} min</> : phase === 'saving' ? 'Enregistrement…' : 'Connexion à Nora…'}</span>
          {nCorr > 0 && <span>{nCorr} correction{nCorr > 1 ? 's' : ''} notée{nCorr > 1 ? 's' : ''}</span>}
        </div>
        <div className="log" role="log" aria-live="off" lang="en">
          {recent.map((t, i) => {
            const last = i === recent.length - 1;
            return (
              <div key={turns.length - recent.length + i}>
                <div className={`turn${t.who === 'nora' ? (last || !recent.slice(i + 1).some(x => x.who === 'nora') ? ' nora-line' : ' past') : !t.done ? ' me-live' : ' past'}`}>
                  <div className={`who${t.who === 'nora' ? ' nora' : ''}`} lang="fr">{t.who === 'nora' ? <><span className="voice-dot nora" aria-hidden />Nora</> : 'Toi'}</div>
                  <p>{t.text}{t.who === 'me' && !t.done && <span className="caret" aria-hidden />}</p>
                </div>
                {t.fix && (
                  <div className="fix" style={{ marginTop: 10 }} role="status" aria-live="polite">
                    <div className="who nora" lang="fr"><span className="voice-dot nora" aria-hidden />Nora corrige</div>
                    <p className="now">{t.fix.right}</p>
                    {t.fix.rule && <p className="why" lang="fr">{t.fix.rule}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="dock">
          <div className="side">
            <button type="button" className="round" onClick={togglePause} disabled={phase !== 'live'} aria-label={paused ? 'Reprendre' : 'Pause'}>
              <Icon name={paused ? 'play' : 'pause'} size={22} />
            </button>
            {paused ? 'Reprendre' : 'Pause'}
          </div>
          <div className="orb-wrap" aria-live="polite">
            <div className={`orb${speaking ? ' nora' : ''}`} aria-hidden><Icon name="mic" size={28} /></div>
            <span className="orb-label" style={speaking ? { color: 'var(--nora)' } : undefined}>{paused ? 'En pause' : speaking ? 'Nora parle' : 'À toi'}</span>
          </div>
          <div className="side end">
            <button type="button" className="round" onClick={() => void finish()} disabled={phase !== 'live'} aria-label="Terminer la séance">
              <Icon name="stop" size={20} />
            </button>
            Terminer
          </div>
        </div>
      </section>
    );
  }

  if (phase === 'recap') {
    return (
      <section aria-label="Récap de la séance">
        <h2>{recap.length ? 'À corriger' : 'Séance terminée'}</h2>
        {recap.length
          ? <div className="group fixes" style={{ marginTop: 12 }} lang="en">
              {recap.map((f, i) => (
                <div className="fx" key={i}>
                  <span className="grow">
                    {f.wrong && <span className="was">{f.wrong}</span>}
                    <span className="now">{f.right}</span>
                    <span className="why" lang="fr">{f.rule}{f.count && f.count > 1 ? <span className="count">{f.count}ᵉ fois</span> : null}</span>
                  </span>
                </div>
              ))}
            </div>
          : <p className="muted" style={{ marginTop: 8 }}>Aucune erreur notée cette fois.</p>}
        {recap.length > 0 && (
          <div className="tomorrow-en">
            <h2><Icon name="sparkle" size={16} /> La prochaine fois</h2>
            <p style={{ marginTop: 6 }}>Nora reprendra ces points : ils sont dans ton carnet.</p>
          </div>
        )}
        {error && <p className="editor-err" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={() => void start()}><Icon name="mic" size={18} /> Encore un tour</button>
          <button type="button" className="btn primary" onClick={() => setPhase('idle')}>Terminé</button>
        </div>
      </section>
    );
  }

  const blocked = !online;
  return (
    <>
      <div className="group en-day">
        <div className="en-talk">
          <div className="en-who"><span className="voice-dot nora" aria-hidden /><span><b>Nora</b> joue {role}</span></div>
          <p className="en-brief">{brief}</p>
          <button type="button" className="btn primary block" onClick={() => void start()} disabled={blocked}>
            <Icon name="mic" size={20} /> Parler avec Nora <span className="num">· {TARGET_MIN} min</span>
          </button>
          <p className={`field-hint${phase === 'idle' || blocked ? '' : ' err'}`} role={phase === 'idle' ? undefined : 'alert'}>
            {blocked ? 'La conversation attend le réseau.'
              : phase === 'denied' ? 'Nora ne t’entend pas : autorise le micro (cadenas de Chrome › Micro).'
              : phase === 'cut' ? 'Ça a coupé. Relance quand le réseau revient.'
              : phase === 'error' ? error
              : 'Casque conseillé · elle corrige après chaque phrase'}
          </p>
        </div>
      </div>
      {children}
    </>
  );
}
