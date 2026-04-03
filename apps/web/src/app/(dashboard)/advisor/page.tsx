'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProfileEditor } from '@/components/advisor/profile-editor';
import { MemoryPanel } from '@/components/advisor/memory-panel';
import { ThreadList } from '@/components/advisor/thread-list';
import { ThreadMessages } from '@/components/advisor/thread-messages';
import { useAppStore } from '@/stores/app-store';
import type { AdvisorThread } from '@sentinel/shared';

export default function AdvisorPage() {
  const [selectedThread, setSelectedThread] = useState<AdvisorThread | null>(null);
  const agentsOnline = useAppStore((s) => s.agentsOnline);

  return (
    <div className="space-y-6">
      {/* Page header */}
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

      {/* Profile */}
      <ProfileEditor />

      {/* Tabs: Memory / Conversations */}
      <Tabs defaultValue="memory">
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
              onBack={() => setSelectedThread(null)}
              className="min-h-[400px]"
            />
          ) : (
            <ThreadList onSelectThread={setSelectedThread} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
