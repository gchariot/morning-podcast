'use client';
/** Dernier filet : même la mise en page n'a pas pu se charger. */
const CSS = `
  body { font-family: system-ui, sans-serif; padding: 18vh 24px; max-width: 420px; margin: 0 auto; background: #f4f3f0; color: #1b1a17; }
  p { color: #5f5c55; line-height: 1.5; }
  button { margin-top: 16px; font: inherit; font-weight: 600; padding: 12px 18px; min-height: 44px; border-radius: 12px; border: 0; background: #c2410c; color: #fff; cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    body { background: #121110; color: #f3f1ec; }
    p { color: #b5b0a6; }
    button { background: #fb8a4e; color: #1f0d03; }
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
