import type { MetadataRoute } from 'next';
import { getCanonicalSiteUrl } from '@/lib/auth/url';

// Canonical robots.txt is generated at request time so preview and production
// deployments resolve to the correct host via `getCanonicalSiteUrl`.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getCanonicalSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/onboarding/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
