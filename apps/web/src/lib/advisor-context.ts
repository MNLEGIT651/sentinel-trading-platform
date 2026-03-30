import { createServerSupabaseClient } from '@/lib/supabase/server';
import type {
  AdvisorContext,
  AdvisorProfileData,
  AdvisorPreference,
  AdvisorMessage,
} from '@sentinel/shared';
import { getProfileCompleteness } from '@sentinel/shared';

const DEFAULT_RECENT_MESSAGES = 20;

/**
 * Build the full advisor context for a user.
 *
 * Assembles the three memory tiers:
 *   1. Profile (single patchable document)
 *   2. Active + pending preferences
 *   3. Recent messages from a specific thread (or most recent thread)
 *
 * Used by agents and the context API route to construct LLM prompts.
 */
export async function buildAdvisorContext(
  userId: string,
  options?: {
    threadId?: string;
    maxRecentMessages?: number;
  },
): Promise<AdvisorContext> {
  const supabase = await createServerSupabaseClient();
  const limit = options?.maxRecentMessages ?? DEFAULT_RECENT_MESSAGES;

  // Fetch all three tiers in parallel
  const [profileResult, preferencesResult, threadResult] = await Promise.all([
    // Tier 1: Profile
    supabase.from('advisor_profiles').select('profile').eq('user_id', userId).single(),

    // Tier 2: Active + pending preferences (bounded to prevent prompt bloat)
    supabase
      .from('advisor_preferences')
      .select('id, category, content, context, confidence, status')
      .eq('user_id', userId)
      .in('status', ['active', 'pending_confirmation'])
      .order('created_at', { ascending: false })
      .limit(200),

    // Tier 3: Determine thread for recent messages
    options?.threadId
      ? supabase
          .from('advisor_threads')
          .select('id, rolling_summary')
          .eq('id', options.threadId)
          .eq('user_id', userId)
          .single()
      : supabase
          .from('advisor_threads')
          .select('id, rolling_summary')
          .eq('user_id', userId)
          .order('last_activity', { ascending: false })
          .limit(1)
          .single(),
  ]);

  const profile: AdvisorProfileData = profileResult.data?.profile ?? {};
  const allPrefs = (preferencesResult.data ?? []) as Pick<
    AdvisorPreference,
    'id' | 'category' | 'content' | 'context' | 'confidence' | 'status'
  >[];

  const activePreferences = allPrefs.filter((p) => p.status === 'active');
  const pendingPreferences = allPrefs.filter((p) => p.status === 'pending_confirmation');

  // Fetch recent messages from the resolved thread
  let recentMessages: Pick<AdvisorMessage, 'role' | 'content' | 'created_at'>[] = [];
  let threadSummary: string | null = null;

  if (threadResult.data?.id) {
    threadSummary = threadResult.data.rolling_summary ?? null;

    const { data: messages } = await supabase
      .from('advisor_messages')
      .select('role, content, created_at')
      .eq('thread_id', threadResult.data.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    recentMessages = (messages ?? []).reverse();
  }

  return {
    profile,
    active_preferences: activePreferences,
    pending_preferences: pendingPreferences,
    recent_messages: recentMessages,
    thread_summary: threadSummary,
    preference_count: activePreferences.length + pendingPreferences.length,
    profile_completeness: getProfileCompleteness(profile),
  };
}
