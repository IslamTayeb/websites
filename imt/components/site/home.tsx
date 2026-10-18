import { Experience } from '@/components/site/experience';
import { Hero } from '@/components/site/hero';
import { JsonLd } from '@/components/site/json-ld';
import { Publications } from '@/components/site/publications';
import { WritingPreview } from '@/components/site/writing-preview';
import { RoybBand } from '@/components/primitives/royb-band';
import { buildPersonJsonLd } from '@/lib/seo';

export function Home() {
  return (
    <>
      <JsonLd data={buildPersonJsonLd()} />
      <RoybBand />
      <Hero />
      <Experience />
      <Publications />
      <WritingPreview />
    </>
  );
}
