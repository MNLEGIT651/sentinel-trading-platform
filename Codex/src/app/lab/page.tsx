import { StrategyLab } from '@/components/lab/strategy-lab';
import { PageIntro } from '@/components/shared/page-intro';
import { strategyProfiles } from '@/data/intelligence';

export default function LabPage() {
  return (
    <>
      <PageIntro
        eyebrow="Strategy Lab"
        title="Filter the sleeve catalog by readiness, family, and signal quality."
        summary="This route is where the product stops behaving like a generic dashboard and starts acting like a research workstation. Every sleeve carries evidence, data needs, failure modes, and control language."
      />
      <StrategyLab profiles={strategyProfiles} />
    </>
  );
}
