'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, Sparkles } from 'lucide-react';
import { ConfidenceMeter } from './confidence-meter';
import {
  FactorList,
  PreferencesUsed,
  ConstraintList,
  RiskList,
  AlternativeList,
} from './explanation-factors';
import type { ExplanationPayload } from '@sentinel/shared';

export interface ExplanationCardProps {
  explanation: ExplanationPayload | null | undefined;
  isLoading?: boolean | undefined;
  className?: string | undefined;
}

export function ExplanationCard({ explanation, isLoading, className }: ExplanationCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader className="cursor-pointer">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-36 rounded bg-muted" />
          </div>
        </CardHeader>
      </Card>
    );
  }

  if (!explanation) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Why this suggestion
          </CardTitle>
          <div className="flex items-center gap-2">
            <ConfidenceMeter
              confidence={explanation.confidence}
              label={explanation.confidence_label}
              size="sm"
            />
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180',
              )}
            />
          </div>
        </div>
        {!expanded && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{explanation.summary}</p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Summary */}
          <p className="text-sm text-foreground">{explanation.summary}</p>

          {/* Primary Factors */}
          <FactorList factors={explanation.primary_factors} />

          {/* User Preferences Used */}
          <PreferencesUsed preferences={explanation.user_preferences_used} />

          {/* Constraints */}
          <ConstraintList constraints={explanation.constraints_checked} />

          {/* Risks */}
          <RiskList risks={explanation.risks} />

          {/* Alternatives */}
          <AlternativeList alternatives={explanation.alternatives_considered} />

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/50 pt-3 text-[10px] text-muted-foreground">
            <span>Generated {new Date(explanation.generated_at).toLocaleDateString()}</span>
            <Badge variant="outline" className="text-[10px]">
              v{explanation.confidence_label}
            </Badge>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
