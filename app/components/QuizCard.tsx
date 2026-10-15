'use client';
/** Quiz de l'épisode : on répond dans l'appli, la réponse est donnée le lendemain dans la Matinale. */
import { useState, useTransition } from 'react';
import { answerQuiz } from '@/app/(prive)/actions';
import { safeCall } from '@/lib/safe';

const LETTERS = ['A', 'B', 'C', 'D'];

type Props = {
  date: string;
  question: string;
  choices: string[];
  myChoice: number | null;
  /** Heure d'enregistrement de la réponse (ISO), pour la confirmer clairement. */
  savedAt?: string;
  /** Présents seulement une fois la réponse révélée (pas de spoiler dans la page avant). */
  answer?: number;
  explanation?: string;
  stats: { correct: number; answered: number; streak: number };
};

export function QuizCard({ date, question, choices, myChoice, savedAt: savedAtInit, answer, explanation, stats }: Props) {
  const [choice, setChoice] = useState<number | null>(myChoice);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [savedAt, setSavedAt] = useState<string | undefined>(savedAtInit);
  const [pending, start] = useTransition();
  const revealed = answer !== undefined;

  const pick = (i: number) => {
    if (revealed || pending) return;
    const before = choice;
    setChoice(i);
    setMsg(null);
    start(async () => {
      const res = await safeCall(() => answerQuiz(date, i));
      setMsg(res);
      if (!res.ok) setChoice(before); else setSavedAt(new Date().toISOString());
    });
  };

  const state = (i: number) => {
    if (!revealed) return choice === i ? 'picked' : '';
    if (i === answer) return 'right';
    if (i === choice) return 'wrong';
    return 'dim';
  };

  const hhmm = (iso?: string) => (iso ? new Intl.DateTimeFormat('fr-CH', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Zurich' }).format(new Date(iso)).replace(':', ' h ') : '');
  const saved = !revealed && choice !== null && !pending && !(msg && !msg.ok);
  let verdict: string;
  if (!revealed) verdict = choice === null ? 'Réponds ici : la réponse sera donnée demain matin dans la Matinale.' : 'Tu peux encore changer d’avis jusqu’à demain matin.';
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
              {saved && choice === i && (
                <span className="saved-pill">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                  Enregistrée
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="small" role="status" aria-live="polite" style={{ marginTop: 12, color: msg && !msg.ok ? 'var(--bad)' : revealed && choice !== null ? (choice === answer ? 'var(--good)' : 'var(--bad)') : 'var(--ink-2)' }}>
          {pending ? 'Enregistrement…' : msg && !msg.ok ? msg.message : saved
            ? <><strong style={{ color: 'var(--good)' }}>Réponse {LETTERS[choice!]} enregistrée{savedAt ? ` à ${hhmm(savedAt)}` : ''}.</strong> {verdict}</>
            : verdict}
        </p>
        {revealed && explanation && <p className="small muted" style={{ marginTop: 6 }}>{explanation}</p>}
      </div>
    </section>
  );
}
