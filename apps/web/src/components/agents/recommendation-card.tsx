'use client';

import { TrendingUp, TrendingDown, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TradeRecommendation } from '@/lib/agents-client';

interface RecommendationCardProps {
  recommendations: TradeRecommendation[];
  approvingId: string | null;
  rejectingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function RecommendationCard({
  recommendations,
  approvingId,
  rejectingId,
  onApprove,
  onReject,
}: RecommendationCardProps) {
  if (recommendations.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground">
            Pending Trade Recommendations
          </CardTitle>
          <Badge className="border bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
            {recommendations.length} awaiting approval
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="flex items-center justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2.5"
          >
            <div className="flex items-center gap-3">
              {rec.side === 'buy' ? (
                <TrendingUp className="h-4 w-4 text-profit shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 text-loss shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{rec.ticker}</span>
                  <Badge
                    className={cn(
                      'border text-[9px]',
                      rec.side === 'buy'
                        ? 'bg-profit/10 text-profit border-profit/20'
                        : 'bg-loss/10 text-loss border-loss/20',
                    )}
                  >
                    {rec.side.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {rec.quantity} shares @ {rec.order_type}
                  </span>
                </div>
                {rec.reason && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{rec.reason}</p>
                )}
                {rec.strategy_name && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {rec.strategy_name}
                    {rec.signal_strength != null &&
                      ` · strength ${(rec.signal_strength * 100).toFixed(0)}%`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="default"
                disabled={approvingId === rec.id}
                onClick={() => onApprove(rec.id)}
                className="h-7 text-xs bg-profit hover:bg-profit/80"
              >
                {approvingId === rec.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rejectingId === rec.id}
                onClick={() => onReject(rec.id)}
                className="h-7 text-xs"
              >
                {rejectingId === rec.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Reject
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
