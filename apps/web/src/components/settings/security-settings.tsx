'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Smartphone, Key, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading security settings…</span>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* MFA Card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
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
              <div className="space-y-2">
                {verifiedFactors.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {f.friendly_name ?? 'Authenticator App'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(f.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unenrollFactor(f.id)}
                      disabled={unenrolling === f.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {unenrolling === f.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : enrollState === 'idle' ? (
            <>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security by requiring a code from your authenticator app when
                signing in.
              </p>
              <Button size="sm" onClick={startEnroll}>
                <Key className="h-3.5 w-3.5 mr-1.5" />
                Enable MFA
              </Button>
            </>
          ) : null}

          {/* Enrollment flow */}
          {enrollState === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up…
            </div>
          )}

          {enrollState === 'show_qr' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app (Google Authenticator, Authy,
                1Password, etc.):
              </p>
              <div className="flex justify-center rounded-md border border-border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUri} alt="MFA QR Code" className="h-48 w-48" />
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">Or enter this secret manually:</p>
                <code className="text-xs font-mono break-all select-all">{totpSecret}</code>
              </div>
              <div className="space-y-2">
                <label htmlFor="totp-verify" className="text-sm font-medium">
                  Enter the 6-digit code from your app:
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="totp-verify"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-center text-sm font-mono tracking-widest ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-32"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={verifyEnrollment}
                      disabled={verifyCode.length !== 6 || verifying}
                      className="flex-1 sm:flex-initial"
                    >
                      {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
                    </Button>
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
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Account Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border/50 overflow-hidden">
            <div className="bg-muted/30 px-3 py-1.5">
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                Security Status
              </p>
            </div>
            <div className="divide-y divide-border/50">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground">Two-Factor Auth</span>
                <span
                  className={`text-xs font-medium ${verifiedFactors.length > 0 ? 'text-profit' : 'text-amber-500'}`}
                >
                  {verifiedFactors.length > 0 ? '✓ Enabled' : '○ Not enabled'}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground">Password</span>
                <span className="text-xs font-medium text-profit">✓ Set</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground">Email Verified</span>
                <span className="text-xs font-medium text-profit">✓ Verified</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              We strongly recommend enabling two-factor authentication, especially before activating
              live trading. Passkey support will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
