'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProfileEditor } from '@/components/advisor/profile-editor';
import { MemoryPanel } from '@/components/advisor/memory-panel';
import { ThreadList } from '@/components/advisor/thread-list';
import { ThreadMessages } from '@/components/advisor/thread-messages';
import type { AdvisorThread } from '@sentinel/shared';

export default function AdvisorPage() {
  const [selectedThread, setSelectedThread] = useState<AdvisorThread | null>(null);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-heading-page text-foreground">Advisor</h1>
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
