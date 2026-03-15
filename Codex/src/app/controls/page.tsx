import { PageIntro } from '@/components/shared/page-intro';
import { launchControls, operatingPrinciples } from '@/data/intelligence';

const deploymentFlow = [
  'Freeze the universe and version the rules for inclusion, delistings, and adjustments.',
  'Capture as-of datasets with separate observation, availability, and trade timestamps.',
  'Run walk-forward research with holdout discipline and search-width tracking.',
  'Attach spread, impact, and missed-fill assumptions before ranking any sleeve.',
  'Use paper trading as a review stage, not as automatic permission for live routing.',
  'Enable live broker paths only after execution review and governance sign-off.',
];

export default function ControlsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Control Room"
        title="Launch gates, execution rules, and deployment doctrine."
        summary="This route makes the hardest product truth explicit: the best-looking strategy is not the one that deserves to trade. The one with the strongest evidence and control surface does."
      />

      <section className="section-block reveal">
        <div className="section-header">
          <h2>Gate ledger</h2>
          <p>
            Each gate names an owner because good control systems are operational, not abstract.
          </p>
        </div>

        <div className="ledger-grid">
          {launchControls.map((control) => (
            <article key={control.id} className={`ledger-card tone-${control.status}`}>
              <div className="ledger-topline">
                <span>{control.owner}</span>
                <span>{control.status}</span>
              </div>
              <h3>{control.title}</h3>
              <p>{control.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block reveal">
        <div className="section-header">
          <h2>Deployment path</h2>
          <p>
            This is the sequence the app is built to enforce. It reflects the blueprint, not a
            broker demo.
          </p>
        </div>

        <div className="timeline-stack">
          {deploymentFlow.map((item, index) => (
            <article key={item} className="timeline-card">
              <div className="timeline-badge">{String(index + 1).padStart(2, '0')}</div>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block reveal">
        <div className="section-header">
          <h2>Operating constraints</h2>
          <p>These principles stay pinned even when a backtest looks tempting.</p>
        </div>

        <div className="artifact-grid">
          {operatingPrinciples.map((principle) => (
            <article key={principle} className="artifact-card">
              <div className="artifact-state">Constraint</div>
              <p>{principle}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
