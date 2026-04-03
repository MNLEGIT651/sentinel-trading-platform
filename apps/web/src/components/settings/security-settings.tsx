'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Smartphone, Key, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { LoadingButton } from '@/components/ui/loading-button';
import { createClient } from '@/lib/supabase/client';

interface MfaFactor {
  id: string;
  friendly_name: string | null;
  factor_type: string;
  status: string;
  created_at: string;
}

type EnrollState = 'idle' | 'loading' | 'show_qr' | 'verify';

export function SecuritySettings() {
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollState, setEnrollState] = useState<EnrollState>('idle');
  const [qrUri, setQrUri] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);

  const supabase = createClient();

  const loadFactors = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error('Failed to load MFA factors');
        return;
      }
      // Map SDK types to our local shape
      const mapped: MfaFactor[] = (data.totp ?? []).map((f) => ({
        id: f.id,
        friendly_name: f.friendly_name ?? null,
        factor_type: f.factor_type,
        status: f.status,
        created_at: f.created_at,
      }));
      setFactors(mapped);
    } catch {
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  }, [supabase.auth.mfa]);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const startEnroll = async () => {
    setEnrollState('loading');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });
      if (error) {
        toast.error(error.message);
        setEnrollState('idle');
        return;
      }
      setQrUri(data.totp.qr_code);
      setTotpSecret(data.totp.secret);
      setFactorId(data.id);
      // Validate data URI before rendering (defense-in-depth)
      if (!/^data:image\/[a-z]+;base64,/.test(data.totp.qr_code)) {
        toast.error('Invalid QR code format');
        setEnrollState('idle');
        return;
      }
      setEnrollState('show_qr');
    } catch {
      toast.error('Failed to start MFA enrollment');
      setEnrollState('idle');
    }
  };

  const verifyEnrollment = async () => {
    if (verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) {
        toast.error(challengeError.message);
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyError) {
        toast.error('Invalid code. Please try again.');
        setVerifyCode('');
        return;
      }
      toast.success('MFA enabled successfully');
      setEnrollState('idle');
      setVerifyCode('');
      setQrUri('');
      setTotpSecret('');
      void loadFactors();
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const unenrollFactor = async (id: string) => {
    setUnenrolling(id);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('MFA factor removed');
      void loadFactors();
    } catch {
      toast.error('Failed to remove factor');
    } finally {
      setUnenrolling(null);
    }
  };

  const cancelEnroll = async () => {
    // Unenroll the unverified factor
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    }
    setEnrollState('idle');
    setQrUri('');
    setTotpSecret('');
    setVerifyCode('');
    setFactorId('');
  };

  const verifiedFactors = factors.filter((f) => f.status === 'verified');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Spinner size="md" className="mr-2" />
        <span className="text-sm">Loading security settings…</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 stagger-grid">
      {/* MFA Card */}
      <Card className="w-full max-w-none border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
            <Smartphone className="h-4 w-4" />
            Two-Factor Authentication (TOTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {verifiedFactors.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-profit" />
                <span className="text-foreground">MFA is enabled</span>
              </div>
              <div className="space-y-3">
                {verifiedFactors.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-md border border-border/30 px-3 py-3"
                  >
                    <div>
                      <p className="text-base font-medium leading-tight sm:text-[1.125rem]">
                        {f.friendly_name ?? 'Authenticator App'}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                        Added {new Date(f.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <LoadingButton
                      variant="ghost"
                      size="sm"
                      onClick={() => unenrollFactor(f.id)}
                      loading={unenrolling === f.id}
                      aria-label={`Remove ${f.friendly_name ?? 'authenticator'}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </LoadingButton>
                  </div>
                ))}
              </div>
            </>
          ) : enrollState === 'idle' ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                Add an extra layer of security by requiring a code from your authenticator app when
                signing in.
              </p>
              <LoadingButton
                size="sm"
                onClick={startEnroll}
                loading={enrollState === 'loading'}
                aria-label="Enable multi-factor authentication"
              >
                <Key className="h-3.5 w-3.5 mr-1.5" />
                Enable MFA
              </LoadingButton>
            </>
          ) : null}

          {/* Enrollment flow */}
          {enrollState === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size="sm" />
              Setting up…
            </div>
          )}

          {enrollState === 'show_qr' && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                Scan this QR code with your authenticator app (Google Authenticator, Authy,
                1Password, etc.):
              </p>
              <div className="flex justify-center rounded-md border border-border/40 bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUri} alt="MFA QR Code" className="h-40 w-40 sm:h-48 sm:w-48" />
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="mb-1 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                  Or enter this secret manually:
                </p>
                <code className="text-xs font-mono break-all select-all">{totpSecret}</code>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totp-verify">Enter the 6-digit code from your app:</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="totp-verify"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    aria-label="TOTP verification code"
                    className="text-center font-mono tracking-widest sm:w-32"
                  />
                  <div className="flex gap-2">
                    <LoadingButton
                      size="sm"
                      onClick={verifyEnrollment}
                      disabled={verifyCode.length !== 6}
                      loading={verifying}
                      aria-label="Verify TOTP code"
                      className="flex-1 sm:flex-initial"
                    >
                      Verify
                    </LoadingButton>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelEnroll}
                      className="flex-1 sm:flex-initial"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Security Info Card */}
      <Card className="w-full max-w-none border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
            <Shield className="h-4 w-4" />
            Account Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-hidden rounded-md border border-border/30">
            <div className="bg-muted/30 px-3 py-1.5">
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Security Status
              </p>
            </div>
            <div className="divide-y divide-border/25">
              <div className="flex items-center justify-between px-3 py-3">
                <span className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                  Two-Factor Auth
                </span>
                <span
                  className={`text-sm font-medium ${verifiedFactors.length > 0 ? 'text-profit' : 'text-amber-500'}`}
                >
                  {verifiedFactors.length > 0 ? '✓ Enabled' : '○ Not enabled'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                  Password
                </span>
                <span className="text-sm font-medium text-profit">✓ Set</span>
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                  Email Verified
                </span>
                <span className="text-sm font-medium text-profit">✓ Verified</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              We strongly recommend enabling two-factor authentication, especially before activating
              live trading. Passkey support will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
