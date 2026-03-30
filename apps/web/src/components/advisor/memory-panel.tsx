'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAdvisorPreferencesQuery } from '@/hooks/queries/use-advisor-preferences-query';
import { useAdvisorMemoryEventsQuery } from '@/hooks/queries/use-advisor-memory-events-query';
import {
  useConfirmPreferenceMutation,
  useDismissPreferenceMutation,
  useDeletePreferenceMutation,
  useUpdatePreferenceMutation,
  useCreatePreferenceMutation,
} from '@/hooks/mutations/use-advisor-preference-mutations';
import { toast } from 'sonner';
import { PreferenceCard } from './preference-card';
import { PendingConfirmations } from './pending-confirmations';
import { MemoryTimeline } from './memory-timeline';
import { Brain, Plus, ChevronDown } from 'lucide-react';
import type { AdvisorPreference, PreferenceCategory } from '@sentinel/shared';
import { PREFERENCE_CATEGORY_LABELS } from '@sentinel/shared';

// ─── Add Preference Form ───────────────────────────────────────────

function AddPreferenceForm({ onDone }: { onDone: () => void }) {
  const createMutation = useCreatePreferenceMutation();
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [category, setCategory] = useState<PreferenceCategory>('general');

  const categories = Object.keys(PREFERENCE_CATEGORY_LABELS) as PreferenceCategory[];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    createMutation.mutate(
      {
        category,
        content: content.trim(),
        context: context.trim() || undefined,
        source: 'explicit',
      },
      {
        onSuccess: () => {
          toast.success('Preference saved');
          onDone();
        },
        onError: () => toast.error('Failed to save preference'),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-card p-3">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="e.g., Avoid biotech stocks"
        className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        autoFocus
      />
      <input
        type="text"
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="Context (optional): e.g., Had bad experience with MRNA"
        className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground focus:border-primary focus:outline-none"
      />
      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn(
              'rounded border px-2 py-0.5 text-[10px] transition-colors',
              category === cat
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50',
            )}
          >
            {PREFERENCE_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="xs" type="submit" disabled={createMutation.isPending || !content.trim()}>
          Save Preference
        </Button>
        <Button size="xs" variant="ghost" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Main Memory Panel ─────────────────────────────────────────────

export function MemoryPanel({ className }: { className?: string | undefined }) {
  const { data: prefsData, isLoading: prefsLoading } = useAdvisorPreferencesQuery();
  const { data: eventsData, isLoading: eventsLoading } = useAdvisorMemoryEventsQuery();
  const confirmMutation = useConfirmPreferenceMutation();
  const dismissMutation = useDismissPreferenceMutation();
  const deleteMutation = useDeletePreferenceMutation();
  const updateMutation = useUpdatePreferenceMutation();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const allPrefs = prefsData?.preferences ?? [];
  const pendingPrefs = allPrefs.filter((p) => p.status === 'pending_confirmation');
  const activePrefs = allPrefs.filter((p) => p.status === 'active');
  const events = eventsData?.events ?? [];

  const isMutating =
    confirmMutation.isPending ||
    dismissMutation.isPending ||
    deleteMutation.isPending ||
    updateMutation.isPending;

  function handleConfirm(id: string) {
    confirmMutation.mutate(id, {
      onSuccess: () => toast.success('Preference confirmed'),
      onError: () => toast.error('Failed to confirm'),
    });
  }

  function handleDismiss(id: string) {
    dismissMutation.mutate(id, {
      onSuccess: () => toast.info('Preference dismissed'),
      onError: () => toast.error('Failed to dismiss'),
    });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Preference removed'),
      onError: () => toast.error('Failed to remove'),
    });
  }

  function handleEdit(
    id: string,
    update: { content?: string | undefined; context?: string | undefined },
  ) {
    updateMutation.mutate(
      { id, update },
      {
        onSuccess: () => toast.success('Preference updated'),
        onError: () => toast.error('Failed to update'),
      },
    );
  }

  // Group active prefs by category
  const grouped = activePrefs.reduce<Record<string, AdvisorPreference[]>>((acc, p) => {
    const cat = p.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  if (prefsLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-5 w-32 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 rounded bg-muted" />
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
            <Brain className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Advisor Memory</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {activePrefs.length} active
            </Badge>
            {pendingPrefs.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {pendingPrefs.length} pending
              </Badge>
            )}
          </div>
          <Button size="xs" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        {showAddForm && <AddPreferenceForm onDone={() => setShowAddForm(false)} />}

        {/* Pending confirmations */}
        <PendingConfirmations
          preferences={pendingPrefs}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
          onEdit={handleEdit}
          isPending={isMutating}
        />

        {/* Active preferences grouped by category */}
        {Object.entries(grouped).map(([cat, prefs]) => (
          <div key={cat} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {PREFERENCE_CATEGORY_LABELS[cat as PreferenceCategory] ?? cat}
            </h4>
            <div className="space-y-1.5">
              {prefs.map((pref) => (
                <PreferenceCard
                  key={pref.id}
                  preference={pref}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isPending={isMutating}
                />
              ))}
            </div>
          </div>
        ))}

        {activePrefs.length === 0 && pendingPrefs.length === 0 && !showAddForm && (
          <p className="text-center text-xs text-muted-foreground italic py-4">
            No preferences yet. Add your first one or let the advisor learn from conversations.
          </p>
        )}

        {/* Memory Timeline */}
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', showTimeline && 'rotate-180')}
            />
            Memory Timeline ({events.length} events)
          </button>
          {showTimeline && (
            <div className="mt-2">
              <MemoryTimeline events={events.slice(0, 20)} isLoading={eventsLoading} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
