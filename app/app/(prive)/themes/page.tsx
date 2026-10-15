import { loadConfig } from '@/lib/config';
import { ThemesEditor } from '@/components/ThemesEditor';
import { zurichMinutes } from '@/lib/sky';
import { NextWriting, SkyBand } from '@/components/Sky';

export default async function ThemesPage() {
  const { config } = await loadConfig();
  return (
    <>
      <SkyBand minutes={zurichMinutes()}>
        <h1>Thèmes</h1>
        <p className="sky-meta">Le conducteur de l&apos;épisode, dans l&apos;ordre. <NextWriting minutes={zurichMinutes()} /> : chaque changement compte dès demain.</p>
      </SkyBand>
      <ThemesEditor initial={config.rubriques} target={config.show.targetMinutes} />
    </>
  );
}
