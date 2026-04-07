import { NextResponse } from 'next/server';
import { getSystemInfo } from '@/lib/server/system-info';

export async function GET() {
  return NextResponse.json(getSystemInfo());
}
