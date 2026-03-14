'use client';

import { DollarSign, TrendingUp, BarChart3, AlertTriangle, Zap } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { AlertFeed } from '@/components/dashboard/alert-feed';
import { PriceTicker } from '@/components/dashboard/price-ticker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Alert } from '@sentinel/shared';

const sampleTickerData = [
  { ticker: 'AAPL', price: 178.72, change: 1.24 },
  { ticker: 'MSFT', price: 378.91, change: 0.82 },
  { ticker: 'GOOGL', price: 141.80, change: -0.56 },
  { ticker: 'AMZN', price: 178.25, change: 1.89 },
  { ticker: 'NVDA', price: 495.22, change: 3.12 },
  { ticker: 'TSLA', price: 248.48, change: -2.15 },
  { ticker: 'META', price: 355.64, change: 0.45 },
  { ticker: 'SPY', price: 456.38, change: 0.62 },
];

const sampleAlerts: Alert[] = [
  {
    id: '1',
    account_id: null,
    instrument_id: null,
    severity: 'info',
    status: 'active',
    title: 'System Online',
    message: 'Sentinel trading engine connected and operational.',
    metadata: null,
    triggered_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    account_id: null,
    instrument_id: 'nvda',
    severity: 'warning',
    status: 'active',
    title: 'High Volatility Detected',
    message: 'NVDA showing unusual volume and price movement.',
    metadata: null,
    triggered_at: new Date(Date.now() - 300000).toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: '3',
    account_id: null,
    instrument_id: null,
    severity: 'critical',
    status: 'active',
    title: 'Risk Limit Approaching',
    message: 'Portfolio drawdown nearing configured threshold.',
    metadata: null,
    triggered_at: new Date(Date.now() - 600000).toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-4">
      {/* Row 1: Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Equity"
          value="$100,000"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Daily P&L"
          value="$0.00"
          change={0}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Sharpe Ratio"
          value="--"
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          label="Max Drawdown"
          value="0%"
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Row 2: Price Ticker */}
      <PriceTicker items={sampleTickerData} />

      {/* Row 3: Two columns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Active Signals */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Signals
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">
              No active signals. Strategies will generate signals during market hours.
            </p>
          </CardContent>
        </Card>

        {/* Alert Feed */}
        <AlertFeed alerts={sampleAlerts} />
      </div>
    </div>
  );
}
