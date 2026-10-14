// Squelette affiché instantanément pendant le chargement d'un onglet.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="sk" style={{ width: '45%', height: 30 }} />
      <div className="sk" style={{ width: '80%', height: 16, marginTop: 12 }} />
      <div className="sk" style={{ height: 180, marginTop: 24, borderRadius: 14 }} />
      <div className="sk" style={{ height: 120, marginTop: 16, borderRadius: 14 }} />
    </div>
  );
}
