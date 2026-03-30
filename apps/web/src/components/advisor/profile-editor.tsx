'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAdvisorProfileQuery } from '@/hooks/queries/use-advisor-profile-query';
import { useAdvisorProfileMutation } from '@/hooks/mutations/use-advisor-profile-mutations';
import { toast } from 'sonner';
import { Save, Pencil, X, User } from 'lucide-react';
import type {
  AdvisorProfileData,
  RiskTolerance,
  ExperienceLevel,
  InvestmentHorizon,
  InvestmentGoal,
  AccountSizeRange,
} from '@sentinel/shared';
import { getProfileCompleteness, PROFILE_FIELDS } from '@sentinel/shared';

const RISK_OPTIONS: RiskTolerance[] = ['conservative', 'moderate', 'aggressive', 'very_aggressive'];
const EXPERIENCE_OPTIONS: ExperienceLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'professional',
];
const HORIZON_OPTIONS: InvestmentHorizon[] = ['day_trade', 'swing', 'position', 'long_term'];
const GOAL_OPTIONS: InvestmentGoal[] = ['income', 'growth', 'preservation', 'speculation'];
const SIZE_OPTIONS: AccountSizeRange[] = ['under_10k', '10k_50k', '50k_200k', '200k_1m', 'over_1m'];

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SelectFieldProps {
  label: string;
  value: string | undefined;
  options: string[];
  editing: boolean;
  onChange: (val: string) => void;
}

function SelectField({ label, value, options, editing, onChange }: SelectFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {editing ? (
        <div className="flex flex-wrap gap-1">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                'rounded-md border px-2 py-1 text-xs transition-colors',
                value === opt
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50',
              )}
            >
              {formatLabel(opt)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-foreground">
          {value ? (
            formatLabel(value)
          ) : (
            <span className="text-muted-foreground italic">Not set</span>
          )}
        </p>
      )}
    </div>
  );
}

export function ProfileEditor({ className }: { className?: string | undefined }) {
  const { data: profileRow, isLoading } = useAdvisorProfileQuery();
  const mutation = useAdvisorProfileMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AdvisorProfileData>({});

  const profile: AdvisorProfileData = profileRow?.profile ?? {};
  const completeness = getProfileCompleteness(profile);
  const filledCount = Math.round(completeness * PROFILE_FIELDS.length);

  function startEditing() {
    setDraft({ ...profile });
    setEditing(true);
  }

  function cancelEditing() {
    setDraft({});
    setEditing(false);
  }

  function save() {
    mutation.mutate(draft, {
      onSuccess: () => {
        toast.success('Profile updated');
        setEditing(false);
      },
      onError: () => toast.error('Failed to update profile'),
    });
  }

  const activeProfile = editing ? draft : profile;

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-5 w-32 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-5 w-full rounded bg-muted" />
              </div>
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
            <User className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Investor Profile</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {filledCount}/{PROFILE_FIELDS.length} fields
            </Badge>
          </div>
          {editing ? (
            <div className="flex items-center gap-1">
              <Button size="icon-xs" variant="ghost" onClick={cancelEditing}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="xs" onClick={save} disabled={mutation.isPending}>
                <Save className="mr-1 h-3 w-3" />
                Save
              </Button>
            </div>
          ) : (
            <Button size="icon-xs" variant="ghost" onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">
          Help the advisor understand your trading style and goals
        </CardDescription>
        {/* Completeness bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(completeness * 100)}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Risk Tolerance"
            value={activeProfile.risk_tolerance}
            options={RISK_OPTIONS}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, risk_tolerance: v as RiskTolerance })}
          />
          <SelectField
            label="Experience Level"
            value={activeProfile.experience_level}
            options={EXPERIENCE_OPTIONS}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, experience_level: v as ExperienceLevel })}
          />
          <SelectField
            label="Investment Horizon"
            value={activeProfile.investment_horizon}
            options={HORIZON_OPTIONS}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, investment_horizon: v as InvestmentHorizon })}
          />
          <SelectField
            label="Primary Goal"
            value={activeProfile.primary_goal}
            options={GOAL_OPTIONS}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, primary_goal: v as InvestmentGoal })}
          />
          <SelectField
            label="Account Size"
            value={activeProfile.account_size_range}
            options={SIZE_OPTIONS}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, account_size_range: v as AccountSizeRange })}
          />
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </label>
            {editing ? (
              <textarea
                value={draft.notes ?? ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="Anything else about your style..."
              />
            ) : (
              <p className="text-sm text-foreground">
                {profile.notes || <span className="text-muted-foreground italic">Not set</span>}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
