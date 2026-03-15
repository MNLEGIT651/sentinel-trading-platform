import Link from 'next/link';
import { PageIntro } from '@/components/shared/page-intro';
import {
  launchControls,
  operatingPrinciples,
  overviewStats,
  repoArtifacts,
  strategyProfiles,
} from '@/data/intelligence';

export default function OverviewPage() {
  const topSleeves = [...strategyProfiles]
    .sort((left, right) => right.readiness - left.readiness)
    .slice(0, 3);

  return (
    <>
      <PageIntro
        eyebrow="Overview"
        title="A serious trading app starts as a research operating system."
        summary="Codex reframes the original project around evidence quality, strategy sleeves, risk controls, and staged execution. The interface is opinionated because the blueprint is opinionated."
      />

      <section className="hero-grid reveal">
        <article className="hero-card hero-card-primary">
          <span className="eyebrow">Operating thesis</span>
          <h2>Build the evidence ledger before the broker button.</h2>
          <p>
            Claude&apos;s repo proves there is enough ambition in the system. This version adds the
            missing product discipline: as-of data, holdout awareness, cost realism, readiness
            scoring, and explicit launch gates.
          </p>
          <div className="action-row">
            <Link href="/lab" className="button-primary">
              Open strategy lab
            </Link>
            <Link href="/controls" className="button-secondary">
              Inspect control room
            </Link>
          </div>
        </article>

        <article className="hero-card hero-card-secondary">
          <span className="eyebrow">Doctrine</span>
          <div className="doctrine-list">
            {operatingPrinciples.map((principle) => (
              <div key={principle} className="doctrine-item">
                <span className="doctrine-mark">01</span>
                <p>{principle}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="section-block reveal">
        <div className="section-header">
          <h2>Current operating view</h2>
          <p>These are live design metrics for the clean-room app, not marketing counters.</p>
        </div>

        <div className="stats-grid">
          {overviewStats.map((stat) => (
            <article key={stat.label} className="stat-card">
              <span className="stat-label">{stat.label}</span>
              <strong className="stat-value">{stat.value}</strong>
              <p>{stat.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block reveal">
        <div className="section-header">
          <h2>What the original repo already proves</h2>
          <p>
            The goal is not to dismiss the Sentinel work. The goal is to absorb the good parts and
            then be stricter about product truth.
          </p>
        </div>

        <div className="artifact-grid">
          {repoArtifacts.map((artifact) => (
            <article key={artifact.title} className="artifact-card">
              <div className="artifact-state">{artifact.state}</div>
              <h3>{artifact.title}</h3>
              <p>{artifact.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block reveal">
        <div className="section-header">
          <h2>Highest-readiness sleeves</h2>
          <p>
            The app keeps the strongest candidates visible while still forcing the user to read why
            a sleeve can fail.
          </p>
        </div>

        <div className="sleeve-grid">
          {topSleeves.map((profile) => (
            <article key={profile.id} className="sleeve-card">
              <div className="sleeve-meta">
                <span>{profile.family}</span>
                <span>{profile.status}</span>
              </div>
              <h3>{profile.name}</h3>
              <p>{profile.evidence}</p>
              <div className="metric-inline">
                <span>Readiness</span>
                <strong>{profile.readiness}%</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block reveal">
        <div className="section-header">
          <h2>Control pressure</h2>
          <p>
            The fastest way to degrade the app is to hide blocked controls. Codex does the opposite.
          </p>
        </div>

        <div className="control-strip">
          {launchControls.map((control) => (
            <article key={control.id} className={`control-strip-card tone-${control.status}`}>
              <span className="control-owner">{control.owner}</span>
              <h3>{control.title}</h3>
              <p>{control.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
