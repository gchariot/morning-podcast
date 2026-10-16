import { loadConfig } from '@/lib/config';
import { ThemesEditor } from '@/components/ThemesEditor';
import { zurichMinutes } from '@/lib/sky';
import { NextWriting, SkyBand } from '@/components/Sky';
import { nextWeekdayEpisode } from '@/lib/jours';

export default async function ThemesPage() {
  const { config } = await loadConfig();
  return (
    <>
      <SkyBand minutes={zurichMinutes()}>
        <h1>Thèmes</h1>
        <p className="sky-meta">Le conducteur de l&apos;épisode. <NextWriting minutes={zurichMinutes()} />.</p>
      </SkyBand>
      <ThemesEditor initial={config.rubriques} ordre={config.ordreParJour} target={config.show.targetMinutes} defaultDay={nextWeekdayEpisode()} />
    </>
  );
}
