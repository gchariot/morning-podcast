'use client';
/**
 * Le jeu du samedi : une question à la fois, au rythme de l'épisode.
 * Les bonnes réponses ne sont envoyées au téléphone qu'après validation (pas de triche possible).
 */
import { useEffect, useState, useTransition } from 'react';
import { submitGame, type GameResult } from '@/app/(prive)/actions';
import { OFFLINE, fr, radioKeys, rovingTab, safeCall } from '@/lib/safe';
import { useOnline } from './Connectivity';
import { Icon } from './Icon';

const LETTERS = ['A', 'B', 'C', 'D'];

type Q = { question: string; choices: string[] };

export function GameCard({ date, questions, played }: { date: string; questions: Q[]; played: GameResult | null }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<GameResult | null>(played);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = answers.every(a => a !== null);
  const online = useOnline();
  const shownError = error && !(online && error === OFFLINE) ? error : null;

  // Réponses gardées sur le téléphone : on joue au fil de l'écoute, en changeant d'onglet.
  const key = `matinale_jeu_${date}`;
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(key) ?? 'null') as { answers: (number | null)[]; step: number } | null;
      if (d && d.answers.length === questions.length) { setAnswers(d.answers); setStep(Math.min(d.step, questions.length - 1)); }
    } catch { /* stockage indisponible */ }
  }, [key, questions.length]);
  useEffect(() => {
    try {
      if (result) localStorage.removeItem(key);
      else if (answers.some(a => a !== null)) localStorage.setItem(key, JSON.stringify({ answers, step }));
    } catch { /* ignoré */ }
  }, [key, answers, step, result]);

  const pick = (i: number) => {
    const next = [...answers];
    next[step] = i;
    setAnswers(next);
    if (step < questions.length - 1) setTimeout(() => setStep(s => Math.min(s + 1, questions.length - 1)), 220);
  };

  const validate = () => start(async () => {
    setError(null);
    const res = await safeCall(() => submitGame(date, answers as number[]));
    if (res.ok) setResult(res); else setError(res.message);
  });

  // Correction
  if (result?.answers && result.correct) {
    const score = result.answers.filter((a, i) => a === result.correct![i]).length;
    return (
      <section className="section">
        <div className="spread" style={{ alignItems: 'baseline' }}>
          <h2>Le jeu de la semaine</h2>
          <strong className="num" style={{ color: score >= 6 ? 'var(--good)' : score >= 4 ? 'var(--ink)' : 'var(--bad)' }}>{score}/{questions.length}</strong>
        </div>
        <p className="small game-summary">
          {score === questions.length ? 'Sans faute, chapeau !' : score >= 6 ? 'Très belle semaine.' : score >= 4 ? 'Pas mal du tout.' : 'Semaine difficile, revanche samedi prochain.'}
          {score < questions.length ? ` Voici ${questions.length - score === 1 ? 'la question ratée' : `les ${questions.length - score} questions ratées`}.` : ''}
        </p>
        <div className="group" style={{ marginTop: 12 }}>
          {questions.map((q, i) => {
            const ok = result.answers![i] === result.correct![i];
            if (ok) return null; // les bonnes réponses sont regroupées plus bas
            return (
              <div key={i} className="pad">
                <p className="small muted num">Question {i + 1}</p>
                <p style={{ fontWeight: 600, marginTop: 2 }}>{q.question}</p>
                <p className="small" style={{ marginTop: 6, color: 'var(--bad)' }}>
                  Ta réponse : {LETTERS[result.answers![i]]}. {q.choices[result.answers![i]]} · Bonne réponse : <strong>{LETTERS[result.correct![i]]}. {q.choices[result.correct![i]]}</strong>
                </p>
                {result.explanations?.[i] && <p className="small muted" style={{ marginTop: 4 }}>{result.explanations[i]}</p>}
              </div>
            );
          })}
          {score > 0 && (
            <details>
              <summary className="item"><span className="grow">{score} bonne{score > 1 ? 's' : ''} réponse{score > 1 ? 's' : ''}</span><Icon name="chevron-right" className="chev" /></summary>
              {questions.map((q, i) => result.answers![i] === result.correct![i] && (
                <p key={i} className="game-hits"><span className="num">{i + 1}.</span> {q.question} <strong style={{ color: 'var(--good)' }}>{LETTERS[result.correct![i]]}. {q.choices[result.correct![i]]}</strong></p>
              ))}
            </details>
          )}
        </div>
      </section>
    );
  }

  const q = questions[step];
  return (
    <section className="section">
      <div className="spread" style={{ alignItems: 'baseline' }}>
        <h2>Le jeu de la semaine</h2>
        <span className="small muted num">{answers.filter(a => a !== null).length}/{questions.length} répondues</span>
      </div>
      <div className="group pad quiz-card" style={{ marginTop: 12 }}>
        <div className="game-dots" role="group" aria-label="Aller à une question">
          {questions.map((_, i) => (
            <button key={i} type="button" className={`game-dot${i === step ? ' on' : ''}${answers[i] !== null ? ' done' : ''}`} onClick={() => setStep(i)}
              aria-label={`Question ${i + 1}${answers[i] !== null ? ', répondue' : ''}`} aria-current={i === step ? 'step' : undefined} />
          ))}
        </div>
        <p className="small muted num" style={{ marginTop: 12 }}>Question {step + 1} sur {questions.length}</p>
        <p style={{ fontWeight: 600, lineHeight: 1.45, marginTop: 2 }}>{fr(q.question)}</p>
        <div className="quiz-choices" role="radiogroup" aria-label={`Choix pour la question ${step + 1}`}>
          {q.choices.map((c, i) => (
            <button key={i} type="button" role="radio" aria-checked={answers[step] === i}
              className={`quiz-choice${answers[step] === i ? ' picked' : ''}`} onClick={() => pick(i)} onKeyDown={radioKeys} tabIndex={rovingTab(answers[step], i)}>
              <span className="quiz-letter" aria-hidden>{LETTERS[i]}</span>
              <span className="grow">{c}</span>
            </button>
          ))}
        </div>
        <div className="spread" style={{ marginTop: 14 }}>
          <button type="button" className="btn small" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Précédente</button>
          {step < questions.length - 1
            ? <button type="button" className="btn small" onClick={() => setStep(s => s + 1)}>Suivante</button>
            : <button type="button" className="btn small primary" disabled={!done || pending} aria-busy={pending} onClick={validate}>
                {pending ? 'Correction…' : 'Valider mes réponses'}
              </button>}
        </div>
        <p className="small" role="status" aria-live="polite" style={{ marginTop: 10, color: shownError ? 'var(--bad)' : 'var(--ink-2)' }}>
          {shownError ?? (done ? 'Tout est répondu : valide pour voir ton score (les réponses sont aussi à la fin de l’épisode).' : 'Réponds au fil de l’écoute ; les réponses sont données après le guide du week-end.')}
        </p>
      </div>
    </section>
  );
}
