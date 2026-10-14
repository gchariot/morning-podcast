'use client';
import { useEffect } from 'react';
import { Icon } from './Icon';
import { useAudio, type Track } from './Audio';

const hms = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

/** Commandes de l'épisode affiché. Le son lui-même vit dans <AudioProvider> et continue entre les onglets. */
export function Player({ track }: { track: Track }) {
  const audio = useAudio();
  const { prepare } = audio;
  useEffect(() => { prepare(track); }, [prepare, track]);

  const live = audio.track?.date === track.date;   // cet épisode est celui chargé dans le lecteur
  const now = live ? audio.now : 0;
  const duration = live ? audio.duration || track.seconds : track.seconds;
  const playing = live && audio.playing;
  const pct = duration ? Math.min(100, (now / duration) * 100) : 0;

  const toggle = () => (live ? audio.toggle() : audio.play(track));
  const seek = (sec: number) => (live ? audio.seek(sec) : audio.play(track, sec));
  const skip = (d: number) => (live ? audio.skip(d) : audio.play(track, Math.max(0, d)));
  const jump = (sec: number) => audio.play(track, sec);
  const current = track.chapters.reduce((idx, c, i) => (now >= c.startSec ? i : idx), 0);

  return (
    <>
      <div className="player">
        <input
          className="scrub" type="range" min={0} max={Math.max(1, Math.floor(duration))} step={1}
          value={Math.floor(now)} onChange={e => seek(Number(e.target.value))}
          aria-label="Position dans l'épisode" aria-valuetext={`${hms(now)} sur ${hms(duration)}`}
          style={{ ['--p' as string]: `${pct}%` }}
        />
        <div className="times"><time>{hms(now)}</time><time>−{hms(duration - now)}</time></div>
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
        {!live && audio.track && audio.playing && (
          <p className="field-hint" style={{ textAlign: 'center' }}>Un autre épisode est en cours : appuie sur lecture pour passer à celui-ci.</p>
        )}
      </div>

      {track.chapters.length > 0 && (
        <section className="section">
          <h2>Chapitres</h2>
          <ul className="chapters group" style={{ marginTop: 12 }}>
            {track.chapters.map((c, i) => (
              <li key={c.title + c.startSec}>
                <button type="button" aria-current={live && i === current ? 'true' : undefined} onClick={() => jump(c.startSec)}>
                  <span className="dot" aria-hidden />
                  <span className="grow">{c.title}</span>
                  <time>{hms(c.startSec)}</time>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
