'use client';

import { Bot, Play, Pause, RefreshCw, Loader2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useAppStore } from '@/stores/app-store';
import { AgentStatusCard } from '@/components/agents/agent-status-card';
import { RecommendationCard } from '@/components/agents/recommendation-card';
import { AgentAlertFeed } from '@/components/agents/agent-alert-feed';
import { agentDefs } from '@/components/agents/agent-defs';
import {
  useAgentStatusQuery,
  useRecommendationsQuery,
  useAlertsQuery,
  useTriggerCycleMutation,
  useHaltMutation,
  useResumeMutation,
  useApproveRecommendationMutation,
  useRejectRecommendationMutation,
} from '@/hooks/queries';

export default function AgentsPage() {
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  // TanStack Query hooks (auto-poll at 5s)
  const { data: status, isError: statusError, isLoading: statusLoading } = useAgentStatusQuery();
  const { data: recommendations = [] } = useRecommendationsQuery('pending', 5_000);
  const { data: alerts = [] } = useAlertsQuery(5_000);

  // Mutation hooks
  const cycleMutation = useTriggerCycleMutation();
  const haltMutation = useHaltMutation();
  const resumeMutation = useResumeMutation();
  const approveMutation = useApproveRecommendationMutation();
  const rejectMutation = useRejectRecommendationMutation();

  const isOffline = agentsOnline === false || (agentsOnline === true && statusError);
  const isRunning = status?.isRunning ?? false;
  const isHalted = status?.halted ?? false;
  const cycleCount = status?.cycleCount ?? 0;
  const controlsDisabled = agentsOnline !== true || !!isOffline;

  const approvingId = approveMutation.isPending ? (approveMutation.variables ?? null) : null;
  const rejectingId = rejectMutation.isPending ? (rejectMutation.variables?.id ?? null) : null;

  const handleRunCycle = () => {
    cycleMutation.mutate(undefined, {
      onSuccess: () => toast.success('Agent cycle started'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to start cycle'),
    });
  };

  const handleHalt = () => {
    haltMutation.mutate(undefined, {
      onSuccess: () => toast.success('Agents halted'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to halt agents'),
    });
  };

  const handleResume = () => {
    resumeMutation.mutate(undefined, {
      onSuccess: () => toast.success('Agents resumed'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to resume agents'),
    });
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: () => toast.success('Recommendation approved'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Approve failed'),
    });
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(
      { id },
      {
        onSuccess: () => toast.success('Recommendation rejected'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Reject failed'),
      },
    );
  };

  return (
    <div className="space-y-4 p-4">
      {agentsOnline === false && <OfflineBanner service="agents" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-heading-page text-foreground">AI Agents</h1>
            <p className="text-xs text-muted-foreground">
              {cycleCount} cycles completed &middot; 5 agents configured
              {status?.nextCycleAt && !isHalted && (
                <span className="ml-2">
                  &middot; next cycle{' '}
                  {new Date(status.nextCycleAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOffline && <StatusBadge status="idle" label="Offline" className="mr-1" />}
          {status?.nextCycleAt && !isHalted && !isOffline && (
            <StatusBadge status="pending" label="Scheduled" className="mr-1" />
          )}
          {isHalted && <StatusBadge status="error" label="HALTED" className="mr-2" />}
          <Button
            onClick={isHalted ? handleResume : handleRunCycle}
            disabled={controlsDisabled || isRunning || cycleMutation.isPending}
            variant="default"
            size="sm"
          >
            {isRunning || cycleMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-1.5">Running...</span>
              </>
            ) : isHalted ? (
              <>
                <Play className="h-4 w-4" />
                <span className="ml-1.5">Resume</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span className="ml-1.5">Run Cycle</span>
              </>
            )}
          </Button>
          <Button
            onClick={handleHalt}
            disabled={controlsDisabled || isHalted || isRunning}
            variant="outline"
            size="sm"
          >
            <Pause className="h-4 w-4" />
            <span className="ml-1.5">Halt</span>
          </Button>
        </div>
      </div>

      {/* Offline guidance — only when the service is confirmed unreachable */}
      {agentsOnline === false && (
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="flex items-start gap-3 py-4 px-4">
            <Bot className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                The agents service is not running.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Start it with:{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  pnpm --filter agents dev
                </code>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status query error — service is online but the status call failed */}
      {agentsOnline === true && statusError && !statusLoading && (
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <WifiOff className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              Unable to load agent status. The service may be restarting — retrying automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agentDefs.map((agent) => {
          const agentStatus = status?.agents[agent.role];
          return (
            <AgentStatusCard
              key={agent.role}
              agentRole={agent.role}
              name={agent.name}
              description={agent.description}
              icon={agent.icon}
              color={agent.color}
              badgeClass={agent.badgeClass}
              {...(agentStatus !== undefined && { agentStatus })}
              isOffline={!!isOffline}
            />
          );
        })}
      </div>

      <RecommendationCard
        recommendations={recommendations}
        approvingId={approvingId}
        rejectingId={rejectingId}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <AgentAlertFeed alerts={alerts} isOffline={!!isOffline} />
    </div>
  );
}
