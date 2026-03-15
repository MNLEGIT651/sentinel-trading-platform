'use client';

import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import type { StrategyFamily, StrategyProfile, ResearchStatus } from '@/lib/types';

const familyLabels: Array<{ id: StrategyFamily | 'all'; label: string }> = [
  { id: 'all', label: 'All sleeves' },
  { id: 'trend', label: 'Trend' },
  { id: 'value-momentum', label: 'Value + Momentum' },
  { id: 'mean-reversion', label: 'Mean Reversion' },
  { id: 'pairs', label: 'Pairs' },
  { id: 'allocation', label: 'Allocation' },
];

const statusLabels: Array<{ id: ResearchStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All states' },
  { id: 'paper-ready', label: 'Paper-ready' },
  { id: 'researching', label: 'Researching' },
  { id: 'blocked', label: 'Blocked' },
];

function matches(profile: StrategyProfile, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [profile.name, profile.family, profile.evidence, profile.failureMode, profile.controls]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function statusTone(status: ResearchStatus) {
  if (status === 'paper-ready') return 'tone-green';
  if (status === 'researching') return 'tone-amber';
  return 'tone-red';
}

export function StrategyLab({ profiles }: { profiles: StrategyProfile[] }) {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<StrategyFamily | 'all'>('all');
  const [status, setStatus] = useState<ResearchStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? '');
  const deferredQuery = useDeferredValue(query);

  const filtered = profiles.filter((profile) => {
    const familyOk = family === 'all' || profile.family === family;
    const statusOk = status === 'all' || profile.status === status;
    return familyOk && statusOk && matches(profile, deferredQuery);
  });

  const selected = filtered.find((profile) => profile.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selected && filtered[0]) {
      startTransition(() => setSelectedId(filtered[0].id));
    }
  }, [filtered, selected]);

  return (
    <section className="lab-shell reveal">
      <aside className="lab-controls">
        <div className="control-panel">
          <label className="field-label" htmlFor="strategy-query">
            Search the catalog
          </label>
          <input
            id="strategy-query"
            className="field-input"
            type="search"
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              startTransition(() => setQuery(nextValue));
            }}
            placeholder="Trend, value, cost model, holdout..."
          />
        </div>

        <div className="control-panel">
          <div className="field-label">Family</div>
          <div className="chip-row">
            {familyLabels.map((item) => (
              <button
                key={item.id}
                type="button"
                className={family === item.id ? 'chip chip-active' : 'chip'}
                onClick={() => {
                  startTransition(() => setFamily(item.id));
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-panel">
          <div className="field-label">Research state</div>
          <div className="chip-row">
            {statusLabels.map((item) => (
              <button
                key={item.id}
                type="button"
                className={status === item.id ? 'chip chip-active' : 'chip'}
                onClick={() => {
                  startTransition(() => setStatus(item.id));
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-panel control-panel-muted">
          <div className="field-label">Current slice</div>
          <p>{filtered.length} sleeves match the active filters.</p>
          <p>
            The selected record is always the strongest surviving candidate in the current slice.
          </p>
        </div>
      </aside>

      <div className="lab-main">
        <div className="catalog-grid">
          {filtered.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={
                selected?.id === profile.id ? 'catalog-card catalog-card-active' : 'catalog-card'
              }
              onClick={() => {
                startTransition(() => setSelectedId(profile.id));
              }}
            >
              <div className="catalog-meta">
                <span>{profile.family}</span>
                <span className={statusTone(profile.status)}>{profile.status}</span>
              </div>
              <h3>{profile.name}</h3>
              <p>{profile.evidence}</p>
              <div className="readiness-row">
                <span>Readiness</span>
                <strong>{profile.readiness}%</strong>
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <article className="detail-card">
            <div className="detail-header">
              <div>
                <div className="detail-kicker">{selected.family}</div>
                <h2>{selected.name}</h2>
              </div>
              <div className={`detail-status ${statusTone(selected.status)}`}>
                {selected.status}
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-block">
                <span className="detail-label">Why it belongs</span>
                <p>{selected.thesis}</p>
              </div>
              <div className="detail-block">
                <span className="detail-label">Data demands</span>
                <p>{selected.dataNeeds}</p>
              </div>
              <div className="detail-block">
                <span className="detail-label">Failure mode</span>
                <p>{selected.failureMode}</p>
              </div>
              <div className="detail-block">
                <span className="detail-label">Control surface</span>
                <p>{selected.controls}</p>
              </div>
              <div className="detail-block">
                <span className="detail-label">Capacity read</span>
                <p>{selected.capacity}</p>
              </div>
              <div className="detail-block">
                <span className="detail-label">Source anchors</span>
                <div className="tag-row">
                  {selected.sourceLabels.map((label) => (
                    <span key={label} className="tag">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ) : (
          <article className="detail-card detail-card-empty">
            <h2>No sleeves match the current filters.</h2>
            <p>Widen the query or relax the state filters to inspect another candidate.</p>
          </article>
        )}
      </div>
    </section>
  );
}
