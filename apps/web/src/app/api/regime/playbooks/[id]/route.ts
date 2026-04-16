import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { parseBody } from '@/lib/api/validation';
import { checkApiRateLimit } from '@/lib/server/rate-limiter';
import { safeErrorMessage } from '@/lib/api-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/regime/playbooks/[id] ΓÇö Get single playbook
 * PATCH /api/regime/playbooks/[id] ΓÇö Update playbook
 * DELETE /api/regime/playbooks/[id] ΓÇö Delete playbook
 */

const patchBodySchema = z
  .object({
    name: z.string().optional(),
    description: z.string().nullish(),
    is_active: z.boolean().optional(),
    enabled_strategies: z.array(z.string()).optional(),
    disabled_strategies: z.array(z.string()).optional(),
    strategy_weights: z.record(z.string(), z.number()).optional(),
    max_position_pct: z.number().nullish(),
    max_sector_pct: z.number().nullish(),
    daily_loss_limit_pct: z.number().nullish(),
    position_size_modifier: z.number().optional(),
    auto_approve: z.boolean().optional(),
    require_confirmation: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'No valid fields to update',
  });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const { data, error } = await supabase
    .from('regime_playbooks')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const parsed = await parseBody(request, patchBodySchema);
  if (parsed instanceof NextResponse) return parsed;

  const update: Record<string, unknown> = {};
  const allowedFields = [
    'name',
    'description',
    'is_active',
    'enabled_strategies',
    'disabled_strategies',
    'strategy_weights',
    'max_position_pct',
    'max_sector_pct',
    'daily_loss_limit_pct',
    'position_size_modifier',
    'auto_approve',
    'require_confirmation',
  ] as const;

  for (const field of allowedFields) {
    if (field in parsed) {
      update[field] = parsed[field as keyof typeof parsed];
    }
  }

  const { data, error } = await supabase
    .from('regime_playbooks')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to update playbook') },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Playbook not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const rl = await checkApiRateLimit(user.id);
  if (rl) return rl;

  const { error } = await supabase
    .from('regime_playbooks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to delete playbook') },
      { status: 500 },
    );
  }

  return NextResponse.json({ deleted: true });
}
