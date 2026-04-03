'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAdvisorMessagesQuery } from '@/hooks/queries/use-advisor-messages-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import { Send, Bot, User, ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import type { AdvisorMessage, AdvisorMessageCreate } from '@sentinel/shared';

async function sendMessage(threadId: string, input: AdvisorMessageCreate): Promise<AdvisorMessage> {
  const res = await fetch(`/api/advisor/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

interface ThreadMessagesProps {
  threadId: string;
  threadTitle: string;
  onBack: () => void;
  className?: string | undefined;
}

export function ThreadMessages({ threadId, threadTitle, onBack, className }: ThreadMessagesProps) {
  const { data, isLoading, isError, refetch } = useAdvisorMessagesQuery(threadId);
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [failedContent, setFailedContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(threadId, { role: 'user', content }),
    onSuccess: () => {
      setInput('');
      setFailedContent(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.advisor.threads.messages(threadId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.advisor.threads.all() });
    },
    onError: (_err, content) => {
      setFailedContent(content);
      toast.error('Failed to send message');
    },
  });

  const messages = data?.messages ?? [];

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sendMutation.isPending) return;
    setFailedContent(null);
    sendMutation.mutate(input.trim());
  }

  function handleRetry() {
    if (failedContent) {
      sendMutation.mutate(failedContent);
    }
  }

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="shrink-0">
        <div className="flex items-center gap-2">
          <Button size="icon-xs" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <CardTitle className="truncate text-sm">{threadTitle}</CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {messages.length} messages
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-end' : 'justify-start')}>
                  <div className="h-10 w-48 rounded-lg bg-muted" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-destructive">Failed to load messages</p>
              <Button size="xs" variant="outline" onClick={() => refetch()} className="gap-1.5">
                <RotateCcw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground italic py-8">
              Start the conversation by sending a message.
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role !== 'user' && (
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={cn(
                      'mt-1 text-[10px]',
                      msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground',
                    )}
                  >
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Sending indicator */}
          {sendMutation.isPending && (
            <div className="flex items-center gap-2 justify-start">
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              </div>
              <p className="text-xs text-muted-foreground italic">Sending…</p>
            </div>
          )}

          {/* Retry prompt on send failure */}
          {failedContent && !sendMutation.isPending && (
            <div className="flex items-center justify-end gap-2">
              <p className="text-xs text-destructive">Message failed to send</p>
              <Button size="xs" variant="outline" onClick={handleRetry} className="gap-1.5">
                <RotateCcw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              disabled={sendMutation.isPending}
            />
            <Button size="icon-sm" type="submit" disabled={sendMutation.isPending || !input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
