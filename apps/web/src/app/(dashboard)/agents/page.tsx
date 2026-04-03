'use client';

import { Bot, Play, Pause, RefreshCw, Loader2, WifiOff, History, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { StatusBadge, type StatusType } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  useWorkflowJobsQuery,
} from '@/hooks/queries';

export default function AgentsPage() {
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  // TanStack Query hooks (auto-poll at 5s)
  const { data: status, isError: statusError, isLoading: statusLoading } = useAgentStatusQuery();
  const { data: recommendations = [] } = useRecommendationsQuery('pending', 5_000);
  const { data: alerts = [] } = useAlertsQuery(5_000);
  const { data: recentCycles } = useWorkflowJobsQuery({
    workflow_type: 'agent_cycle',
    limit: 5,
    sort_by: 'created_at',
    sort_direction: 'desc',
  });

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Bot className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="text-heading-page text-foreground">AI Agents</h1>
            <p className="text-xs text-muted-foreground truncate">
              {cycleCount} cycles &middot; 5 agents
              {status?.nextCycleAt && !isHalted && (
                <span className="ml-1">
                  &middot; next{' '}
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
          {isHalted && <StatusBadge status="error" label="HALTED" className="mr-1" />}
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

      {/* Recent Cycles */}
      {recentCycles?.data && recentCycles.data.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Cycles
            </CardTitle>
            <Link
              href="/workflows"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              View All <ExternalLink className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {recentCycles.data.map((job) => {
                const statusMap: Record<string, StatusType> = {
                  completed: 'success',
                  running: 'active',
                  pending: 'pending',
                  failed: 'error',
                  retrying: 'pending',
                  cancelled: 'idle',
                };
                const durationMs =
                  job.completed_at && job.started_at
                    ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
                    : null;
                return (
                  <div key={job.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={statusMap[job.status] ?? 'idle'} label={job.status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {durationMs != null && <span>{(durationMs / 1000).toFixed(1)}s</span>}
                      {job.error_message && (
                        <span
                          className="text-loss truncate max-w-[200px]"
                          title={job.error_message}
                        >
                          {job.error_message}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <AgentAlertFeed alerts={alerts} isOffline={!!isOffline} />
    </div>
  );
}
