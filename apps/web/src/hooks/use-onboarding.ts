import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { OnboardingStep } from '@sentinel/shared';

interface CustomerProfile {
  user_id: string;
  onboarding_step: OnboardingStep;
  legal_name: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchProfile(): Promise<CustomerProfile> {
  const res = await fetch('/api/onboarding/profile');
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json() as Promise<CustomerProfile>;
}

export function useOnboardingProfile() {
  return useQuery({
    queryKey: ['onboarding-profile'],
    queryFn: fetchProfile,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useInvalidateOnboarding() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['onboarding-profile'] });
}
