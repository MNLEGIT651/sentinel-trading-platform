'use client';

import { AlertTriangle } from 'lucide-react';
import { PreferenceCard } from './preference-card';
import type { AdvisorPreference } from '@sentinel/shared';

interface PendingConfirmationsProps {
  preferences: AdvisorPreference[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onEdit: (
    id: string,
    update: { content?: string | undefined; context?: string | undefined },
  ) => void;
  isPending?: boolean | undefined;
}

export function PendingConfirmations({
  preferences,
  onConfirm,
  onDismiss,
  onEdit,
  isPending,
}: PendingConfirmationsProps) {
  if (preferences.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-foreground">Pending Confirmations</h3>
        <span className="text-xs text-muted-foreground">
          The advisor learned these from your conversations. Confirm or dismiss.
        </span>
      </div>
      <div className="space-y-2">
        {preferences.map((pref) => (
          <PreferenceCard
            key={pref.id}
            preference={pref}
            onConfirm={onConfirm}
            onDismiss={onDismiss}
            onEdit={onEdit}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  );
}
