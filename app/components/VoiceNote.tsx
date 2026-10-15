'use client';
/**
 * « Dis-le » : un ressenti sur l'épisode, à voix haute (ou au clavier).
 * La reconnaissance vocale du navigateur transcrit en direct ; le texte se relit et se corrige,
 * puis part avec « Envoyer pour demain » comme note libre. La rédaction de 5 h 37 l'interprète.
 * Pendant la dictée, l'épisode est en pause (sinon le micro capterait Léa et Hugo) et reprend 3 s en arrière.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useAudio } from './Audio';
import { useOnline } from './Connectivity';

export const NOTE_MAX = 600;

type Mode = 'idle' | 'listening' | 'review' | 'denied' | 'nothing' | 'cut';

/* Types minimaux de la reconnaissance vocale (absente des types DOM standard). */
type Alt = { transcript: string };
type ResultItem = { isFinal: boolean; 0: Alt };
type RecEvent = { resultIndex: number; results: ArrayLike<ResultItem> };
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: RecEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecCtor = new () => Recognition;

function recognitionCtor(): RecCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(' ').slice(0, NOTE_MAX);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function VoiceNote({ value, sent, onChange, autoListen = false }: {
  value: string; sent: string; onChange: (v: string) => void; autoListen?: boolean;
}) {
  const uid = useId();
  const online = useOnline();
  const audio = useAudio();
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [writing, setWriting] = useState(false);
  const [finals, setFinals] = useState('');
  const [interim, setInterim] = useState('');
  const [secs, setSecs] = useState(0);
  const [firstUse, setFirstUse] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const base = useRef('');
  const heard = useRef({ finals: '', interim: '' });
  const failure = useRef<Mode | null>(null);
  const resume = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const micBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSupported(Boolean(recognitionCtor()));
    try { setFirstUse(!localStorage.getItem('matinale_micro')); } catch { /* ignoré */ }
  }, []);

  // L'épisode reprend 3 s en arrière s'il jouait avant la dictée.
  const release = useCallback(() => {
    audio.setHeld(false);
    if (resume.current) { resume.current = false; audio.skip(-3); audio.toggle(); }
  }, [audio]);

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || !navigator.onLine) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = 'fr-FR'; r.interimResults = true; r.continuous = true;
    base.current = value;
    heard.current = { finals: '', interim: '' };
    failure.current = null;
    setFinals(''); setInterim(''); setSecs(0);
    r.onresult = e => {
      let f = '', i = '';
      for (let k = 0; k < e.results.length; k++) {
        const res = e.results[k];
        if (res.isFinal) f += res[0].transcript; else i += res[0].transcript;
      }
      heard.current = { finals: f, interim: i };
      setFinals(f); setInterim(i);
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') failure.current = 'denied';
      else if (e.error === 'no-speech') failure.current = 'nothing';
      else if (e.error === 'network') failure.current = 'cut';
    };
    r.onend = () => {
      rec.current = null;
      const said = join(heard.current.finals, heard.current.interim);
      release();
      if (failure.current === 'denied') { setMode('denied'); return; }
      if (!said) { setMode(failure.current === 'cut' ? 'cut' : 'nothing'); return; }
      onChange(join(base.current, said));
      setMode(failure.current === 'cut' ? 'cut' : 'review');
      setTimeout(() => area.current?.focus(), 50);
    };
    try { localStorage.setItem('matinale_micro', '1'); } catch { /* ignoré */ }
    setFirstUse(false);
    if (audio.playing) { resume.current = true; audio.toggle(); }
    audio.setHeld(Boolean(audio.track));
    rec.current = r;
    setMode('listening');
    try { r.start(); } catch { rec.current = null; release(); setMode('idle'); }
  }, [value, onChange, audio, release]);

  // Avis parti : la carte revient au repos et affiche ce qui a été envoyé.
  useEffect(() => { setMode('idle'); setWriting(false); }, [sent]);

  // Minuterie d'écoute.
  useEffect(() => {
    if (mode !== 'listening') return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [mode]);

  // Échap arrête l'écoute ; quitter l'onglet aussi.
  useEffect(() => {
    if (mode !== 'listening') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, stop]);
  useEffect(() => () => { rec.current?.abort(); }, []);

  // Arrivée depuis la fin d'épisode (« Dis-le ») : l'écoute démarre aussitôt.
  const auto = useRef(autoListen);
  useEffect(() => {
    if (!auto.current || !supported) return;
    auto.current = false;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const canListen = supported && online;
  const isSent = Boolean(sent) && value.trim() === sent.trim() && !writing && mode !== 'review';
  const showArea = !isSent && mode !== 'listening' && (writing || mode === 'review' || mode === 'cut' || Boolean(value) || !canListen);

  const title =
    mode === 'listening' ? <>Je t&apos;écoute <time className="num">{mmss(secs)}</time></>
    : mode === 'review' ? 'Relis, puis envoie'
    : mode === 'denied' ? 'Micro bloqué'
    : mode === 'nothing' ? 'Rien entendu'
    : mode === 'cut' ? 'Coupure réseau'
    : <>Dis-le{isSent && <span className="pill sent">Envoyé</span>}</>;
  const hint =
    mode === 'listening' ? (audio.held ? 'L’épisode est en pause.' : 'Parle, puis touche Terminer.')
    : mode === 'review' ? 'Corrige au clavier si besoin.'
    : mode === 'denied' ? 'Autorise-le : cadenas de Chrome › Autorisations.'
    : mode === 'nothing' ? 'Parle après le signal, téléphone près de toi.'
    : mode === 'cut' ? 'J’ai gardé le début. Complète au clavier.'
    : !supported ? 'Écris ton ressenti, ou dicte avec le micro du clavier.'
    : !online ? 'Hors ligne : la dictée attend le réseau. Le micro du clavier marche, lui.'
    : isSent ? null
    : firstUse ? 'Chrome va demander le micro, une seule fois.'
    : 'Un ressenti sur l’épisode, à voix haute.';

  const mic = (label: string) => (
    <span className="mic-wrap">
      <button ref={micBtn} type="button" className="mic" aria-label={label} disabled={!canListen}
        onClick={mode === 'listening' ? stop : start}>
        <Icon name={mode === 'listening' ? 'stop' : 'mic'} size={mode === 'listening' ? 20 : 24} />
      </button>
      <span className="mic-glints" aria-hidden><i /><i /><i /><i /><i /></span>
    </span>
  );

  return (
    <section className={`say group${mode === 'listening' ? ' listening' : ''}`} aria-labelledby={`${uid}h`}>
      <div className="say-row">
        <span className="grow">
          <span className="say-title" id={`${uid}h`}>{title}</span>
          {hint && <span className={`say-hint${mode === 'denied' ? ' err' : ''}`}>{hint}</span>}
          {isSent && <span className="say-quote">« {sent} »</span>}
        </span>
        {mode !== 'listening' && !showArea && !isSent && (
          <button type="button" className="btn small ghost" onClick={() => { setWriting(true); setTimeout(() => area.current?.focus(), 30); }}>Écrire</button>
        )}
        {supported && !isSent && mode !== 'review' && mode !== 'cut' && (mode === 'listening' ? mic('Terminer') : !showArea || !canListen ? mic(mode === 'nothing' || mode === 'denied' ? 'Réessayer' : 'Dire mon avis') : null)}
      </div>

      {mode === 'listening' && (
        <>
          <p className="say-live" aria-hidden>
            {[base.current, finals].filter(Boolean).join(' ')} <span className="interim">{interim}</span><span className="caret" />
          </p>
          <p className="sr" role="status">Écoute en cours. Touche Terminer, ou Échap, quand tu as fini.</p>
        </>
      )}

      {isSent && (
        <div className="row say-sent">
          <button type="button" className="btn small ghost" onClick={() => { setWriting(true); setTimeout(() => area.current?.focus(), 30); }}>Modifier</button>
          {canListen && <button type="button" className="btn small ghost" onClick={start}><Icon name="mic" size={18} /> Compléter</button>}
        </div>
      )}

      {showArea && (
        <div className="say-body">
          <label htmlFor={`${uid}t`} className="sr">Ton ressenti sur l&apos;épisode</label>
          <textarea ref={area} id={`${uid}t`} value={value} maxLength={NOTE_MAX}
            onChange={e => onChange(e.target.value)}
            placeholder="Ex. : Hugo parle trop vite, finir par le foot." />
          <div className="row say-actions">
            {canListen && <button type="button" className="btn small ghost" onClick={start}><Icon name="mic" size={18} /> {value ? 'Ajouter' : 'Dicter'}</button>}
            {value && <button type="button" className="btn small ghost danger" onClick={() => { onChange(''); setMode('idle'); setWriting(false); setTimeout(() => micBtn.current?.focus(), 30); }}>Effacer</button>}
            <span className="count num">{value.length} / {NOTE_MAX}</span>
          </div>
          <p className="sr" role="status">{mode === 'review' ? 'Texte prêt, à relire.' : ''}</p>
        </div>
      )}
    </section>
  );
}
