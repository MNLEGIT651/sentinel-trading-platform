'use client';

import { useState, useCallback } from 'react';
import { Shield, AlertOctagon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useSystemControlsQuery,
  useUpdateSystemControlsMutation,
} from '@/hooks/queries/use-system-controls-query';
import type { AutonomyMode } from '@sentinel/shared';
import { cn } from '@/lib/utils';
import { AUTONOMY_MODES, MODE_CONFIG, MODE_ICONS, formatTimestamp } from './mode-config';
import { ConfirmDialog } from './confirm-dialog';

export function SystemAutonomyCard() {
  const { data: controls, isLoading, isError } = useSystemControlsQuery();
  const updateMutation = useUpdateSystemControlsMutation();
  const [selectedMode, setSelectedMode] = useState<AutonomyMode | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentMode = (controls?.autonomy_mode ?? 'alert_only') as AutonomyMode;
  const previousMode = controls?.previous_autonomy_mode as AutonomyMode | null;
  const isDowngraded = previousMode && previousMode !== currentMode;

  const handleModeChange = useCallback(
    (mode: AutonomyMode) => {
      if (mode === currentMode) return;
      setSelectedMode(mode);
      setShowConfirm(true);
    },
    [currentMode],
  );

  const confirmChange = useCallback(() => {
    if (!selectedMode) return;
    updateMutation.mutate(
      { autonomy_mode: selectedMode },
      {
        onSettled: () => {
          setShowConfirm(false);
          setSelectedMode(null);
        },
      },
    );
  }, [selectedMode, updateMutation]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">Failed to load system controls</p>
        </CardContent>
      </Card>
    );
  }

  const modeConf = MODE_CONFIG[currentMode];
  const ModeIcon = MODE_ICONS[currentMode];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            System Autonomy Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current mode display */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  modeConf.bgClass,
                )}
              >
                <ModeIcon className={cn('h-5 w-5', modeConf.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', modeConf.color)}>{modeConf.label}</span>
                  <Badge className={cn('border text-[10px]', modeConf.bgClass)}>
                    {currentMode}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{modeConf.description}</p>
              </div>
            </div>
          </div>

          {/* Downgraded warning */}
          {isDowngraded && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertOctagon className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="text-xs text-amber-300">
                Downgraded from{' '}
                <span className="font-semibold">
                  {MODE_CONFIG[previousMode]?.label ?? previousMode}
                </span>{' '}
                due to incident fallback
              </span>
            </div>
          )}

          {/* Mode selector */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Change System Mode</p>
            <div className="flex flex-wrap gap-2">
              {AUTONOMY_MODES.map((mode) => {
                const conf = MODE_CONFIG[mode];
                const Icon = MODE_ICONS[mode];
                const isActive = mode === currentMode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleModeChange(mode)}
                    disabled={isActive || updateMutation.isPending}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
                      isActive
                        ? cn(conf.bgClass, 'ring-1 ring-current')
                        : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-50',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Last updated */}
          {controls?.updated_at && (
            <p className="text-[10px] text-muted-foreground">
              Last updated: {formatTimestamp(controls.updated_at)}
              {controls.updated_by && ` by ${controls.updated_by.slice(0, 8)}…`}
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showConfirm}
        title="Change Autonomy Mode"
        description={`Change system autonomy from "${MODE_CONFIG[currentMode].label}" to "${selectedMode ? MODE_CONFIG[selectedMode].label : ''}"? This affects how the system handles recommendations globally.`}
        confirmLabel="Confirm Change"
        loading={updateMutation.isPending}
        onConfirm={confirmChange}
        onCancel={() => {
          setShowConfirm(false);
          setSelectedMode(null);
        }}
      />
    </>
  );
}
