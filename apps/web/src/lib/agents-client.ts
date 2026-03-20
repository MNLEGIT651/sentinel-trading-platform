/**
 * Typed HTTP client for the same-origin Next.js agents proxy.
 * Used by the web app to interact with the agent orchestrator.
 */

const AGENTS_PROXY_BASE = '/api/agents';

// ── Response types ─────────────────────────────────────────────────

export interface AgentStatusEntry {
  status: 'idle' | 'running' | 'error' | 'cooldown';
  lastRun: string | null;
}

export interface OrchestratorStatus {
  agents: Record<string, AgentStatusEntry>;
  cycleCount: number;
  halted: boolean;
  isRunning: boolean;
  nextCycleAt: string | null;
  lastCycleAt: string | null;
}

export interface TradeRecommendation {
  id: string;
  created_at: string;
  agent_role: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  order_type: 'market' | 'limit';
  limit_price?: number | null;
  reason?: string;
  strategy_name?: string;
  signal_strength?: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'filled' | 'risk_blocked';
  order_id?: string | null;
}

export interface AgentAlert {
  id: string;
  created_at: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  ticker?: string | null;
  acknowledged: boolean;
}

export interface ApproveResult {
  orderId: string;
  status: string;
  fill_price?: number;
}

// ── Error class ────────────────────────────────────────────────────

export class AgentsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'AgentsApiError';
  }
}

// ── Internal fetch wrapper ─────────────────────────────────────────

async function agentsFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${AGENTS_PROXY_BASE}${normalizedPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new AgentsApiError(
      `Agents API ${res.status}: ${body.error ?? res.statusText}`,
      res.status,
      body,
    );
  }

  return res.json() as Promise<T>;
}

// ── Client ─────────────────────────────────────────────────────────

export const agentsClient = {
  /** Full orchestrator status: agent states, cycle count, halt flag, next scheduled run. */
  getStatus(): Promise<OrchestratorStatus> {
    return agentsFetch<OrchestratorStatus>('/status');
  },

  /** Trigger an immediate agent cycle (fire-and-forget on the server side). */
  async runCycle(): Promise<void> {
    await agentsFetch<{ started: boolean }>('/cycle', { method: 'POST' });
  },

  /** Emergency halt — stops all automated trading. */
  async halt(): Promise<void> {
    await agentsFetch<{ halted: boolean }>('/halt', { method: 'POST' });
  },

  /** Clear the halt flag and resume automated cycles. */
  async resume(): Promise<void> {
    await agentsFetch<{ halted: boolean }>('/resume', { method: 'POST' });
  },

  /**
   * List trade recommendations.
   * @param status Filter by status (default: 'pending'). Pass 'all' for everything.
   */
  getRecommendations(
    status: 'pending' | 'approved' | 'rejected' | 'filled' | 'risk_blocked' | 'all' = 'pending',
  ): Promise<{ recommendations: TradeRecommendation[] }> {
    return agentsFetch<{ recommendations: TradeRecommendation[] }>(
      `/recommendations?status=${status}`,
    );
  },

  /**
   * Approve a pending recommendation and submit it to the broker.
   * Returns the broker order ID and fill details.
   */
  approveRecommendation(id: string): Promise<ApproveResult> {
    return agentsFetch<ApproveResult>(`/recommendations/${id}/approve`, {
      method: 'POST',
    });
  },

  /** Reject a pending recommendation (no order placed). */
  rejectRecommendation(id: string): Promise<{ status: string }> {
    return agentsFetch<{ status: string }>(`/recommendations/${id}/reject`, {
      method: 'POST',
    });
  },

  /** Get the 50 most recent agent-generated alerts. */
  getAlerts(): Promise<{ alerts: AgentAlert[] }> {
    return agentsFetch<{ alerts: AgentAlert[] }>('/alerts');
  },
};
