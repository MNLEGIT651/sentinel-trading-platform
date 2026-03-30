// ─── Advisor Memory & Explainable Recommendations ──────────────────
//
// Three-tier advisor memory (profile + preferences + conversations)
// and structured recommendation explanations.

// ─── Advisor Profile (Tier 1: Patchable Profile Document) ──────────

/** Risk tolerance level for trading decisions. */
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';

/** Investor experience level. */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional';

/** Preferred investment time horizon. */
export type InvestmentHorizon = 'day_trade' | 'swing' | 'position' | 'long_term';

/** Primary investment goal. */
export type InvestmentGoal = 'income' | 'growth' | 'preservation' | 'speculation';

/** Approximate account size range. */
export type AccountSizeRange = 'under_10k' | '10k_50k' | '50k_200k' | '200k_1m' | 'over_1m';

/**
 * Structured profile document stored as JSONB.
 * Updated via JSON merge patch — fields are optional to support incremental updates.
 */
export interface AdvisorProfileData {
  risk_tolerance?: RiskTolerance | undefined;
  experience_level?: ExperienceLevel | undefined;
  investment_horizon?: InvestmentHorizon | undefined;
  primary_goal?: InvestmentGoal | undefined;
  account_size_range?: AccountSizeRange | undefined;
  preferred_asset_classes?: string[] | undefined;
  preferred_sectors?: string[] | undefined;
  avoided_sectors?: string[] | undefined;
  max_position_pct?: number | undefined;
  notes?: string | undefined;
}

/** Row shape for the `advisor_profiles` table. */
export interface AdvisorProfile {
  id: string;
  user_id: string;
  profile: AdvisorProfileData;
  version: number;
  updated_at: string;
  created_at: string;
}

/** Patch payload for updating a profile (partial merge). */
export type AdvisorProfilePatch = Partial<AdvisorProfileData>;

// ─── Advisor Threads (Tier 3: Episodic / Conversation Memory) ──────

