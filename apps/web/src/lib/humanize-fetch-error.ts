/**
 * Translate a thrown query/fetch error into a short, user-friendly message.
 *
 * The query hooks in this app raise errors like `new Error("Bars fetch
 * failed: 503")` or `new Error("Engine error: 429")`. Those strings leak
 * HTTP status codes into user-visible alerts. Route them through this
 * helper before rendering so the UI stays readable.
 */

export interface HumanizeFetchErrorOptions {
  /**
   * Short noun describing what was being loaded, e.g. `"market data"`,
   * `"signal scan"`, `"journal entries"`. Used to tailor the default
   * copy. Should be lowercase and not end in punctuation.
   */
  subject?: string;
}

export function humanizeFetchError(err: unknown, options: HumanizeFetchErrorOptions = {}): string {
  const subject = options.subject ?? 'data';
  if (err == null) return `Could not load ${subject}.`;

  const raw = err instanceof Error ? err.message : String(err);

  if (/timed out|timeout|AbortError/i.test(raw)) {
    return `Request timed out while loading ${subject}.`;
  }

  if (/failed to fetch|network|NetworkError/i.test(raw)) {
    return `Network error while loading ${subject}.`;
  }

  const statusMatch = raw.match(/\b([45]\d{2})\b/);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  if (status === 503) return `${capitalize(subject)} service is temporarily unavailable.`;
  if (status === 504) return `${capitalize(subject)} request timed out upstream.`;
  if (status === 429) return 'Rate limit reached. Please retry shortly.';
  if (status === 404) return `No ${subject} found.`;
  if (status === 401 || status === 403) return `Not authorized to load ${subject}.`;
  if (status && status >= 500) return `${capitalize(subject)} service is having trouble right now.`;
  if (status && status >= 400) return `Could not load ${subject} (error ${status}).`;

  return `Could not load ${subject}.`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
