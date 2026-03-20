import { NextResponse } from 'next/server';
import {
  ServiceError,
  extractErrorMessage,
  serializeServiceError,
  type ServiceName,
} from '@/lib/service-error';
import { getServiceAttempts, getServiceConfig, getServiceTimeoutMs } from './service-config';

const RETRYABLE_UPSTREAM_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function combineSignals(signals: Array<AbortSignal | null | undefined>): AbortSignal | undefined {
  const activeSignals = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined && signal !== null,
  );

  if (activeSignals.length === 0) return undefined;
  if (activeSignals.length === 1) return activeSignals[0];
  return AbortSignal.any(activeSignals);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isRetryableNetworkError(error: unknown): boolean {
  return error instanceof TypeError || isTimeoutError(error);
}

function mapUpstreamStatus(status: number): number {
  if (status === 404) return 404;
  if (status === 429) return 503;
  if (status === 401 || status === 403) return 502;
  if (status >= 500) return 502;
  return status;
}

function filterResponseHeaders(headers: Headers): Headers {
  const nextHeaders = new Headers();
  const contentType = headers.get('content-type');
  const cacheControl = headers.get('cache-control');

  if (contentType) nextHeaders.set('content-type', contentType);
  if (cacheControl) nextHeaders.set('cache-control', cacheControl);

  return nextHeaders;
}

function buildUpstreamUrl(baseUrl: string, upstreamPath: string, search: string): string {
  const url = new URL(baseUrl);
  const prefix = url.pathname.replace(/\/+$/, '');
  url.pathname = `${prefix}${upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`}`;
  url.search = search;
  return url.toString();
}

function toForwardedHeaders(request: Request, serviceHeaders: Record<string, string>): Headers {
  const headers = new Headers(serviceHeaders);
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');

  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);

  return headers;
}

async function readUpstreamErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const json = await response.json().catch(() => null);
    return extractErrorMessage(json, fallback);
  }

  const text = await response.text().catch(() => '');
  return extractErrorMessage(text, fallback);
}

function waitWithJitter(attempt: number): Promise<void> {
  const base = 150 * attempt;
  const jitter = Math.floor(Math.random() * 100);
  return new Promise((resolve) => setTimeout(resolve, base + jitter));
}

function logProxyFailure(error: ServiceError, meta: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      scope: 'service-proxy',
      level: 'error',
      message: error.message,
      code: error.code,
      service: error.service,
      status: error.status,
      upstreamStatus: error.upstreamStatus,
      retryable: error.retryable,
      ...meta,
    }),
  );
}

async function fetchUpstream(
  service: ServiceName,
  request: Request,
  upstreamPath: string,
): Promise<Response> {
  const config = getServiceConfig(service);
  const method = request.method.toUpperCase();

  if (!config.configured || !config.baseUrl) {
    const error = new ServiceError(`${config.label} is not configured for this deployment.`, {
      code: 'not_configured',
      service,
      retryable: false,
      status: 503,
    });
    logProxyFailure(error, {
      action: 'failed',
      attempt: 0,
      attempts: 0,
      durationMs: 0,
      method,
      upstreamPath,
    });
    throw error;
  }

  const url = new URL(request.url);
  const timeoutMs = getServiceTimeoutMs(service, upstreamPath, method);
  const attempts = getServiceAttempts(service, upstreamPath, method);
  const body: BodyInit | null =
    method === 'GET' || method === 'HEAD' ? null : await request.arrayBuffer();

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();

    try {
      const signal = combineSignals([request.signal, AbortSignal.timeout(timeoutMs)]);
      const response = await fetch(buildUpstreamUrl(config.baseUrl, upstreamPath, url.search), {
        method,
        headers: toForwardedHeaders(request, config.headers),
        body,
        cache: 'no-store',
        ...(signal != null && { signal }),
      });

      if (!response.ok) {
        const retryable =
          ['GET', 'HEAD'].includes(method) && RETRYABLE_UPSTREAM_STATUSES.has(response.status);
        const fallbackMessage = `${config.label} returned ${response.status}.`;
        throw new ServiceError(await readUpstreamErrorMessage(response, fallbackMessage), {
          code: 'upstream',
          service,
          retryable,
          status: mapUpstreamStatus(response.status),
          upstreamStatus: response.status,
        });
      }

      return response;
    } catch (error) {
      const serviceError =
        error instanceof ServiceError
          ? error
          : isTimeoutError(error)
            ? new ServiceError(`${config.label} timed out after ${timeoutMs}ms.`, {
                code: 'timeout',
                service,
                retryable: ['GET', 'HEAD'].includes(method),
                status: 504,
              })
            : isAbortError(error)
              ? new ServiceError(`${config.label} request was aborted.`, {
                  code: 'aborted',
                  service,
                  retryable: false,
                  status: 499,
                })
              : new ServiceError(`Unable to reach ${config.label}.`, {
                  code: 'network',
                  service,
                  retryable: ['GET', 'HEAD'].includes(method) && isRetryableNetworkError(error),
                  status: 502,
                });

      const durationMs = Date.now() - startedAt;
      if (attempt < attempts && serviceError.retryable) {
        logProxyFailure(serviceError, {
          action: 'retrying',
          attempt,
          attempts,
          durationMs,
          method,
          upstreamPath,
        });
        await waitWithJitter(attempt);
        continue;
      }

      logProxyFailure(serviceError, {
        action: 'failed',
        attempt,
        attempts,
        durationMs,
        method,
        upstreamPath,
      });
      throw serviceError;
    }
  }

  throw new ServiceError('Unexpected proxy failure.', {
    code: 'unknown',
    service,
    retryable: false,
    status: 500,
  });
}

export async function proxyServiceRequest(
  service: ServiceName,
  request: Request,
  pathSegments: string[] | undefined,
): Promise<Response> {
  const upstreamPath = `/${(pathSegments ?? []).join('/')}`;

  try {
    const response = await fetchUpstream(service, request, upstreamPath);
    return new Response(response.body, {
      status: response.status,
      headers: filterResponseHeaders(response.headers),
    });
  } catch (error) {
    const serviceError =
      error instanceof ServiceError
        ? error
        : new ServiceError('Unexpected proxy failure.', {
            code: 'unknown',
            service,
            retryable: false,
            status: 500,
          });

    return NextResponse.json(serializeServiceError(serviceError), {
      status: serviceError.status,
    });
  }
}
