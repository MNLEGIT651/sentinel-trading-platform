import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('workflow_step_log')
    .select('*')
    .eq('job_id', id)
    .order('executed_at', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to fetch steps') },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}
