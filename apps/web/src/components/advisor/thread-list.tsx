'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAdvisorThreadsQuery } from '@/hooks/queries/use-advisor-threads-query';
import {
  useCreateThreadMutation,
  useDeleteThreadMutation,
} from '@/hooks/mutations/use-advisor-thread-mutations';
import { toast } from 'sonner';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import type { AdvisorThread } from '@sentinel/shared';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface ThreadListProps {
  selectedThreadId?: string | null | undefined;
  onSelectThread: (thread: AdvisorThread) => void;
  className?: string | undefined;
}

export function ThreadList({ selectedThreadId, onSelectThread, className }: ThreadListProps) {
  const { data, isLoading } = useAdvisorThreadsQuery();
  const createMutation = useCreateThreadMutation();
  const deleteMutation = useDeleteThreadMutation();

  const threads = data?.threads ?? [];

  function handleCreate() {
    createMutation.mutate(
      {},
      {
        onSuccess: (thread) => {
          toast.success('Thread created');
          onSelectThread(thread);
        },
        onError: () => toast.error('Failed to create thread'),
      },
    );
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Thread deleted'),
      onError: () => toast.error('Failed to delete thread'),
    });
  }

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-5 w-36 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Conversations</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {threads.length}
            </Badge>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            <Plus className="mr-1 h-3 w-3" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground italic py-4">
            No conversations yet. Start one to begin.
          </p>
        ) : (
          <div className="space-y-1">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => onSelectThread(thread)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors',
                  selectedThreadId === thread.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted border border-transparent',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{thread.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{thread.message_count} messages</span>
                    <span>·</span>
                    <span>{formatRelativeTime(thread.last_activity)}</span>
                  </div>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={(e) => handleDelete(e, thread.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
