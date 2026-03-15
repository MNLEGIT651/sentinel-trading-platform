import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sentinel-web',
    timestamp: new Date().toISOString(),
  });
}
