export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/replay?timestamp=ISO8601
 *
 * Returns a point-in-time snapshot of system state at the given timestamp:
 * - Recommendations active/created around that time
 * - Journal entries near that time
 * - Alerts active at that time
 * - Orders placed around that time
 * - Data quality events around that time
 * - Strategy health at that time
 * - System mode (trading policy) at that time
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timestampStr = searchParams.get('timestamp');

  if (!timestampStr) {
    return NextResponse.json(
      { error: 'timestamp query parameter is required (ISO 8601 format)' },
      { status: 400 },
    );
  }

  const timestamp = new Date(timestampStr);
  if (isNaN(timestamp.getTime())) {
    return NextResponse.json({ error: 'Invalid timestamp format. Use ISO 8601.' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Define a window around the timestamp (±1 hour by default, configurable)
  const windowMinutes = parseInt(searchParams.get('window') || '60', 10);
  const windowStart = new Date(timestamp.getTime() - windowMinutes * 60 * 1000).toISOString();
  const windowEnd = new Date(timestamp.getTime() + windowMinutes * 60 * 1000).toISOString();
  const ts = timestamp.toISOString();

  // Run all queries in parallel
  const [
    recommendationsResult,
    journalResult,
    alertsResult,
    ordersResult,
    dataQualityResult,
    strategyHealthResult,
    policyResult,
  ] = await Promise.all([
    // Recommendations created within the window
    supabase
      .from('agent_recommendations')
      .select('*')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: false })
      .limit(50),

    // Journal entries within the window
    supabase
      .from('decision_journal')
      .select('*')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: false })
      .limit(50),

    // Alerts that were active at the timestamp (created before, not resolved or resolved after)
    supabase
      .from('alerts')
      .select('*')
      .lte('created_at', ts)
      .or(`resolved_at.is.null,resolved_at.gte.${ts}`)
      .order('created_at', { ascending: false })
      .limit(50),

    // Orders placed within the window
    supabase
      .from('orders')
      .select('*')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: false })
      .limit(50),

    // Data quality events within the window
    supabase
      .from('data_quality_events')
      .select('*')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)
      .order('created_at', { ascending: false })
      .limit(50),

    // Strategy health snapshots closest to the timestamp
    supabase
      .from('strategy_health_snapshots')
      .select('*')
      .lte('snapshot_date', ts)
      .order('snapshot_date', { ascending: false })
      .limit(20),

    // Trading policy active at the timestamp
    supabase
      .from('user_trading_policy')
      .select('*')
      .lte('created_at', ts)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  // Build timeline: merge all events into a single sorted timeline
  type TimelineEvent = {
    id: string;
    type: string;
    timestamp: string;
    title: string;
    detail: string;
    severity: 'info' | 'warning' | 'error' | 'success';
    metadata: Record<string, unknown>;
  };

  const timeline: TimelineEvent[] = [];

  // Add recommendations to timeline
  for (const rec of recommendationsResult.data || []) {
    timeline.push({
      id: `rec-${rec.id}`,
      type: 'recommendation',
      timestamp: rec.created_at,
      title: `${rec.side?.toUpperCase() || 'TRADE'} ${rec.ticker}`,
      detail: `${rec.strategy_name || 'Unknown strategy'} — strength ${(rec.signal_strength * 100).toFixed(0)}% — ${rec.status}`,
      severity:
        rec.status === 'filled'
          ? 'success'
          : rec.status === 'risk_blocked'
            ? 'error'
            : rec.status === 'rejected'
              ? 'warning'
              : 'info',
      metadata: rec,
    });
  }

  // Add journal entries to timeline
  for (const entry of journalResult.data || []) {
    timeline.push({
      id: `journal-${entry.id}`,
      type: 'journal',
      timestamp: entry.created_at,
      title: `${entry.event_type}: ${entry.ticker || 'System'}`,
      detail: entry.reasoning || entry.user_notes || '',
      severity:
        entry.user_grade === 'bad' ? 'error' : entry.user_grade === 'good' ? 'success' : 'info',
      metadata: entry,
    });
  }

  // Add alerts to timeline
  for (const alert of alertsResult.data || []) {
    timeline.push({
      id: `alert-${alert.id}`,
      type: 'alert',
      timestamp: alert.created_at,
      title: alert.title || 'Alert',
      detail: alert.message || '',
      severity:
        alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info',
      metadata: alert,
    });
  }

  // Add orders to timeline
  for (const order of ordersResult.data || []) {
    timeline.push({
      id: `order-${order.id}`,
      type: 'order',
      timestamp: order.created_at,
      title: `Order: ${order.side?.toUpperCase() || ''} ${order.symbol || ''}`,
      detail: `Status: ${order.status} — Broker ID: ${order.broker_order_id || 'N/A'}`,
      severity:
        order.status === 'filled'
          ? 'success'
          : order.status === 'cancelled' || order.status === 'rejected'
            ? 'error'
            : 'info',
      metadata: order,
    });
  }

  // Add data quality events to timeline
  for (const dq of dataQualityResult.data || []) {
    timeline.push({
      id: `dq-${dq.id}`,
      type: 'data_quality',
      timestamp: dq.created_at,
      title: `Data: ${dq.event_type}`,
      detail: `${dq.provider || ''} ${dq.ticker || ''} — ${dq.message || ''}`.trim(),
      severity:
        dq.severity === 'critical' || dq.severity === 'error'
          ? 'error'
          : dq.severity === 'warning'
            ? 'warning'
            : 'info',
      metadata: dq,
    });
  }

  // Sort timeline by timestamp (newest first)
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Build summary
  const summary = {
    timestamp: ts,
    window: { start: windowStart, end: windowEnd, minutes: windowMinutes },
    counts: {
      recommendations: recommendationsResult.data?.length || 0,
      journal_entries: journalResult.data?.length || 0,
      active_alerts: alertsResult.data?.length || 0,
      orders: ordersResult.data?.length || 0,
      data_quality_events: dataQualityResult.data?.length || 0,
    },
    strategy_health: strategyHealthResult.data || [],
    trading_policy: policyResult.data?.[0] || null,
  };

  return NextResponse.json({
    summary,
    timeline,
  });
}
