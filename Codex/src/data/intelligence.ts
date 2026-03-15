import type { LaunchControl, RepoArtifact, SourceRecord, StrategyProfile } from '@/lib/types';

export const strategyProfiles: StrategyProfile[] = [
  {
    id: 'trend-stack',
    name: 'Trend Stack',
    family: 'trend',
    horizon: 'Weeks to months',
    status: 'paper-ready',
    readiness: 74,
    evidence:
      'Time-series momentum remains one of the strongest cross-asset research anchors when it is diversified and volatility-managed.',
    thesis:
      'Use multi-horizon trend signals to capture persistence without pretending any single lookback is stable forever.',
    dataNeeds:
      'Survivorship-aware prices, broad universe coverage, volatility estimates, turnover history.',
    failureMode: 'Sideways chop, crowding, late-stage reversals after strong crisis trends.',
    controls: 'Blend 1/3/12 month views, target volatility, and cap concentration by sleeve.',
    capacity: 'High if implemented on liquid ETFs/futures proxies.',
    sourceLabels: ['Time Series Momentum', 'Blueprint PDF'],
  },
  {
    id: 'value-momentum-core',
    name: 'Value + Momentum Core',
    family: 'value-momentum',
    horizon: 'Months',
    status: 'researching',
    readiness: 61,
    evidence:
      'Value and momentum diversify each other well because their drawdowns do not usually line up.',
    thesis:
      'Rank cheap assets with improving trend separately, then combine signals at the portfolio level instead of forcing one blended score too early.',
    dataNeeds:
      'As-of fundamentals, filing timestamps, sector groupings, prices, borrow assumptions for shorts.',
    failureMode: 'Value traps, momentum crashes, signal decay after publication or crowding.',
    controls: 'Separate signal and execution dates, sector-neutral checks, and holdout tracking.',
    capacity: 'Medium to high in liquid equity and ETF universes.',
    sourceLabels: ['Value and Momentum Everywhere', 'SEC EDGAR', 'Blueprint PDF'],
  },
  {
    id: 'micro-reversion',
    name: 'Micro Reversion',
    family: 'mean-reversion',
    horizon: 'Days to weeks',
    status: 'blocked',
    readiness: 28,
    evidence:
      'Short-horizon reversal signals can exist, but they are highly vulnerable to spread, impact, and crowded exits.',
    thesis: 'Treat this as a cost-engine project first and a signal project second.',
    dataNeeds: 'High-quality timestamps, spread estimates, fee schedule, liquidity bucket tagging.',
    failureMode: 'Bid-ask bounce, apparent alpha destroyed by reactive stop logic and slippage.',
    controls: 'Hard turnover budgets, spread-aware fills, and stress tests on liquidity shocks.',
    capacity: 'Low unless the cost model is exceptionally honest.',
    sourceLabels: ['Probability of Backtest Overfitting', 'FINRA Rule 5310', 'Blueprint PDF'],
  },
  {
    id: 'pairs-residual',
    name: 'Pairs and Residuals',
    family: 'pairs',
    horizon: 'Days to months',
    status: 'researching',
    readiness: 47,
    evidence:
      'Relative-value trades can work when relationship stability is strong, but structural breaks dominate the tail risk.',
    thesis:
      'Model spread behavior and unwind logic explicitly instead of treating pair selection as static.',
    dataNeeds:
      'Clean pair histories, borrow assumptions, event flags, beta or residual estimation.',
    failureMode: 'Broken relationships, merger noise, crowding into the same unwind path.',
    controls:
      'Pair diversification, event blacklist, rolling stability checks, and shrinkage on sizing.',
    capacity: 'Medium in large-cap or ETF pairs, low elsewhere.',
    sourceLabels: ['Blueprint PDF'],
  },
  {
    id: 'allocation-engine',
    name: 'Allocation Engine',
    family: 'allocation',
    horizon: 'Portfolio layer',
    status: 'researching',
    readiness: 55,
    evidence:
      'The blueprint is clear that diversified return sources only become durable when risk concentration is actively managed.',
    thesis:
      'Allocate to sleeves by risk contribution and readiness, not by whatever strategy had the best recent backtest.',
    dataNeeds:
      'Sleeve-level returns, drawdown paths, turnover, correlation matrix, cost snapshots.',
    failureMode: 'One hidden beta bet dominating the whole stack.',
    controls: 'Risk budgets, drawdown clamps, volatility targeting, and sleeve shutoff rules.',
    capacity: 'Portfolio-level control layer rather than a direct capacity constraint.',
    sourceLabels: ['Blueprint PDF', 'Value and Momentum Everywhere'],
  },
];

export const repoArtifacts: RepoArtifact[] = [
  {
    title: 'Sentinel UI shell',
    state: 'Prototype',
    detail:
      'Claude built a serious dashboard shell with charting, alerts, realtime scaffolding, and multi-page navigation, but most visible market data is still mocked.',
  },
  {
    title: 'Engine and schema',
    state: 'Foundation',
    detail:
      'The FastAPI and Supabase layers are the strongest part of the original repo: ingestion, broker interfaces, paper broker, migrations, indexes, and seeded strategy definitions.',
  },
  {
    title: 'Strategy worktree',
    state: 'In progress',
    detail:
      'The current worktree adds a local strategy package and `/strategies` route, but it is not yet tied into backtesting, persistence, risk overlays, or tests.',
  },
  {
    title: 'Research gap',
    state: 'Critical',
    detail:
      'The PDF argues for as-of data, multiple-testing controls, execution shortfall, and staged deployment. Those remain the least-finished part of the product.',
  },
];

