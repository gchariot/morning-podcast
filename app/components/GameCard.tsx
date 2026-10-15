'use client';
/**
 * Le jeu du samedi : une question à la fois, au rythme de l'épisode.
 * Les bonnes réponses ne sont envoyées au téléphone qu'après validation (pas de triche possible).
 */
import { useState, useTransition } from 'react';
import { submitGame, type GameResult } from '@/app/(prive)/actions';
import { safeCall } from '@/lib/safe';

const LETTERS = ['A', 'B', 'C', 'D'];

type Q = { question: string; choices: string[] };

export function GameCard({ date, questions, played }: { date: string; questions: Q[]; played: GameResult | null }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<GameResult | null>(played);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const done = answers.every(a => a !== null);

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
        <div className="group" style={{ marginTop: 12 }}>
          {questions.map((q, i) => {
            const ok = result.answers![i] === result.correct![i];
            return (
              <div key={i} className="pad">
                <p className="small muted num">Question {i + 1}</p>
                <p style={{ fontWeight: 600, marginTop: 2 }}>{q.question}</p>
                <p className="small" style={{ marginTop: 6, color: ok ? 'var(--good)' : 'var(--bad)' }}>
                  {ok ? 'Bonne réponse : ' : `Ta réponse : ${LETTERS[result.answers![i]]}. ${q.choices[result.answers![i]]} · Bonne réponse : `}
                  <strong>{LETTERS[result.correct![i]]}. {q.choices[result.correct![i]]}</strong>
                </p>
                {result.explanations?.[i] && <p className="small muted" style={{ marginTop: 4 }}>{result.explanations[i]}</p>}
              </div>
            );
          })}
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
        <div className="game-dots" aria-hidden>
          {questions.map((_, i) => (
            <button key={i} type="button" tabIndex={-1} className={`game-dot${i === step ? ' on' : ''}${answers[i] !== null ? ' done' : ''}`} onClick={() => setStep(i)} />
          ))}
        </div>
        <p className="small muted num" style={{ marginTop: 12 }}>Question {step + 1} sur {questions.length}</p>
        <p style={{ fontWeight: 600, lineHeight: 1.45, marginTop: 2 }}>{q.question}</p>
        <div className="quiz-choices" role="radiogroup" aria-label={`Choix pour la question ${step + 1}`}>
          {q.choices.map((c, i) => (
            <button key={i} type="button" role="radio" aria-checked={answers[step] === i}
              className={`quiz-choice${answers[step] === i ? ' picked' : ''}`} onClick={() => pick(i)}>
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
        <p className="small" role="status" aria-live="polite" style={{ marginTop: 10, color: error ? 'var(--bad)' : 'var(--ink-2)' }}>
          {error ?? (done ? 'Tout est répondu : valide pour voir ton score (les réponses sont aussi à la fin de l’épisode).' : 'Réponds au fil de l’écoute ; les réponses sont données après le guide du week-end.')}
        </p>
      </div>
    </section>
  );
}
