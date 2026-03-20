'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Play, Pause, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useAppStore } from '@/stores/app-store';
import { agentsClient, type OrchestratorStatus } from '@/lib/agents-client';
import { AgentStatusCard } from '@/components/agents/agent-status-card';
import { RecommendationCard } from '@/components/agents/recommendation-card';
import { AgentAlertFeed } from '@/components/agents/agent-alert-feed';
import { agentDefs } from '@/components/agents/agent-defs';

export default function AgentsPage() {
  const agentsOnline = useAppStore((s) => s.agentsOnline);
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [recommendations, setRecommendations] = useState<
    Awaited<ReturnType<typeof agentsClient.getRecommendations>>['recommendations']
  >([]);
  const [alerts, setAlerts] = useState<
    Awaited<ReturnType<typeof agentsClient.getAlerts>>['alerts']
  >([]);
  const [isOffline, setIsOffline] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [cycleTriggering, setCycleTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, r, a] = await Promise.all([
        agentsClient.getStatus(),
        agentsClient.getRecommendations('pending'),
        agentsClient.getAlerts(),
      ]);
      setStatus(s);
      setRecommendations(r.recommendations);
      setAlerts(a.alerts);
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 5_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchAll]);

  const handleRunCycle = async () => {
    setCycleTriggering(true);
    try {
      await agentsClient.runCycle();
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start cycle');
    } finally {
      setCycleTriggering(false);
    }
  };

  const handleHalt = async () => {
    try {
      await agentsClient.halt();
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to halt agents');
    }
  };

  const handleResume = async () => {
    try {
      await agentsClient.resume();
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resume agents');
    }
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await agentsClient.approveRecommendation(id);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try {
      await agentsClient.rejectRecommendation(id);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setRejectingId(null);
    }
  };

  const isRunning = status?.isRunning ?? false;
  const isHalted = status?.halted ?? false;
  const cycleCount = status?.cycleCount ?? 0;

  return (
    <div className="space-y-4 p-4">
      {agentsOnline === false && <OfflineBanner service="agents" />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Agents</h1>
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
          {isOffline && (
            <Badge className="border bg-muted text-muted-foreground border-border/50 mr-1 text-[10px]">
              Offline
            </Badge>
          )}
          {status?.nextCycleAt && !isHalted && !isOffline && (
            <Badge className="border bg-primary/10 text-primary border-primary/20 mr-1 text-[10px]">
              Scheduled
            </Badge>
          )}
          {isHalted && (
            <Badge className="border bg-loss/15 text-loss border-loss/30 mr-2">
              <AlertTriangle className="mr-1 h-3 w-3" />
              HALTED
            </Badge>
          )}
          <Button
            onClick={isHalted ? handleResume : handleRunCycle}
            disabled={isRunning || cycleTriggering}
            variant="default"
            size="sm"
          >
            {isRunning || cycleTriggering ? (
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
          <Button onClick={handleHalt} disabled={isHalted || isRunning} variant="outline" size="sm">
            <Pause className="h-4 w-4" />
            <span className="ml-1.5">Halt</span>
          </Button>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agentDefs.map((agent) => {
          const agentStatus = status?.agents[agent.role];
          return (
            <AgentStatusCard
              key={agent.role}
              role={agent.role}
              name={agent.name}
              description={agent.description}
              icon={agent.icon}
              color={agent.color}
              badgeClass={agent.badgeClass}
              {...(agentStatus !== undefined && { agentStatus })}
              isOffline={isOffline}
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

      <AgentAlertFeed alerts={alerts} isOffline={isOffline} />
    </div>
  );
}
