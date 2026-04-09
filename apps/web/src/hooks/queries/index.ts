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
export {
  useRecommendationSearchQuery,
  useRecommendationReplayQuery,
} from './use-recommendation-replay-query';
export type {
  RecommendationSearchFilters,
  RecommendationSearchResult,
  RecommendationSearchResponse,
  RecommendationReplayData,
  RecommendationOutcome,
  JournalEntryRecord,
  MarketRegimeSnapshot,
} from './use-recommendation-replay-query';

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

// ── Operator Roles ─────────────────────────────────────────────────
export {
  useMyProfileQuery,
  useRolesQuery,
  useUpdateRoleMutation,
  hasRoleLevel,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LEVELS,
} from './use-roles-query';
export type {
  OperatorRole,
  UserProfile,
  RoleChangeEntry,
  RolesResponse,
  RoleUpdateRequest,
} from './use-roles-query';

// ── System Controls ───────────────────────────────────────────────
export {
  useSystemControlsQuery,
  useUpdateSystemControlsMutation,
  useHaltSystemMutation,
  useResumeSystemMutation,
} from './use-system-controls-query';

// ── Autonomy ──────────────────────────────────────────────────────
export {
  useStrategiesAutonomyQuery,
  useUpdateStrategyAutonomyMutation,
} from './use-strategies-autonomy-query';
export type { StrategyAutonomyEntry } from './use-strategies-autonomy-query';

export {
  useUniverseRestrictionsQuery,
  useCreateRestrictionMutation,
  useDeleteRestrictionMutation,
} from './use-universe-restrictions-query';
export type { CreateRestrictionInput } from './use-universe-restrictions-query';

export { useAutoExecutionActivityQuery } from './use-auto-execution-activity-query';
export type { AutoExecutionEvent } from './use-auto-execution-activity-query';

// ── Recommendation Events ─────────────────────────────────────────
export {
  useRecommendationEventsQuery,
  useAddRecommendationEventMutation,
} from './use-recommendation-events-query';
export type { RecommendationDetail } from './use-recommendation-events-query';

// ── Operator Actions ──────────────────────────────────────────────
export { useOperatorActionsQuery, useRecordActionMutation } from './use-operator-actions-query';
export type { OperatorActionsFilters, OperatorActionsResponse } from './use-operator-actions-query';

// ── Risk Evaluations ──────────────────────────────────────────────
export {
  useRiskEvaluationsQuery,
  useRecordRiskEvaluationMutation,
} from './use-risk-evaluations-query';
export type { RiskEvaluationsFilters } from './use-risk-evaluations-query';

// ── Fills ─────────────────────────────────────────────────────────
export { useFillsQuery, useRecordFillMutation } from './use-fills-query';
export type { FillsFilters } from './use-fills-query';

// ── Workflow Jobs ─────────────────────────────────────────────────
export { useWorkflowJobsQuery, useWorkflowStepsQuery } from './use-workflow-jobs-query';

// ── Mutation hooks (re-exported from mutations/) ──────────────────
export { useSubmitOrderMutation } from '../mutations/use-submit-order-mutation';
export { useApproveRecommendationMutation } from '../mutations/use-approve-recommendation-mutation';
export { useRejectRecommendationMutation } from '../mutations/use-reject-recommendation-mutation';
export { useTriggerCycleMutation } from '../mutations/use-trigger-cycle-mutation';
export { useHaltMutation, useResumeMutation } from '../mutations/use-halt-resume-mutations';
export { useCreateJournalEntryMutation } from '../mutations/use-create-journal-entry-mutation';
export { useGradeJournalMutation } from '../mutations/use-grade-journal-mutation';
