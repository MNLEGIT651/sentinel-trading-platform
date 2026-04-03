'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { AdvisorMessage } from '@sentinel/shared';

interface MessagesResponse {
  messages: AdvisorMessage[];
  total: number;
}

async function fetchMessages(threadId: string): Promise<MessagesResponse> {
  const res = await fetch(`/api/advisor/threads/${threadId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export function useAdvisorMessagesQuery(threadId: string | null) {
  return useQuery({
    queryKey: queryKeys.advisor.threads.messages(threadId ?? ''),
    queryFn: () => fetchMessages(threadId!),
    enabled: !!threadId,
    retry: 2,
  });
}
