'use client';

export { queryKeys } from '@/lib/query-keys';

// ── Query hooks ────────────────────────────────────────────────────
export { useAccountQuery } from './use-account-query';
export { usePositionsQuery } from './use-positions-query';
export { useQuotesQuery } from './use-quotes-query';
export { useBarsQuery } from './use-bars-query';
export { useAgentStatusQuery } from './use-agent-status-query';
export { useRecommendationsQuery } from './use-recommendations-query';
export { useAlertsQuery } from './use-alerts-query';
export { useStrategiesQuery } from './use-strategies-query';
export { useOrderHistoryQuery } from './use-order-history-query';
export { useOrderStatusQuery } from './use-order-status-query';
export { useJournalQuery } from './use-journal-query';
export type { JournalFilters } from './use-journal-query';
export { useJournalStatsQuery } from './use-journal-stats-query';
export { useStrategyHealthQuery, useStrategyHealthDetailQuery } from './use-strategy-health-query';
export { useRiskPreviewQuery } from './use-risk-preview-query';
export type { PolicyImpact, RiskPreview } from './use-risk-preview-query';
export { useCounterfactualsQuery } from './use-counterfactuals-query';
export type {
  CounterfactualResult,
  CounterfactualStats,
  CounterfactualsResponse,
} from './use-counterfactuals-query';
export {
  useShadowPortfoliosQuery,
  useShadowPortfolioDetailQuery,
  useCreateShadowPortfolioMutation,
  useDeleteShadowPortfolioMutation,
} from './use-shadow-portfolios-query';
export type {
  ShadowPortfolio,
  ShadowPortfolioSnapshot,
  ShadowPortfolioCreate,
} from './use-shadow-portfolios-query';
export {
  useRegimeStateQuery,
  useRecordRegimeMutation,
  usePlaybooksQuery,
  useCreatePlaybookMutation,
  useDeletePlaybookMutation,
  useTogglePlaybookMutation,
} from './use-regime-query';
export type {
  MarketRegime,
  RegimeSource,
  RegimeEntry,
  RegimePlaybook,
  RegimeState,
  RegimePlaybookCreate,
  RecordRegimeInput,
} from './use-regime-query';
export {
  useDataQualityQuery,
  useRecordDataQualityMutation,
  useResolveEventsMutation,
} from './use-data-quality-query';
export type {
  DataQualityEvent,
  DataQualityEventType,
  DataQualitySeverity,
  DataQualityStats,
  DataQualityResponse,
  DataQualityFilters,
} from './use-data-quality-query';

// ── Replay / Incident Mode ──────────────────────────────────────────
export { useReplayQuery } from './use-replay-query';
export type {
  TimelineEvent,
  TimelineEventType,
  TimelineEventSeverity,
  ReplaySummary,
  ReplayResponse,
} from './use-replay-query';

// ── Catalyst Overlay ────────────────────────────────────────────────
export { useCatalystsQuery, useCreateCatalystMutation } from './use-catalysts-query';
export type {
  CatalystEvent,
  CatalystEventType,
  CatalystImpact,
  CatalystFilters,
  CatalystStats,
  CatalystResponse,
  CatalystEventCreate,
} from './use-catalysts-query';

// ── Mutation hooks ─────────────────────────────────────────────────
export { useSubmitOrderMutation } from './use-submit-order-mutation';
export { useApproveRecommendationMutation } from './use-approve-recommendation-mutation';
export { useRejectRecommendationMutation } from './use-reject-recommendation-mutation';
export { useTriggerCycleMutation } from './use-trigger-cycle-mutation';
export { useHaltMutation, useResumeMutation } from './use-halt-resume-mutations';
export { useCreateJournalEntryMutation } from './use-create-journal-entry-mutation';
export { useGradeJournalMutation } from './use-grade-journal-mutation';
