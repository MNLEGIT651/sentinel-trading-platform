'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, WifiOff } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProfileEditor } from '@/components/advisor/profile-editor';
import { MemoryPanel } from '@/components/advisor/memory-panel';
import { ThreadList } from '@/components/advisor/thread-list';
import { ThreadMessages } from '@/components/advisor/thread-messages';
import { useAppStore } from '@/stores/app-store';
import { useAdvisorThreadsQuery } from '@/hooks/queries/use-advisor-threads-query';
import type { AdvisorThread } from '@sentinel/shared';

export default function AdvisorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  const threadIdParam = searchParams.get('threadId');
  const tabParam = searchParams.get('tab');

  const { data: threadsData } = useAdvisorThreadsQuery();

  const threads = threadsData?.threads;

  // Derive selected thread from URL param + loaded threads data
  const selectedThread = useMemo<AdvisorThread | null>(() => {
    if (!threadIdParam || !threads) return null;
    return threads.find((t) => t.id === threadIdParam) ?? null;
  }, [threadIdParam, threads]);

  const [activeTab, setActiveTab] = useState(
    tabParam === 'conversations' ? 'conversations' : 'memory',
  );

  // Clean up invalid threadId from URL
  useEffect(() => {
    if (threadIdParam && threads) {
      const exists = threads.some((t) => t.id === threadIdParam);
      if (!exists) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('threadId');
        router.replace(`?${params.toString()}`, { scroll: false });
      }
    }
  }, [threadIdParam, threads, searchParams, router]);

  const setSelectedThread = useCallback(
    (thread: AdvisorThread | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (thread) {
        params.set('threadId', thread.id);
        params.set('tab', 'conversations');
      } else {
        params.delete('threadId');
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const handleBack = useCallback(() => {
    setSelectedThread(null);
  }, [setSelectedThread]);

  const handleTabChange = useCallback(
    (value: string | number | null) => {
      const tab = String(value ?? 'memory');
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      if (tab !== 'conversations') {
        params.delete('threadId');
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-heading-page text-foreground">Advisor</h1>
            <Badge
              variant="outline"
              className={
                agentsOnline
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[10px]'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-600 text-[10px]'
              }
            >
              {agentsOnline ? 'Agents Online' : 'Agents Offline'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Your profile, preferences, and conversation history
          </p>
        </div>
      </div>

      {agentsOnline === false && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Agent service unavailable
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
              You can browse existing conversations but new messages may fail to send.
            </p>
          </div>
        </div>
      )}

      <ProfileEditor />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList variant="line">
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
        </TabsList>

        <TabsContent value="memory" className="mt-4">
          <MemoryPanel />
        </TabsContent>

        <TabsContent value="conversations" className="mt-4">
          {selectedThread ? (
            <ThreadMessages
              threadId={selectedThread.id}
              threadTitle={selectedThread.title}
              onBack={handleBack}
              className="min-h-[400px]"
            />
          ) : (
            <ThreadList
              selectedThreadId={threadIdParam ?? undefined}
              onSelectThread={setSelectedThread}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
