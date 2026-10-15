'use client';
/** Dernier filet : même la mise en page n'a pas pu se charger. */
const CSS = `
  body { font-family: system-ui, sans-serif; padding: 18vh 24px; max-width: 420px; margin: 0 auto; background: #f1eff5; color: #17162a; }
  p { color: #57536b; line-height: 1.5; }
  button { margin-top: 16px; font: inherit; font-weight: 600; padding: 12px 18px; min-height: 44px; border-radius: 12px; border: 0; background: #141a3a; color: #ffd796; cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    body { background: #0e1124; color: #f3f0f7; }
    p { color: #b9b4c9; }
    button { background: #ffd796; color: #141a3a; }
  }
`;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body>
        <style>{CSS}</style>
        <h1 style={{ fontSize: 24 }}>La Matinale n&apos;a pas pu s&apos;ouvrir</h1>
        <p>Vérifie le réseau, puis réessaie.</p>
        <button type="button" onClick={() => reset()}>Réessayer</button>
      </body>
    </html>
  );
}
