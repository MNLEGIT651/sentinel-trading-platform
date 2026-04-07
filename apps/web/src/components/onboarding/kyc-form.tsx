'use client';

import { useState, useCallback } from 'react';
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Shield,
  User,
  MapPin,
  Briefcase,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { engineUrl } from '@/lib/engine-fetch';

const KYC_STEPS = [
  { key: 'identity', label: 'Identity', icon: User },
  { key: 'address', label: 'Address', icon: MapPin },
  { key: 'employment', label: 'Employment', icon: Briefcase },
  { key: 'review', label: 'Review & Submit', icon: FileCheck },
] as const;

type KycStep = (typeof KYC_STEPS)[number]['key'];

interface KycFormData {
  // Identity
  given_name: string;
  family_name: string;
  date_of_birth: string;
  email_address: string;
  phone_number: string;
  country_of_citizenship: string;

  // Address
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;

  // Employment
  employment_status: string;
  employer_name: string;
  funding_source: string;
}

const INITIAL_FORM: KycFormData = {
  given_name: '',
  family_name: '',
  date_of_birth: '',
  email_address: '',
  phone_number: '',
  country_of_citizenship: 'USA',
  street_address: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'USA',
  employment_status: 'employed',
  employer_name: '',
  funding_source: 'employment_income',
};

interface KycFormProps {
  /** Called when the application is submitted successfully. */
  onSubmitted?: ((result: { account_id: string; status: string }) => void) | undefined;
  /** Called when the user cancels. */
  onCancel?: (() => void) | undefined;
}

