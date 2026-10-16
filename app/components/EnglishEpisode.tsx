'use client';
/** L'épisode English du matin dans l'onglet English ; ?play le lance à l'arrivée (« On enchaîne ? » en fin de Matinale). */
import { useEffect, useRef } from 'react';
import { useAudio, type Track } from './Audio';
import { Player } from './Player';
import { Icon } from './Icon';

export function EnglishEpisode({ track, autoplay }: { track: Track; autoplay: boolean }) {
  const audio = useAudio();
  const started = useRef(false);
  useEffect(() => {
    if (!autoplay || started.current) return;
    started.current = true;
    audio.play(track);
    window.history.replaceState(null, '', '/english');
  }, [autoplay, audio, track]);
  return (
    <div className="en-ep-player">
      <Player track={track} endCard={
        <div className="ended" role="status">
          <span className="grow"><strong>Bien joué.</strong> Cet après-midi, rejoue la scène avec Nora.</span>
          <a href="#talk" className="btn small primary"><Icon name="mic" size={18} /> Nora</a>
        </div>
      } />
    </div>
  );
}
