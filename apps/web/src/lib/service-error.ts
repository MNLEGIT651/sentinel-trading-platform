export type ServiceName = 'engine' | 'agents';

export type ServiceErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'network'
  | 'upstream'
  | 'aborted'
  | 'unknown';

export interface ServiceErrorBody {
  error: string;
  code: ServiceErrorCode;
  service: ServiceName;
  retryable: boolean;
  status: number;
}

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly service: ServiceName;
  readonly retryable: boolean;
  readonly status: number;
  readonly upstreamStatus: number | undefined;

  constructor(
    message: string,
    options: {
      code: ServiceErrorCode;
      service: ServiceName;
      retryable: boolean;
      status: number;
      upstreamStatus?: number;
    },
  ) {
    super(message);
    this.name = 'ServiceError';
    this.code = options.code;
    this.service = options.service;
    this.retryable = options.retryable;
    this.status = options.status;
    this.upstreamStatus = options.upstreamStatus;
  }
}

export function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['error', 'detail', 'message']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
  }

  return fallback;
}

export function serializeServiceError(error: ServiceError): ServiceErrorBody {
  return {
    error: error.message,
    code: error.code,
    service: error.service,
    retryable: error.retryable,
    status: error.status,
  };
}