export function KycForm({ onSubmitted, onCancel }: KycFormProps) {
  const [step, setStep] = useState<KycStep>('identity');
  const [form, setForm] = useState<KycFormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const stepIdx = KYC_STEPS.findIndex((s) => s.key === step);

  const update = useCallback((field: keyof KycFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const goNext = useCallback(() => {
    const next = KYC_STEPS[stepIdx + 1];
    if (next) setStep(next.key);
  }, [stepIdx]);

  const goBack = useCallback(() => {
    const prev = KYC_STEPS[stepIdx - 1];
    if (prev) setStep(prev.key);
  }, [stepIdx]);

  const canAdvance = useCallback((): boolean => {
    switch (step) {
      case 'identity':
        return !!(
          form.given_name.trim() &&
          form.family_name.trim() &&
          form.date_of_birth &&
          form.email_address.trim()
        );
      case 'address':
        return !!(
          form.street_address.trim() &&
          form.city.trim() &&
          form.state.trim() &&
          form.postal_code.trim()
        );
      case 'employment':
        return !!form.employment_status;
      case 'review':
        return true;
    }
  }, [step, form]);

  const submitApplication = useCallback(async () => {
    setSubmitting(true);
    try {
      // 1. Create broker account record in our DB
      const createRes = await fetch('/api/onboarding/broker', {
        method: 'POST',
      });
      if (!createRes.ok && createRes.status !== 409) {
        const err = (await createRes.json().catch(() => null)) as { error?: string } | null;
        toast.error(err?.error ?? 'Failed to create broker account');
        return;
      }

      // 2. Submit KYC application to Alpaca via engine
      const application = {
        contact: {
          email_address: form.email_address,
          phone_number: form.phone_number,
          street_address: [form.street_address],
          city: form.city,
          state: form.state,
          postal_code: form.postal_code,
          country: form.country,
        },
        identity: {
          given_name: form.given_name,
          family_name: form.family_name,
          date_of_birth: form.date_of_birth,
          country_of_citizenship: form.country_of_citizenship,
          country_of_tax_residence: form.country,
          funding_source: [form.funding_source],
        },
        agreements: [
          {
            agreement: 'customer_agreement',
            signed_at: new Date().toISOString(),
            ip_address: '0.0.0.0',
          },
          {
            agreement: 'account',
            signed_at: new Date().toISOString(),
            ip_address: '0.0.0.0',
          },
        ],
      };

      const engineRes = await fetch(engineUrl('/onboarding/broker-application'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      });

      if (!engineRes.ok) {
        const err = (await engineRes.json().catch(() => null)) as { detail?: string } | null;
        toast.error(err?.detail ?? 'Failed to submit application');
        return;
      }

      const result = (await engineRes.json()) as { account_id: string; status: string };

      // 3. Update our broker_accounts record with the Alpaca account ID
      const brokerUpdateRes = await fetch('/api/onboarding/broker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_account_id: result.account_id,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        }),
      });
      if (!brokerUpdateRes.ok) {
        console.warn(
          '[KYC] Failed to update broker record after submission, status:',
          brokerUpdateRes.status,
        );
      }

      // 4. Update onboarding step
      const profileRes = await fetch('/api/onboarding/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_step: 'kyc_submitted' }),
      });
      if (!profileRes.ok) {
        console.warn(
          '[KYC] Failed to update onboarding step after submission, status:',
          profileRes.status,
        );
      }

      toast.success('Application submitted successfully');
      onSubmitted?.(result);
    } catch (err) {
      console.error(
        '[KYC] Application submission failed:',
        err instanceof Error ? err.message : String(err),
      );
      toast.error('Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  }, [form, onSubmitted]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Open Live Trading Account
          </CardTitle>
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-3">
          {KYC_STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = s.key === step;
            const isDone = idx < stepIdx;

            return (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : isDone
                        ? 'text-profit'
                        : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {idx < KYC_STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 'identity' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              This information is sent directly to our brokerage partner for identity verification.
              We do not store your SSN or government ID.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="First Name"
                value={form.given_name}
                onChange={(v) => update('given_name', v)}
                required
              />
              <Field
                label="Last Name"
                value={form.family_name}
                onChange={(v) => update('family_name', v)}
                required
              />
            </div>
            <Field
              label="Date of Birth"
              type="date"
              value={form.date_of_birth}
              onChange={(v) => update('date_of_birth', v)}
              required
            />
            <Field
              label="Email Address"
              type="email"
              value={form.email_address}
              onChange={(v) => update('email_address', v)}
              required
            />
            <Field
              label="Phone Number"
              type="tel"
              value={form.phone_number}
              onChange={(v) => update('phone_number', v)}
              placeholder="+1 (555) 555-5555"
            />
            <SelectField
              label="Citizenship"
              value={form.country_of_citizenship}
              onChange={(v) => update('country_of_citizenship', v)}
              options={[
                { value: 'USA', label: 'United States' },
                { value: 'CAN', label: 'Canada' },
                { value: 'GBR', label: 'United Kingdom' },
              ]}
            />
          </div>
        )}

        {step === 'address' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Your residential address for account registration.
            </p>
            <Field
              label="Street Address"
              value={form.street_address}
              onChange={(v) => update('street_address', v)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={form.city} onChange={(v) => update('city', v)} required />
              <Field
                label="State"
                value={form.state}
                onChange={(v) => update('state', v)}
                required
                placeholder="CA"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Postal Code"
                value={form.postal_code}
                onChange={(v) => update('postal_code', v)}
                required
                placeholder="90210"
              />
              <SelectField
                label="Country"
                value={form.country}
                onChange={(v) => update('country', v)}
                options={[
                  { value: 'USA', label: 'United States' },
                  { value: 'CAN', label: 'Canada' },
                  { value: 'GBR', label: 'United Kingdom' },
                ]}
              />
            </div>
          </div>
        )}

        {step === 'employment' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Financial regulators require employment and income source information.
            </p>
            <SelectField
              label="Employment Status"
              value={form.employment_status}
              onChange={(v) => update('employment_status', v)}
              options={[
                { value: 'employed', label: 'Employed' },
                { value: 'self_employed', label: 'Self-Employed' },
                { value: 'unemployed', label: 'Not Employed' },
                { value: 'retired', label: 'Retired' },
                { value: 'student', label: 'Student' },
              ]}
            />
            {(form.employment_status === 'employed' ||
              form.employment_status === 'self_employed') && (
              <Field
                label="Employer Name"
                value={form.employer_name}
                onChange={(v) => update('employer_name', v)}
              />
            )}
            <SelectField
              label="Primary Funding Source"
              value={form.funding_source}
              onChange={(v) => update('funding_source', v)}
              options={[
                { value: 'employment_income', label: 'Employment Income' },
                { value: 'investments', label: 'Investments' },
                { value: 'inheritance', label: 'Inheritance' },
                { value: 'business_income', label: 'Business Income' },
                { value: 'savings', label: 'Savings' },
              ]}
            />
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Review your information before submitting. Your data will be sent to our brokerage
              partner for verification.
            </p>
            <ReviewRow label="Name" value={`${form.given_name} ${form.family_name}`} />
            <ReviewRow label="Date of Birth" value={form.date_of_birth} />
            <ReviewRow label="Email" value={form.email_address} />
            <ReviewRow label="Phone" value={form.phone_number || '—'} />
            <ReviewRow label="Citizenship" value={form.country_of_citizenship} />
            <ReviewRow
              label="Address"
              value={`${form.street_address}, ${form.city}, ${form.state} ${form.postal_code}`}
            />
            <ReviewRow label="Employment" value={form.employment_status} />
            <ReviewRow label="Funding Source" value={form.funding_source} />

            <div className="rounded-md bg-amber-500/10 px-3 py-2 mt-2">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                By submitting, you confirm this information is accurate and agree to the Customer
                Agreement and Electronic Delivery Consent.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button size="sm" variant="outline" onClick={goBack} disabled={stepIdx === 0}>
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back
          </Button>

          {step === 'review' ? (
            <Button size="sm" onClick={submitApplication} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit Application
                  <ArrowRight className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          ) : (
            <Button size="sm" onClick={goNext} disabled={!canAdvance()}>
              Next
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Form Field Components ──────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
