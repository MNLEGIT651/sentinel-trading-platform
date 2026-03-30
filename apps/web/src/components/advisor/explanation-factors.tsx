'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type {
  ExplanationFactor,
  ConstraintCheck,
  RiskFactor,
  Alternative,
  PreferenceReference,
} from '@sentinel/shared';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Link2,
} from 'lucide-react';

// ─── Primary Factors ───────────────────────────────────────────────

interface FactorListProps {
  factors: ExplanationFactor[];
}

const impactIcons = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
} as const;

const impactColors = {
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  neutral: 'text-muted-foreground',
} as const;

export function FactorList({ factors }: FactorListProps) {
  if (factors.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Key Factors
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {factors.map((factor, i) => {
          const Icon = impactIcons[factor.impact];
          return (
            <Badge key={i} variant="secondary" className="gap-1 text-xs">
              <Icon className={cn('h-3 w-3', impactColors[factor.impact])} />
              {factor.name}
            </Badge>
          );
        })}
      </div>
      <div className="space-y-1.5">
        {factors.map((factor, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className={cn('mt-0.5 shrink-0', impactColors[factor.impact])}>•</span>
            <span>{factor.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Preferences Used ──────────────────────────────────────────────

interface PreferencesUsedProps {
  preferences: PreferenceReference[];
}

export function PreferencesUsed({ preferences }: PreferencesUsedProps) {
  if (preferences.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Your Preferences Used
      </h4>
      <div className="space-y-1.5">
        {preferences.map((pref, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-xs"
          >
            <Link2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            <div>
              <span className="font-medium text-foreground">{pref.content}</span>
              <span className="text-muted-foreground"> — {pref.how_used}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Constraints Checked ───────────────────────────────────────────

interface ConstraintListProps {
  constraints: ConstraintCheck[];
}

export function ConstraintList({ constraints }: ConstraintListProps) {
  if (constraints.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Constraints Checked
      </h4>
      <div className="space-y-1">
        {constraints.map((check, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {check.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            )}
            <span className={check.passed ? 'text-muted-foreground' : 'text-red-400'}>
              {check.name}
              {check.message && ` — ${check.message}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Risks ─────────────────────────────────────────────────────────

interface RiskListProps {
  risks: RiskFactor[];
}

const severityColors = {
  low: 'border-emerald-500/30 bg-emerald-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  high: 'border-red-500/30 bg-red-500/5',
} as const;

const severityTextColors = {
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
} as const;

export function RiskList({ risks }: RiskListProps) {
  if (risks.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Risks
      </h4>
      <div className="space-y-1.5">
        {risks.map((risk, i) => (
          <div
            key={i}
            className={cn('rounded-md border px-2.5 py-1.5 text-xs', severityColors[risk.severity])}
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle
                className={cn('h-3 w-3 shrink-0', severityTextColors[risk.severity])}
              />
              <span className={cn('font-medium', severityTextColors[risk.severity])}>
                {risk.name}
              </span>
            </div>
            <p className="mt-0.5 pl-[18px] text-muted-foreground">{risk.description}</p>
            {risk.mitigation && (
              <div className="mt-1 flex items-start gap-1 pl-[18px] text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
                <span>{risk.mitigation}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Alternatives ──────────────────────────────────────────────────

interface AlternativeListProps {
  alternatives: Alternative[];
}

export function AlternativeList({ alternatives }: AlternativeListProps) {
  if (alternatives.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Alternatives Considered
      </h4>
      <div className="space-y-1">
        {alternatives.map((alt, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Minus className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              <span className="font-medium">{alt.name}</span> — {alt.reason_rejected}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
