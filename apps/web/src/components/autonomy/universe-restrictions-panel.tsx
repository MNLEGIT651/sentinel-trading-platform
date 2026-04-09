'use client';

import { useState, useCallback } from 'react';
import { Shield, Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useUniverseRestrictionsQuery,
  useCreateRestrictionMutation,
  useDeleteRestrictionMutation,
} from '@/hooks/queries/use-universe-restrictions-query';
import type { CreateRestrictionInput } from '@/hooks/queries/use-universe-restrictions-query';
import type { RestrictionType, UniverseRestriction } from '@sentinel/shared';
import { cn } from '@/lib/utils';
import { formatTimestamp } from './mode-config';

export function UniverseRestrictionsPanel() {
  const { data: restrictions, isLoading, isError } = useUniverseRestrictionsQuery();
  const createMutation = useCreateRestrictionMutation();
  const deleteMutation = useDeleteRestrictionMutation();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateRestrictionInput>({
    restriction_type: 'blacklist',
    symbols: [],
    sectors: [],
    asset_classes: [],
    reason: null,
  });
  const [symbolsInput, setSymbolsInput] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const symbols = symbolsInput
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      createMutation.mutate(
        { ...formData, symbols },
        {
          onSuccess: () => {
            setShowForm(false);
            setSymbolsInput('');
            setFormData({
              restriction_type: 'blacklist',
              symbols: [],
              sectors: [],
              asset_classes: [],
              reason: null,
            });
          },
        },
      );
    },
    [formData, symbolsInput, createMutation],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Universe Restrictions
          </CardTitle>
          <Button variant="outline" size="xs" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3 w-3" />
            {showForm ? 'Cancel' : 'Add'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
          >
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  Type
                </label>
                <select
                  value={formData.restriction_type}
                  onChange={(e) =>
                    setFormData((d) => ({
                      ...d,
                      restriction_type: e.target.value as RestrictionType,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="blacklist">Blacklist</option>
                  <option value="whitelist">Whitelist</option>
                </select>
              </div>
              <div className="flex-[2]">
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  Symbols (comma separated)
                </label>
                <input
                  type="text"
                  value={symbolsInput}
                  onChange={(e) => setSymbolsInput(e.target.value)}
                  placeholder="AAPL, TSLA, MSFT"
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                Reason
              </label>
              <input
                type="text"
                value={formData.reason ?? ''}
                onChange={(e) => setFormData((d) => ({ ...d, reason: e.target.value || null }))}
                placeholder="Optional reason for this restriction"
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="xs"
                disabled={createMutation.isPending || !symbolsInput.trim()}
              >
                {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Create Restriction
              </Button>
            </div>
          </form>
        )}

        {/* Restrictions list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load restrictions</p>
        ) : !restrictions || restrictions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No universe restrictions active
          </p>
        ) : (
          <div className="space-y-2">
            {restrictions.map((r: UniverseRestriction) => (
              <div
                key={r.id}
                className="flex items-start justify-between rounded-lg border border-border bg-muted/20 p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'border text-[10px]',
                        r.restriction_type === 'blacklist'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20',
                      )}
                    >
                      {r.restriction_type}
                    </Badge>
                    {r.symbols.length > 0 && (
                      <span className="text-xs font-medium text-foreground">
                        {r.symbols.join(', ')}
                      </span>
                    )}
                    {r.sectors.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Sectors: {r.sectors.join(', ')}
                      </span>
                    )}
                  </div>
                  {r.reason && <p className="text-[10px] text-muted-foreground">{r.reason}</p>}
                  <p className="text-[10px] text-muted-foreground/60">
                    Created {formatTimestamp(r.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(r.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Delete restriction"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
