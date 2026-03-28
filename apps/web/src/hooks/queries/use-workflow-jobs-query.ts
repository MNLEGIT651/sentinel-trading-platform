'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  WorkflowJob,
  WorkflowJobsFilters,
  WorkflowStepLog,
  WorkflowStats,
} from '@sentinel/shared';

interface WorkflowJobsResponse {
  data: WorkflowJob[];
  total: number;
  stats: WorkflowStats;
}

interface WorkflowStepsResponse {
  data: WorkflowStepLog[];
}

const WORKFLOW_KEY = 'workflow-jobs';

export function useWorkflowJobsQuery(filters?: WorkflowJobsFilters) {
  return useQuery<WorkflowJobsResponse>({
    queryKey: [WORKFLOW_KEY, 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.workflow_type) params.set('workflow_type', filters.workflow_type);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.limit != null) params.set('limit', String(filters.limit));
      if (filters?.offset != null) params.set('offset', String(filters.offset));

      const qs = params.toString();
      const res = await fetch(`/api/workflows${qs ? `?${qs}` : ''}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to fetch workflow jobs');
      }
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useWorkflowStepsQuery(jobId: string) {
  return useQuery<WorkflowStepsResponse>({
    queryKey: [WORKFLOW_KEY, 'steps', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${jobId}/steps`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Failed to fetch workflow steps');
      }
      return res.json();
    },
    staleTime: 5_000,
    enabled: !!jobId,
  });
}
