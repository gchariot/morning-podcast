// Squelette affiché instantanément pendant le chargement d'un onglet : le ciel est déjà là.
const SKY = { '--sky-top': '#141a3a', '--sky-mid': '#2a2550', '--sky-horizon': '#4a3058', '--sun': 1.1, '--stars': 0.6, '--glints': 0 } as React.CSSProperties;

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="sky" style={SKY}>
        <div className="sky-stars" aria-hidden />
        <div className="sky-content">
          <div className="sk sk-sky" style={{ width: '55%', height: 30 }} />
          <div className="sk sk-sky" style={{ width: '80%', height: 16, marginTop: 12 }} />
        </div>
        <div className="sky-horizon" aria-hidden><span className="sky-sea" /></div>
      </div>
      <div className="sk" style={{ height: 180, borderRadius: 14 }} />
      <div className="sk" style={{ height: 120, marginTop: 16, borderRadius: 14 }} />
    </div>
  );
}
