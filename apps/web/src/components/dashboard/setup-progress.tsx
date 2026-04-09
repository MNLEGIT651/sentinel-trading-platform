'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { Check, Circle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOnboardingProfile } from '@/hooks/use-onboarding';
import { SETUP_STEPS, TOTAL_SETUP_STEPS } from '@/lib/constants';

const DISMISSED_KEY = 'sentinel_setup_dismissed';

/** Call this from other pages to mark them as visited. */
export function markPageVisited(page: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`sentinel_visited_${page}`, 'true');
  }
}

/** Read completed step ids from localStorage. */
function getSnapshot(): string {
  const ids: string[] = [];
  for (const step of SETUP_STEPS) {
    if ('alwaysComplete' in step) {
      ids.push(step.id);
    } else if ('storageKey' in step && localStorage.getItem(step.storageKey) === 'true') {
      ids.push(step.id);
    }
  }
  const dismissed = localStorage.getItem(DISMISSED_KEY) === 'true' ? '|dismissed' : '';
  return ids.join(',') + dismissed;
}

function getServerSnapshot(): string {
  return '';
}

function subscribe(onStoreChange: () => void): () => void {
  // Re-check when the tab regains focus (user may have visited another page)
  window.addEventListener('focus', onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener('focus', onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function SetupProgress() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { data: profile } = useOnboardingProfile();

  const dismissed = raw.includes('|dismissed');
  const completedIds = new Set(raw.replace('|dismissed', '').split(',').filter(Boolean));

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    window.dispatchEvent(new Event('storage'));
  }, []);

  // SSR: raw is '' from server snapshot, so nothing renders
  if (!raw || dismissed) return null;

  // Hide while onboarding wizard is active (user hasn't finished onboarding yet)
  if (!profile || profile.onboarding_step === 'app_account_created') return null;

  // SSR: raw is '' from server snapshot, so nothing renders
  if (!raw || dismissed) return null;

  const completedCount = completedIds.size;
  const allComplete = completedCount === TOTAL_SETUP_STEPS;
  const progressPct = Math.round((completedCount / TOTAL_SETUP_STEPS) * 100);

  return (
    <Card className="border-border bg-card/70">
      <CardHeader className="relative pb-0">
        <CardTitle className="text-sm font-medium">Setup Progress</CardTitle>
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss setup progress"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {allComplete ? (
          <p className="text-center text-sm font-medium">Setup complete.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {TOTAL_SETUP_STEPS} complete
            </p>

            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${String(progressPct)}%` }}
              />
            </div>

            {/* Step checklist */}
            <ul className="space-y-1.5">
              {SETUP_STEPS.map((step) => {
                const done = completedIds.has(step.id);
                return (
                  <li key={step.id} className="flex items-center gap-2 text-xs">
                    {done ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-profit" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className={cn(done && 'text-muted-foreground line-through')}>
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