export const launchControls: LaunchControl[] = [
  {
    id: 'as-of-data',
    title: 'As-of data snapshots',
    status: 'amber',
    owner: 'Data engineering',
    detail:
      'Observation date, availability date, and trade date need to be separate fields before any strategy graduates.',
  },
  {
    id: 'cost-engine',
    title: 'Transaction cost engine',
    status: 'red',
    owner: 'Execution research',
    detail:
      'Spread, impact, and missed fills must be attached to the strategy definition, not added at the presentation layer.',
  },
  {
    id: 'holdout-governance',
    title: 'Holdout governance',
    status: 'amber',
    owner: 'Research ops',
    detail:
      'The app needs visible tracking of search breadth, holdout reuse, and stress-window coverage.',
  },
  {
    id: 'paper-review',
    title: 'Paper trade review loop',
    status: 'green',
    owner: 'Portfolio lead',
    detail:
      'Paper trading is available as a gate, but it needs explicit review criteria before a broker is ever enabled.',
  },
  {
    id: 'best-execution',
    title: 'Best-execution review',
    status: 'amber',
    owner: 'Execution compliance',
    detail:
      'Routing quality and fill review belong in the interface because live deployment inherits FINRA best-execution expectations.',
  },
  {
    id: 'live-routing',
    title: 'Live routing enablement',
    status: 'red',
    owner: 'Release management',
    detail: 'No live routing until the research, cost, and review gates are all explicitly green.',
  },
];

export const operatingPrinciples = [
  'A strategy is not production-ready because it looks good in a chart.',
  'Every signal must carry its data lineage, validation posture, and cost assumptions.',
  'Portfolio construction should shut off fragile sleeves before they contaminate the whole stack.',
  'Execution quality belongs in product scope as soon as paper fills start to matter.',
];

export const sourceLedger: SourceRecord[] = [
  {
    label: 'Building a Robust, Evidence-Based Trading Strategy Blueprint for Public Markets',
    kind: 'blueprint',
    note: 'Local PDF that drove the original repo and this app. Core message: robust process beats miracle strategy claims.',
    dateContext: 'Local attachment reviewed on 2026-03-14',
  },
  {
    label: 'Value and Momentum Everywhere',
    kind: 'paper',
    href: 'https://www.aqr.com/Insights/Research/Journal-Article/Value-and-Momentum-Everywhere',
    note: 'Best source for the product choice to compare sleeves and combine differentiated return streams.',
  },
  {
    label: 'Time Series Momentum',
    kind: 'paper',
    href: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1789463',
    note: 'Anchor reference for the trend sleeve and for cross-asset diversification logic.',
  },
  {
    label: 'Probability of Backtest Overfitting',
    kind: 'paper',
    href: 'https://www.davidhbailey.com/dhbpapers/probability.pdf',
    note: 'Justifies putting holdout discipline and search-width visibility directly into the UI.',
  },
  {
    label: 'SEC EDGAR',
    kind: 'official',
    href: 'https://www.sec.gov/submit-filings/about-edgar',
    note: 'Official filings source for timestamped fundamentals and disclosure-aware data lineage.',
  },
  {
    label: 'CFTC Commitments of Traders',
    kind: 'official',
    href: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm',
    note: 'Official positioning dataset better suited to slow state variables than precision timing.',
  },
  {
    label: 'FINRA Rule 5310',
    kind: 'official',
    href: 'https://www.finra.org/rules-guidance/rulebooks/finra-rules/5310',
    note: 'Defines why execution review becomes governance once the app gets near live routing.',
  },
  {
    label: 'Alpaca Paper Trading',
    kind: 'platform',
    href: 'https://docs.alpaca.markets/docs/paper-trading',
    note: 'Shows staging infrastructure is available, but does not remove the need for research discipline.',
    dateContext: 'Confirmed against current docs on 2026-03-14',
  },
  {
    label: 'Alpaca Market Data',
    kind: 'platform',
    href: 'https://docs.alpaca.markets/docs/market-data-1',
    note: 'Useful future integration path after the research operating system is solid.',
    dateContext: 'Confirmed against current docs on 2026-03-14',
  },
  {
    label: 'Sentinel repo audit',
    kind: 'repo',
    note: "Local audit of Claude's current repo direction: strong scaffold, weak research controls, blank spreadsheet.",
  },
];

export function getAverageReadiness(profiles: StrategyProfile[]): number {
  const total = profiles.reduce((sum, profile) => sum + profile.readiness, 0);
  return Math.round(total / profiles.length);
}

export function getStatusCount(
  profiles: StrategyProfile[],
  status: StrategyProfile['status'],
): number {
  return profiles.filter((profile) => profile.status === status).length;
}

export const overviewStats = [
  {
    label: 'Strategy sleeves',
    value: String(strategyProfiles.length),
    detail: 'Each sleeve carries evidence, failure modes, and controls.',
  },
  {
    label: 'Average readiness',
    value: `${getAverageReadiness(strategyProfiles)}%`,
    detail: 'Readiness is earned by controls, not by narrative confidence.',
  },
  {
    label: 'Paper-ready sleeves',
    value: String(getStatusCount(strategyProfiles, 'paper-ready')),
    detail: 'Only sleeves with credible controls can move forward.',
  },
  {
    label: 'Blocked sleeves',
    value: String(getStatusCount(strategyProfiles, 'blocked')),
    detail: 'Fragile ideas stay visibly blocked until the cost model catches up.',
  },
];
