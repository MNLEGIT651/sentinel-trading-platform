'use client';

import { ExplanationCard } from './explanation-card';
import { useRecommendationExplanationQuery } from '@/hooks/queries/use-recommendation-explanation-query';

interface ExplanationSectionProps {
  recommendationId: string;
  className?: string | undefined;
}

/** Connected wrapper that fetches explanation data for a recommendation. */
export function ExplanationSection({ recommendationId, className }: ExplanationSectionProps) {
  const { data, isLoading } = useRecommendationExplanationQuery(recommendationId);

  return (
    <ExplanationCard
      explanation={data?.explanation ?? null}
      isLoading={isLoading}
      className={className}
    />
  );
}
