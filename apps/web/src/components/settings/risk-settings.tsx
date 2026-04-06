'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SettingsField({
  label,
  description,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const fieldId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {description && (
        <p
          id={`${fieldId}-desc`}
          className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]"
        >
          {description}
        </p>
      )}
      <Input
        id={fieldId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        {...(description ? { 'aria-describedby': `${fieldId}-desc` } : {})}
        className="font-mono"
      />
    </div>
  );
}

interface RiskSettingsProps {
  maxPosition: string;
  onMaxPosition: (v: string) => void;
  maxSector: string;
  onMaxSector: (v: string) => void;
  dailyLossLimit: string;
  onDailyLossLimit: (v: string) => void;
  softDrawdown: string;
  onSoftDrawdown: (v: string) => void;
  hardDrawdown: string;
  onHardDrawdown: (v: string) => void;
  maxPositions: string;
  onMaxPositions: (v: string) => void;
}

export function RiskSettings({
  maxPosition,
  onMaxPosition,
  maxSector,
  onMaxSector,
  dailyLossLimit,
  onDailyLossLimit,
  softDrawdown,
  onSoftDrawdown,
  hardDrawdown,
  onHardDrawdown,
  maxPositions,
  onMaxPositions,
}: RiskSettingsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 stagger-grid">
      <Card className="w-full max-w-none border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
            Position Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField
            label="Max Position Size (%)"
            description="Maximum percentage of portfolio for a single position."
            value={maxPosition}
            onChange={onMaxPosition}
            type="number"
          />
          <SettingsField
            label="Max Sector Exposure (%)"
            description="Maximum allocation to any one sector."
            value={maxSector}
            onChange={onMaxSector}
            type="number"
          />
          <SettingsField
            label="Max Open Positions"
            description="Maximum number of concurrent positions."
            value={maxPositions}
            onChange={onMaxPositions}
            type="number"
          />
        </CardContent>
      </Card>

      <Card className="w-full max-w-none border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
              Circuit Breakers
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField
            label="Daily Loss Limit (%)"
            description="Halt trading when daily loss exceeds this threshold."
            value={dailyLossLimit}
            onChange={onDailyLossLimit}
            type="number"
          />
          <SettingsField
            label="Soft Drawdown Halt (%)"
            description="Reduce position sizes when drawdown hits this level."
            value={softDrawdown}
            onChange={onSoftDrawdown}
            type="number"
          />
          <SettingsField
            label="Hard Drawdown Halt (%)"
            description="Liquidate all positions at this drawdown level."
            value={hardDrawdown}
            onChange={onHardDrawdown}
            type="number"
          />
        </CardContent>
      </Card>
    </div>
  );
}
