import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseSearchParams } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { getServiceConfig } from '@/lib/server/service-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QuoteData {
  ticker: string;
  close: number;
  high: number;
  low: number;
  change_pct: number;
}

interface Recommendation {
  id: string;
  created_at: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type: string;
  limit_price: number | null;
  reason: string | null;
  strategy_name: string | null;
  signal_strength: number | null;
  status: string;
  reviewed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface CounterfactualResult {
  id: string;
  recommendation: Recommendation;
  entry_price: number | null;
  current_price: number | null;
  hypothetical_pnl: number | null;
  hypothetical_return_pct: number | null;
  days_since_rejection: number;
  price_available: boolean;
}

export interface CounterfactualStats {
  total_rejected: number;
  total_risk_blocked: number;
  would_be_winners: number;
  would_be_losers: number;
  total_missed_pnl: number;
  avg_hypothetical_return_pct: number;
  win_rate_pct: number;
}

const counterfactualQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = parseSearchParams(req, counterfactualQuery);
  if (parsed instanceof NextResponse) return parsed;
  const { limit, offset } = parsed;

  // Fetch rejected and risk_blocked recommendations
  const {
    data: recs,
    error: recsErr,
    count,
  } = await supabase
    .from('agent_recommendations')
    .select('*', { count: 'exact' })
    .in('status', ['rejected', 'risk_blocked'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (recsErr) {
    return NextResponse.json({ error: recsErr.message }, { status: 500 });
  }

  const recommendations = (recs ?? []) as Recommendation[];

  if (recommendations.length === 0) {
    const emptyStats: CounterfactualStats = {
      total_rejected: 0,
      total_risk_blocked: 0,
      would_be_winners: 0,
      would_be_losers: 0,
      total_missed_pnl: 0,
      avg_hypothetical_return_pct: 0,
      win_rate_pct: 0,
    };
    return NextResponse.json({
      counterfactuals: [],
      stats: emptyStats,
      total: 0,
      limit,
      offset,
    });
  }

  // Get unique tickers to fetch current prices
  const tickers = [...new Set(recommendations.map((r) => r.ticker))];

  // Fetch current quotes from engine
  const quotes: Record<string, QuoteData> = {};
  const engineConfig = getServiceConfig('engine');

  if (engineConfig.configured && engineConfig.baseUrl) {
    try {
      const tickerParam = tickers.join(',');
      const res = await fetch(
        `${engineConfig.baseUrl}/api/v1/data/quotes?tickers=${encodeURIComponent(tickerParam)}`,
        { headers: engineConfig.headers },
      );
      if (res.ok) {
        const data = await res.json();
        const quoteList = Array.isArray(data) ? data : (data.quotes ?? []);
        for (const q of quoteList) {
          if (q.ticker) {
            quotes[q.ticker.toUpperCase()] = q;
          }
        }
      }
    } catch (error) {
      console.error('counterfactuals.GET', error);
      // Engine offline ΓÇö prices unavailable
    }
  }

  // Build counterfactual results
  const counterfactuals: CounterfactualResult[] = recommendations.map((rec) => {
    const quote = quotes[rec.ticker?.toUpperCase()];
    const currentPrice = quote?.close ?? null;

    // Use limit_price as entry price estimate, or fall back to null
    const entryPrice = rec.limit_price ?? currentPrice;

    let hypotheticalPnl: number | null = null;
    let hypotheticalReturnPct: number | null = null;

    if (entryPrice && currentPrice) {
      if (rec.side === 'buy') {
        hypotheticalPnl = (currentPrice - entryPrice) * rec.quantity;
        hypotheticalReturnPct = ((currentPrice - entryPrice) / entryPrice) * 100;
      } else {
        hypotheticalPnl = (entryPrice - currentPrice) * rec.quantity;
        hypotheticalReturnPct = ((entryPrice - currentPrice) / entryPrice) * 100;
      }
    }

    const rejectedAt = rec.reviewed_at ?? rec.created_at;
    const daysSince = Math.floor(
      (Date.now() - new Date(rejectedAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: rec.id,
      recommendation: rec,
      entry_price: entryPrice,
      current_price: currentPrice,
      hypothetical_pnl: hypotheticalPnl !== null ? Math.round(hypotheticalPnl * 100) / 100 : null,
      hypothetical_return_pct:
        hypotheticalReturnPct !== null ? Math.round(hypotheticalReturnPct * 100) / 100 : null,
      days_since_rejection: daysSince,
      price_available: currentPrice !== null,
    };
  });

  // Compute stats
  const withPnl = counterfactuals.filter((c) => c.hypothetical_pnl !== null);
  const winners = withPnl.filter((c) => (c.hypothetical_pnl ?? 0) > 0);
  const losers = withPnl.filter((c) => (c.hypothetical_pnl ?? 0) < 0);
  const totalMissedPnl = withPnl.reduce((sum, c) => sum + (c.hypothetical_pnl ?? 0), 0);
  const avgReturn =
    withPnl.length > 0
      ? withPnl.reduce((sum, c) => sum + (c.hypothetical_return_pct ?? 0), 0) / withPnl.length
      : 0;

  const stats: CounterfactualStats = {
    total_rejected: recommendations.filter((r) => r.status === 'rejected').length,
    total_risk_blocked: recommendations.filter((r) => r.status === 'risk_blocked').length,
    would_be_winners: winners.length,
    would_be_losers: losers.length,
    total_missed_pnl: Math.round(totalMissedPnl * 100) / 100,
    avg_hypothetical_return_pct: Math.round(avgReturn * 100) / 100,
    win_rate_pct:
      withPnl.length > 0 ? Math.round((winners.length / withPnl.length) * 10000) / 100 : 0,
  };

  return NextResponse.json({
    counterfactuals,
    stats,
    total: count ?? 0,
    limit,
    offset,
  });
}
