// apps/agents/src/recommendations-store.ts
import { getSupabaseClient } from './supabase-client.js';
import { logger } from './logger.js';

async function emitEvent(
  recommendationId: string,
  eventType: string,
  actorType: 'system' | 'agent' | 'operator' = 'system',
  actorId?: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = getSupabaseClient();
    await db.from('recommendation_events').insert({
      recommendation_id: recommendationId,
      event_type: eventType,
      actor_type: actorType,
      actor_id: actorId ?? null,
      payload,
    });
  } catch (err) {
    // Non-blocking — event emission should never break the main flow
    logger.warn('Failed to emit recommendation event', {
      eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface RecommendationCreate {
  agent_role: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type: 'market' | 'limit';
  limit_price?: number;
  reason?: string;
  strategy_name?: string;
  signal_strength?: number;
  metadata?: Record<string, unknown>;
}

export interface Recommendation extends RecommendationCreate {
  id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'filled' | 'risk_blocked';
  order_id?: string | null;
  reviewed_at?: string | null;
}

export interface AlertCreate {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  ticker?: string;
}

export interface AgentAlert extends AlertCreate {
  id: string;
  created_at: string;
  acknowledged: boolean;
}

export async function createRecommendation(rec: RecommendationCreate): Promise<Recommendation> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('agent_recommendations')
    .insert({ ...rec, status: 'pending' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await emitEvent(data.id, 'created', 'agent', rec.agent_role, {
    ticker: rec.ticker,
    side: rec.side,
    quantity: rec.quantity,
  });
  return data as Recommendation;
}

export async function listRecommendations(status?: string): Promise<Recommendation[]> {
  const db = getSupabaseClient();
  let query = db
    .from('agent_recommendations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Recommendation[];
}

export async function getRecommendation(id: string): Promise<Recommendation | null> {
  const db = getSupabaseClient();
  const { data, error } = await db.from('agent_recommendations').select('*').eq('id', id).single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw new Error(error.message);
  return data as Recommendation;
}

/**
 * Atomically claim a 'pending' recommendation for approval.
 * Returns the updated row, or null if the row was not in 'pending' state
 * (prevents double-submission race conditions).
 */
export async function atomicApprove(id: string): Promise<Recommendation | null> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('agent_recommendations')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw new Error(error.message);
  await emitEvent(id, 'approved', 'operator');
  return data as Recommendation;
}

export async function markFilled(id: string, orderId: string): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db
    .from('agent_recommendations')
    .update({ status: 'filled', order_id: orderId })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await emitEvent(id, 'filled', 'system', undefined, { order_id: orderId });
}

export async function markRiskBlocked(id: string, reason: string): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db
    .from('agent_recommendations')
    .update({
      status: 'risk_blocked',
      reviewed_at: new Date().toISOString(),
      metadata: { block_reason: reason },
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  await emitEvent(id, 'risk_blocked', 'system', undefined, { reason });
}

/**
 * Revert an 'approved' recommendation back to 'pending' after a transient
 * engine failure, allowing the user to retry approval.
 * Only reverts if current status is 'approved' (CAS guard).
 */
export async function revertToPending(id: string): Promise<boolean> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('agent_recommendations')
    .update({ status: 'pending', reviewed_at: null })
    .eq('id', id)
    .eq('status', 'approved')
    .select('id');
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}

export async function rejectRecommendation(id: string): Promise<Recommendation | null> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from('agent_recommendations')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single();
  if (error?.code === 'PGRST116') return null;
  if (error) throw new Error(error.message);
  await emitEvent(id, 'rejected', 'operator');
  return data as Recommendation;
}

export async function createAlert(alert: AlertCreate): Promise<AgentAlert> {
  const db = getSupabaseClient();
  const { data, error } = await db.from('agent_alerts').insert(alert).select().single();
  if (error) throw new Error(error.message);
  return data as AgentAlert;
}

export interface AlertsCursor {
  lastCreatedAt: string;
  lastId: string;
}

export interface AlertsPage {
  alerts: AgentAlert[];
  nextCursor: AlertsCursor | null;
}

export async function listAlerts(limit = 50, cursor?: AlertsCursor): Promise<AlertsPage> {
  const db = getSupabaseClient();
  // Fetch one extra row to determine if there's a next page
  let query = db
    .from('agent_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (cursor) {
    // Keyset pagination: rows older than the cursor position
    query = query.or(
      `created_at.lt.${cursor.lastCreatedAt},and(created_at.eq.${cursor.lastCreatedAt},id.lt.${cursor.lastId})`,
    );
  }

  const { data, error } = await query.limit(limit + 1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AgentAlert[];
  const hasMore = rows.length > limit;
  const alerts = hasMore ? rows.slice(0, limit) : rows;
  const last = alerts[alerts.length - 1];
  return {
    alerts,
    nextCursor: hasMore && last ? { lastCreatedAt: last.created_at, lastId: last.id } : null,
  };
}
