import { Router, type Request, type Response, type NextFunction } from 'express';
import { getSupabaseClient } from '../supabase-client.js';

export function agentRunsRouter(): Router {
  const router = Router();

  router.get('/agent-runs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

      const db = getSupabaseClient();
      let query = db
        .from('cycle_history')
        .select('id, holder_id, started_at, finished_at, agents_run, outcome, error')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('outcome', status);
      }
      if (role) {
        query = query.contains('agents_run', [role]);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const runs = (data ?? []).map((row) => ({
        id: row.id,
        agents_run: row.agents_run,
        started_at: row.started_at,
        finished_at: row.finished_at,
        status: row.outcome,
        duration_ms: row.finished_at
          ? new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()
          : null,
        error: row.error ?? null,
      }));

      res.json({ runs });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/agent-runs/:id',
    async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = req.params['id'];
        if (!id) {
          res.status(400).json({ error: 'missing_id' });
          return;
        }

        const db = getSupabaseClient();
        const { data: run, error: runError } = await db
          .from('cycle_history')
          .select('id, holder_id, started_at, finished_at, agents_run, outcome, error')
          .eq('id', id)
          .single();

        if (runError || !run) {
          res.status(404).json({ error: 'not_found', message: `Agent run ${id} not found` });
          return;
        }

        // Fetch agent_logs created during this run's time window
        let logsQuery = db
          .from('agent_logs')
          .select(
            'id, agent_name, action, input, output, tokens_used, duration_ms, status, created_at',
          )
          .order('created_at', { ascending: true });

        if (run.started_at) {
          logsQuery = logsQuery.gte('created_at', run.started_at);
        }
        if (run.finished_at) {
          logsQuery = logsQuery.lte('created_at', run.finished_at);
        }

        const { data: logs, error: logsError } = await logsQuery;
        if (logsError) throw new Error(logsError.message);

        res.json({
          run: {
            id: run.id,
            agents_run: run.agents_run,
            started_at: run.started_at,
            finished_at: run.finished_at,
            status: run.outcome,
            duration_ms: run.finished_at
              ? new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()
              : null,
            error: run.error ?? null,
          },
          logs: logs ?? [],
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
