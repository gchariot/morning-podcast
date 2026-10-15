'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useAudio, type Track } from './Audio';

const hms = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

/** Commandes de l'épisode affiché. Le son lui-même vit dans <AudioProvider> et continue entre les onglets. */
export function Player({ track, feedbackSent = false }: { track: Track; feedbackSent?: boolean }) {
  const audio = useAudio();
  const { prepare, setShown } = audio;
  useEffect(() => { prepare(track); }, [prepare, track]);
  useEffect(() => { setShown(track.date); return () => setShown(null); }, [setShown, track.date]);
  const [allChapters, setAllChapters] = useState(false);

  const live = audio.track?.date === track.date;   // cet épisode est celui chargé dans le lecteur
  const now = live ? audio.now : 0;
  const duration = live ? audio.duration || track.seconds : track.seconds;
  const playing = live && audio.playing;
  const pct = duration ? Math.min(100, (now / duration) * 100) : 0;

  const toggle = () => (live ? audio.toggle() : audio.play(track));
  const seek = (sec: number) => (live ? audio.seek(sec) : audio.play(track, sec));
  const skip = (d: number) => (live ? audio.skip(d) : audio.play(track, Math.max(0, d)));
  const jump = (sec: number) => audio.play(track, sec);
  const started = live && (audio.playing || now > 1);
  const current = started ? track.chapters.reduce((idx, c, i) => (now >= c.startSec ? i : idx), 0) : -1;
  // Chapitres repliés : celui en cours et ses voisins ; tous sur demande.
  const anchor = Math.max(0, current);
  const from = Math.max(0, Math.min(anchor - 1, track.chapters.length - 3));
  const visible = allChapters || track.chapters.length <= 4
    ? track.chapters.map((c, i) => [c, i] as const)
    : track.chapters.slice(from, from + 3).map((c, i) => [c, from + i] as const);
  const finished = live && audio.ended;

  return (
    <>
      <div className="player">
        <input
          className="scrub" type="range" min={0} max={Math.max(1, Math.floor(duration))} step={1}
          value={Math.floor(now)} onChange={e => seek(Number(e.target.value))}
          aria-label="Position dans l'épisode" aria-valuetext={`${hms(now)} sur ${hms(duration)}`}
          style={{ ['--p' as string]: `${pct}%` }}
        />
        <div className="times">
          <time>{hms(now)}</time>
          {live && playing && audio.buffering && <span className="buffering" role="status">En attente du réseau…</span>}
          <time>−{hms(duration - now)}</time>
        </div>
        <div className="controls">
          <span />
          <button type="button" className="skip" onClick={() => skip(-15)} aria-label="Reculer de 15 secondes">
            <Icon name="back" size={30} /><span aria-hidden>15</span>
          </button>
          <button type="button" className="playbtn" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
            <Icon name={playing ? 'pause' : 'play'} size={26} />
          </button>
          <button type="button" className="skip" onClick={() => skip(30)} aria-label="Avancer de 30 secondes">
            <Icon name="forward" size={30} /><span aria-hidden>30</span>
          </button>
          <button type="button" className="rate" onClick={audio.nextRate} aria-label={`Vitesse ×${audio.rate}, changer`}>×{audio.rate}</button>
        </div>
        {live && audio.failed && !audio.playing && (
          <div className="ended err" role="alert">
            <span className="grow"><strong>L&apos;épisode n&apos;a pas pu se charger.</strong> {typeof navigator !== 'undefined' && !navigator.onLine ? 'Pas de réseau pour le moment.' : 'Vérifie le réseau.'}</span>
            <button type="button" className="btn small primary" onClick={() => audio.toggle()}>Réessayer</button>
          </div>
        )}
        {finished && (
          <div className="ended" role="status">
            {feedbackSent
              ? <><span className="grow"><strong>C&apos;est fini pour aujourd&apos;hui.</strong> Ton avis est déjà parti pour demain.</span>
                  <Link href="/avis" className="btn small">Modifier</Link></>
              : <><span className="grow"><strong>C&apos;est fini pour aujourd&apos;hui.</strong> Deux pouces et la rédaction ajuste demain.</span>
                  <Link href="/avis" className="btn small primary">Donner mon avis</Link></>}
          </div>
        )}
        {!live && audio.track && audio.playing && (
          <p className="field-hint" style={{ textAlign: 'center' }}>Un autre épisode est en cours : appuie sur lecture pour passer à celui-ci.</p>
        )}
      </div>

      {track.chapters.length > 0 && (
        <section className="section">
          <h2 className="sr">Chapitres</h2>
          <ul className="chapters group">
            {visible.map(([c, i]) => (
              <li key={c.title + c.startSec}>
                <button type="button" aria-current={i === current ? 'true' : undefined} onClick={() => jump(c.startSec)}>
                  <span className="dot" aria-hidden />
                  <span className="grow">{c.title}{/m[ée]t[ée]o/i.test(c.title) && <> <span className="voice zoe"><span className="voice-dot zoe" aria-hidden />Zoé</span></>}</span>
                  <time>{hms(c.startSec)}</time>
                </button>
              </li>
            ))}
            {track.chapters.length > 4 && (
              <li>
                <button type="button" className="chapters-more" onClick={() => setAllChapters(v => !v)} aria-expanded={allChapters}>
                  <span className="grow">{allChapters ? 'Replier les chapitres' : `Les ${track.chapters.length} chapitres`}</span>
                  <Icon name={allChapters ? 'chevron-up' : 'chevron-down'} size={18} />
                </button>
              </li>
            )}
          </ul>
        </section>
      )}
    </>
  );
}
