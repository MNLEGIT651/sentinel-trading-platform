'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ConfidenceMeter } from './confidence-meter';
import { Pencil, Trash2, Check, X, Save, MessageSquare } from 'lucide-react';
import type { AdvisorPreference, PreferenceCategory } from '@sentinel/shared';
import { PREFERENCE_CATEGORY_LABELS, PREFERENCE_SOURCE_LABELS } from '@sentinel/shared';

interface PreferenceCardProps {
  preference: AdvisorPreference;
  onConfirm?: ((id: string) => void) | undefined;
  onDismiss?: ((id: string) => void) | undefined;
  onDelete?: ((id: string) => void) | undefined;
  onEdit?:
    | ((id: string, update: { content?: string | undefined; context?: string | undefined }) => void)
    | undefined;
  isPending?: boolean | undefined;
}

const sourceBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  explicit: 'default',
  inferred: 'secondary',
  system: 'outline',
};

export function PreferenceCard({
  preference,
  onConfirm,
  onDismiss,
  onDelete,
  onEdit,
  isPending = false,
}: PreferenceCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(preference.content);
  const [draftContext, setDraftContext] = useState(preference.context ?? '');
  const isConfirmable = preference.status === 'pending_confirmation';

  function handleSave() {
    onEdit?.(preference.id, {
      content: draftContent,
      context: draftContext || undefined,
    });
    setEditing(false);
  }

  function handleCancel() {
    setDraftContent(preference.content);
    setDraftContext(preference.context ?? '');
    setEditing(false);
  }

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 transition-colors',
        isConfirmable ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                value={draftContext}
                onChange={(e) => setDraftContext(e.target.value)}
                placeholder="Context (optional)..."
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground focus:border-primary focus:outline-none"
              />
              <div className="flex gap-1">
                <Button size="xs" onClick={handleSave} disabled={isPending}>
                  <Save className="mr-1 h-3 w-3" />
                  Save
                </Button>
                <Button size="xs" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">{preference.content}</p>
              {preference.context && (
                <p className="mt-0.5 text-xs text-muted-foreground">{preference.context}</p>
              )}
            </>
          )}
        </div>

        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            {isConfirmable && onConfirm && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => onConfirm(preference.id)}
                disabled={isPending}
                title="Confirm"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              </Button>
            )}
            {isConfirmable && onDismiss && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => onDismiss(preference.id)}
                disabled={isPending}
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5 text-red-400" />
              </Button>
            )}
            {onEdit && (
              <Button size="icon-xs" variant="ghost" onClick={() => setEditing(true)} title="Edit">
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => onDelete(preference.id)}
                disabled={isPending}
                title="Delete"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Metadata row */}
      {!editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {PREFERENCE_CATEGORY_LABELS[preference.category as PreferenceCategory] ??
              preference.category}
          </Badge>
          <Badge
            variant={sourceBadgeVariant[preference.source] ?? 'outline'}
            className="text-[10px]"
          >
            {PREFERENCE_SOURCE_LABELS[preference.source as keyof typeof PREFERENCE_SOURCE_LABELS] ??
              preference.source}
          </Badge>
          <ConfidenceMeter confidence={preference.confidence} size="sm" showLabel={false} />
          {preference.originating_message_id && (
            <span title="From conversation">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
