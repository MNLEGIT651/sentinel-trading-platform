export type StrategyFamily =
  | 'trend'
  | 'value-momentum'
  | 'mean-reversion'
  | 'pairs'
  | 'allocation';

export type ResearchStatus = 'paper-ready' | 'researching' | 'blocked';

export type ControlStatus = 'green' | 'amber' | 'red';

export type SourceKind = 'blueprint' | 'paper' | 'official' | 'platform' | 'repo';

export interface StrategyProfile {
  id: string;
  name: string;
  family: StrategyFamily;
  horizon: string;
  status: ResearchStatus;
  readiness: number;
  evidence: string;
  thesis: string;
  dataNeeds: string;
  failureMode: string;
  controls: string;
  capacity: string;
  sourceLabels: string[];
}

export interface RepoArtifact {
  title: string;
  state: string;
  detail: string;
}

export interface LaunchControl {
  id: string;
  title: string;
  status: ControlStatus;
  owner: string;
  detail: string;
}

export interface SourceRecord {
  label: string;
  kind: SourceKind;
  note: string;
  href?: string;
  dateContext?: string;
}
