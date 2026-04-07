import webPackage from '../../../package.json';

export interface SystemInfo {
  platform: string;
  appVersion: string;
  engine: string;
  dashboard: string;
  agents: string;
  database: string;
  broker: string;
  marketData: string;
}

function readAppVersion(): string {
  if (process.env.NEXT_PUBLIC_APP_VERSION?.trim()) {
    return process.env.NEXT_PUBLIC_APP_VERSION.trim();
  }

  return webPackage.version ?? '0.0.0';
}

export function getSystemInfo(): SystemInfo {
  return {
    platform: 'Sentinel Trading',
    appVersion: readAppVersion(),
    engine: 'FastAPI (Python 3.12)',
    dashboard: 'Next.js 16 + React 19',
    agents: 'Claude SDK (TypeScript)',
    database: 'Supabase (PostgreSQL 17)',
    broker: 'Alpaca Markets API',
    marketData: 'Polygon.io REST + WebSocket',
  };
}
