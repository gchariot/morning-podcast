'use client';
/** Quiz de l'épisode : on répond dans l'appli, la réponse est donnée le lendemain dans la Matinale. */
import { useState, useTransition } from 'react';
import { answerQuiz } from '@/app/(prive)/actions';

const LETTERS = ['A', 'B', 'C', 'D'];

type Props = {
  date: string;
  question: string;
  choices: string[];
  myChoice: number | null;
  /** Présents seulement une fois la réponse révélée (pas de spoiler dans la page avant). */
  answer?: number;
  explanation?: string;
  stats: { correct: number; answered: number; streak: number };
};

export function QuizCard({ date, question, choices, myChoice, answer, explanation, stats }: Props) {
  const [choice, setChoice] = useState<number | null>(myChoice);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const revealed = answer !== undefined;

  const pick = (i: number) => {
    if (revealed || pending) return;
    const before = choice;
    setChoice(i);
    setMsg(null);
    start(async () => {
      const res = await answerQuiz(date, i);
      setMsg(res);
      if (!res.ok) setChoice(before);
    });
  };

  const state = (i: number) => {
    if (!revealed) return choice === i ? 'picked' : '';
    if (i === answer) return 'right';
    if (i === choice) return 'wrong';
    return 'dim';
  };

  let verdict: string;
  if (!revealed) verdict = choice === null ? 'Réponds ici : la réponse sera donnée demain matin dans la Matinale.' : 'Réponse enregistrée. Tu peux encore changer d’avis jusqu’à demain matin.';
  else if (choice === null) verdict = 'Tu n’avais pas répondu.';
  else verdict = choice === answer ? 'Bonne réponse, bravo !' : `Raté : c’était ${LETTERS[answer!]}.`;

  return (
    <section className="section">
      <div className="spread" style={{ alignItems: 'baseline' }}>
        <h2>Le quiz</h2>
        {stats.answered > 0 && (
          <span className="small muted num">
            {stats.correct}/{stats.answered} bonnes réponses{stats.streak >= 2 ? ` · série de ${stats.streak}` : ''}
          </span>
        )}
      </div>
      <div className="group pad quiz-card" style={{ marginTop: 12 }}>
        <p style={{ fontWeight: 600, lineHeight: 1.45 }}>{question}</p>
        <div className="quiz-choices" role="radiogroup" aria-label="Choix de réponse">
          {choices.map((c, i) => (
            <button
              key={i} type="button" role="radio" aria-checked={choice === i}
              className={`quiz-choice ${state(i)}`} disabled={revealed} onClick={() => pick(i)}
            >
              <span className="quiz-letter" aria-hidden>{LETTERS[i]}</span>
              <span className="grow">{c}</span>
            </button>
          ))}
        </div>
        <p className="small" role="status" aria-live="polite" style={{ marginTop: 12, color: msg && !msg.ok ? 'var(--bad)' : revealed && choice !== null ? (choice === answer ? 'var(--good)' : 'var(--bad)') : 'var(--ink-2)' }}>
          {pending ? 'Enregistrement…' : msg && !msg.ok ? msg.message : verdict}
        </p>
        {revealed && explanation && <p className="small muted" style={{ marginTop: 6 }}>{explanation}</p>}
      </div>
    </section>
  );
}
