import { PageIntro } from '@/components/shared/page-intro';
import { SourceLedger } from '@/components/shared/source-ledger';
import { sourceLedger } from '@/data/intelligence';

export default function SourcesPage() {
  const papers = sourceLedger.filter((record) => record.kind === 'paper');
  const official = sourceLedger.filter((record) => record.kind === 'official');
  const platforms = sourceLedger.filter((record) => record.kind === 'platform');
  const local = sourceLedger.filter(
    (record) => record.kind === 'blueprint' || record.kind === 'repo',
  );

  return (
    <>
      <PageIntro
        eyebrow="Sources"
        title="A source ledger is part of the product, not an appendix."
        summary="Codex keeps its beliefs inspectable. The point is not to overwhelm the user with citations. The point is to expose where the app's design constraints came from."
      />
      <SourceLedger title="Blueprint and repo intelligence" records={local} />
      <SourceLedger title="Research papers" records={papers} />
      <SourceLedger title="Official market and compliance references" records={official} />
      <SourceLedger title="Execution platform references" records={platforms} />
    </>
  );
}
