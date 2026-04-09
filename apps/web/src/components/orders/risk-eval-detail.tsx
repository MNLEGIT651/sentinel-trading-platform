import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { RiskEvaluation, RiskCheck } from '@sentinel/shared';

function RiskCheckRow({ check }: { check: RiskCheck }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`h-1.5 w-1.5 rounded-full ${check.passed ? 'bg-green-400' : 'bg-red-400'}`}
      />
      <span className="text-zinc-300">{check.name}</span>
      {check.actual != null && check.limit != null && (
        <span className="text-zinc-500">
          ({check.actual} / {check.limit})
        </span>
      )}
      {check.message && (
        <span className="text-zinc-600 truncate max-w-[150px] sm:max-w-xs">{check.message}</span>
      )}
    </div>
  );
}

interface RiskEvalDetailProps {
  evaluation: RiskEvaluation;
}

export function RiskEvalDetail({ evaluation }: RiskEvalDetailProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3 sm:gap-x-6">
        <div>
          <span className="text-zinc-500">Recommendation</span>
          <div className="flex items-center gap-1">
            <p className="text-zinc-300 font-mono text-[11px] truncate">
              {evaluation.recommendation_id}
            </p>
            <Link
              href={`/recommendations/${evaluation.recommendation_id}`}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <div>
          <span className="text-zinc-500">Policy Version</span>
          <p className="text-zinc-300">{evaluation.policy_version ?? '—'}</p>
        </div>
        <div>
          <span className="text-zinc-500">Decision</span>
          <p className={evaluation.allowed ? 'text-green-400' : 'text-red-400'}>
            {evaluation.allowed ? 'Allowed' : 'Blocked'}
          </p>
        </div>
        {evaluation.adjusted_quantity != null && (
          <div>
            <span className="text-zinc-500">Adjusted Qty</span>
            <p className="text-zinc-300">{evaluation.adjusted_quantity}</p>
          </div>
        )}
        {(evaluation as RiskEvaluation & { original_quantity?: number | null }).original_quantity !=
          null && (
          <div>
            <span className="text-zinc-500">Original Qty</span>
            <p className="text-zinc-300">
              {
                (
                  evaluation as RiskEvaluation & {
                    original_quantity?: number | null;
                  }
                ).original_quantity
              }
            </p>
          </div>
        )}
      </div>

      {evaluation.reason && (
        <div className="text-xs">
          <span className="text-zinc-500">Reason: </span>
          <span className="text-zinc-300">{evaluation.reason}</span>
        </div>
      )}

      {evaluation.checks_performed.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-500">
            Checks ({evaluation.checks_performed.length})
          </p>
          <div className="space-y-1">
            {evaluation.checks_performed.map((check, idx) => (
              <RiskCheckRow key={`${check.name}-${idx}`} check={check} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
