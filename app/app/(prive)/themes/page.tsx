import { loadConfig } from '@/lib/config';
import { ThemesEditor } from '@/components/ThemesEditor';

export default async function ThemesPage() {
  const { config } = await loadConfig();
  return (
    <>
      <header className="page-head">
        <h1>Thèmes</h1>
        <p>Le conducteur de l&apos;épisode, dans l&apos;ordre. Chaque changement vaut dès l&apos;édition de demain.</p>
      </header>
      <ThemesEditor initial={config.rubriques} target={config.show.targetMinutes} />
    </>
  );
}