/** Row shape for the `advisor_threads` table. */
export interface AdvisorThread {
  id: string;
  user_id: string;
  title: string;
  rolling_summary: string | null;
  message_count: number;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

/** Payload for creating a new thread. */
export interface AdvisorThreadCreate {
  title?: string | undefined;
}

/** Payload for updating an existing thread. */
export interface AdvisorThreadUpdate {
  title?: string | undefined;
  rolling_summary?: string | undefined;
}

// ─── Advisor Messages ──────────────────────────────────────────────

/** Role of a message within an advisor thread. */
export type AdvisorMessageRole = 'user' | 'assistant' | 'system';

/** Metadata attached to an advisor message. */
export interface AdvisorMessageMetadata {
  model?: string | undefined;
  token_count?: number | undefined;
  latency_ms?: number | undefined;
  memories_used?: string[] | undefined;
  [key: string]: unknown;
}

/** Row shape for the `advisor_messages` table. */
export interface AdvisorMessage {
  id: string;
  thread_id: string;
  user_id: string;
  role: AdvisorMessageRole;
  content: string;
  metadata: AdvisorMessageMetadata;
  created_at: string;
}

/** Payload for appending a message to a thread. */
export interface AdvisorMessageCreate {
  role: AdvisorMessageRole;
  content: string;
  metadata?: AdvisorMessageMetadata;
}

// ─── Advisor Preferences (Tier 2: Semantic Memory / Facts) ─────────

/** Category of a user preference. */
export type PreferenceCategory =
  | 'risk_tolerance'
  | 'holding_period'
  | 'trade_style'
  | 'sector'
  | 'position_sizing'
  | 'volatility'
  | 'instrument'
  | 'general';

/** Source of how a preference was created. */
export type PreferenceSource = 'explicit' | 'inferred' | 'system';

/** Lifecycle status of a preference. */
export type PreferenceStatus = 'active' | 'pending_confirmation' | 'dismissed' | 'archived';

/** Row shape for the `advisor_preferences` table. */
export interface AdvisorPreference {
  id: string;
  user_id: string;
  category: PreferenceCategory;
  content: string;
  context: string | null;
  source: PreferenceSource;
  confidence: number;
  status: PreferenceStatus;
  originating_message_id: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload for creating a new preference. */
export interface AdvisorPreferenceCreate {
  category: PreferenceCategory;
  content: string;
  context?: string | undefined;
  source?: PreferenceSource | undefined;
  confidence?: number | undefined;
  status?: PreferenceStatus | undefined;
  originating_message_id?: string | undefined;
}

/** Payload for editing an existing preference. */
export interface AdvisorPreferenceUpdate {
  category?: PreferenceCategory | undefined;
  content?: string | undefined;
  context?: string | undefined;
  confidence?: number | undefined;
}

// ─── Advisor Memory Events (Audit Trail) ───────────────────────────

/** Types of memory events that are logged. */
export type MemoryEventType =
  | 'profile_updated'
  | 'preference_learned'
  | 'preference_confirmed'
  | 'preference_edited'
  | 'preference_dismissed'
  | 'preference_deleted'
  | 'preference_restored'
  | 'preference_auto_expired';

/** Row shape for the `advisor_memory_events` table. */
export interface AdvisorMemoryEvent {
  id: string;
  user_id: string;
  preference_id: string | null;
  event_type: MemoryEventType;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Recommendation Explanations ───────────────────────────────────

/** A single factor contributing to a recommendation. */
export interface ExplanationFactor {
  name: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight?: number | undefined;
}

/** Reference to a user preference used in an explanation. */
export interface PreferenceReference {
  preference_id: string;
  content: string;
  category: PreferenceCategory;
  how_used: string;
}

/** A constraint that was checked during recommendation generation. */
export interface ConstraintCheck {
  name: string;
  passed: boolean;
  limit?: string | undefined;
  actual?: string | undefined;
  message?: string | undefined;
}

/** A risk factor associated with a recommendation. */
export interface RiskFactor {
  name: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string | undefined;
}

/** An alternative that was considered but not chosen. */
export interface Alternative {
  name: string;
  reason_rejected: string;
}

/** Confidence label derived from numeric confidence score. */
export type ConfidenceLabel = 'low' | 'medium' | 'high';

/** Structured explanation payload stored as JSONB. */
export interface ExplanationPayload {
  summary: string;
  primary_factors: ExplanationFactor[];
  user_preferences_used: PreferenceReference[];
  constraints_checked: ConstraintCheck[];
  risks: RiskFactor[];
  alternatives_considered: Alternative[];
  confidence: number;
  confidence_label: ConfidenceLabel;
  generated_at: string;
}

/** Row shape for the `recommendation_explanations` table. */
export interface RecommendationExplanation {
  id: string;
  recommendation_id: string;
  user_id: string;
  summary: string;
  explanation: ExplanationPayload;
  version: number;
  generated_at: string;
  created_at: string;
}

// ─── Context Builder Types ─────────────────────────────────────────

/**
 * Assembled advisor context for prompt construction.
 * Combines all three memory tiers into a single runtime payload.
 */
export interface AdvisorContext {
  profile: AdvisorProfileData;
  active_preferences: Pick<
    AdvisorPreference,
    'id' | 'category' | 'content' | 'context' | 'confidence'
  >[];
  pending_preferences: Pick<
    AdvisorPreference,
    'id' | 'category' | 'content' | 'context' | 'confidence'
  >[];
  recent_messages: Pick<AdvisorMessage, 'role' | 'content' | 'created_at'>[];
  thread_summary: string | null;
  preference_count: number;
  profile_completeness: number;
}

// ─── Helpers ───────────────────────────────────────────────────────

/** All fields in AdvisorProfileData for completeness calculation. */
export const PROFILE_FIELDS: (keyof AdvisorProfileData)[] = [
  'risk_tolerance',
  'experience_level',
  'investment_horizon',
  'primary_goal',
  'account_size_range',
  'preferred_asset_classes',
  'preferred_sectors',
  'avoided_sectors',
  'max_position_pct',
  'notes',
];

/** Calculate profile completeness as a fraction (0–1). */
export function getProfileCompleteness(profile: AdvisorProfileData): number {
  const filled = PROFILE_FIELDS.filter((key) => {
    const val = profile[key];
    if (val === undefined || val === null) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim().length > 0;
    return true;
  });
  return filled.length / PROFILE_FIELDS.length;
}

/** Derive a confidence label from a numeric score. */
export function getConfidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

/** Human-readable labels for preference categories. */
export const PREFERENCE_CATEGORY_LABELS: Record<PreferenceCategory, string> = {
  risk_tolerance: 'Risk Tolerance',
  holding_period: 'Holding Period',
  trade_style: 'Trade Style',
  sector: 'Sectors',
  position_sizing: 'Position Sizing',
  volatility: 'Volatility',
  instrument: 'Instruments',
  general: 'General',
};

/** Human-readable labels for preference sources. */
export const PREFERENCE_SOURCE_LABELS: Record<PreferenceSource, string> = {
  explicit: 'You set this',
  inferred: 'Learned from conversation',
  system: 'System default',
};

/** Human-readable labels for memory event types. */
export const MEMORY_EVENT_LABELS: Record<MemoryEventType, string> = {
  profile_updated: 'Profile updated',
  preference_learned: 'Preference learned',
  preference_confirmed: 'Preference confirmed',
  preference_edited: 'Preference edited',
  preference_dismissed: 'Preference dismissed',
  preference_deleted: 'Preference deleted',
  preference_restored: 'Preference restored',
  preference_auto_expired: 'Preference expired',
};
