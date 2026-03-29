'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Circle, Loader2, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LIVE_TRADING_DISCLOSURES } from '@sentinel/shared';
import type { DisclosureDocument, Consent } from '@sentinel/shared';

interface DisclosuresAcceptanceProps {
  /** Only show disclosures marked as required. */
  requiredOnly?: boolean | undefined;
  /** Called when all required disclosures are accepted. */
  onAllAccepted?: (() => void) | undefined;
}

export function DisclosuresAcceptance({
  requiredOnly = false,
  onAllAccepted,
}: DisclosuresAcceptanceProps) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const disclosures = requiredOnly
    ? LIVE_TRADING_DISCLOSURES.filter((d) => d.required)
    : LIVE_TRADING_DISCLOSURES;

  // Load previously accepted consents
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/onboarding/consent');
        if (!res.ok) return;
        const consents = (await res.json()) as Consent[];
        const map: Record<string, boolean> = {};
        for (const c of consents) {
          map[c.document_type] = true;
        }
        setAccepted(map);
      } catch {
        // Non-blocking
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const acceptDisclosure = useCallback(
    async (doc: DisclosureDocument) => {
      setSaving(doc.type);
      try {
        const res = await fetch('/api/onboarding/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_type: doc.type,
            document_version: doc.version,
          }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          toast.error(err?.error ?? 'Failed to record consent');
          return;
        }

        const next = { ...accepted, [doc.type]: true };
        setAccepted(next);

        // Check if all required are now accepted
        const allRequired = disclosures.filter((d) => d.required).every((d) => next[d.type]);
        if (allRequired && onAllAccepted) {
          onAllAccepted();
        }
      } catch {
        toast.error('Failed to record consent');
      } finally {
        setSaving(null);
      }
    },
    [accepted, disclosures, onAllAccepted],
  );

  const acceptAll = useCallback(async () => {
    const unaccepted = disclosures.filter((d) => !accepted[d.type]);
    for (const doc of unaccepted) {
      await acceptDisclosure(doc);
    }
  }, [disclosures, accepted, acceptDisclosure]);

  const allAccepted = disclosures.every((d) => accepted[d.type]);
  const requiredAccepted = disclosures.filter((d) => d.required).every((d) => accepted[d.type]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading disclosures…</span>
      </div>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Disclosures & Agreements
          </CardTitle>
          {!allAccepted && (
            <Button size="sm" variant="outline" onClick={acceptAll} disabled={!!saving}>
              Accept All
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Review and accept each disclosure before opening a live trading account.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {disclosures.map((doc) => {
          const isAccepted = accepted[doc.type] === true;
          const isSaving = saving === doc.type;

          return (
            <div
              key={doc.type}
              className="flex items-start gap-3 rounded-md border border-border p-3"
            >
              <div className="shrink-0 mt-0.5">
                {isAccepted ? (
                  <Check className="h-4 w-4 text-profit" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{doc.title}</p>
                  {doc.required && (
                    <span className="text-[10px] font-medium text-amber-500 uppercase">
                      Required
                    </span>
                  )}
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{doc.summary}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Version {doc.version}</p>
              </div>
              <div className="shrink-0">
                {isAccepted ? (
                  <span className="text-xs text-profit font-medium">Accepted</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acceptDisclosure(doc)}
                    disabled={!!isSaving}
                  >
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Accept'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {allAccepted && (
          <div className="rounded-md bg-profit/10 px-3 py-2 text-center">
            <p className="text-sm font-medium text-profit">✓ All disclosures accepted</p>
          </div>
        )}

        {!allAccepted && requiredAccepted && (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              All required disclosures accepted. Optional disclosures can be accepted later.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
