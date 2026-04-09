import { Trash2, Play, Pause } from 'lucide-react';
import type { RegimePlaybook } from '@/hooks/queries';
import { getRegimeMeta, formatStrategy } from './regime-constants';

export function PlaybookCard({
  playbook,
  onDelete,
  onToggle,
}: {
  playbook: RegimePlaybook;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const meta = getRegimeMeta(playbook.regime);
  const Icon = meta.icon;
  const enabled = playbook.enabled_strategies ?? [];
  const disabled = playbook.disabled_strategies ?? [];
  const weights = playbook.strategy_weights ?? {};
  const weightCount = Object.keys(weights).length;

  const overrides = [
    playbook.max_position_pct != null && `Position: ${playbook.max_position_pct}%`,
    playbook.max_sector_pct != null && `Sector: ${playbook.max_sector_pct}%`,
    playbook.daily_loss_limit_pct != null && `Daily Loss: ${playbook.daily_loss_limit_pct}%`,
    playbook.position_size_modifier !== 1.0 && `Size: ${playbook.position_size_modifier}\u00d7`,
  ].filter(Boolean);

  return (
    <div
      className={`rounded-lg border bg-zinc-900/60 p-4 transition-colors ${
        playbook.is_active ? 'border-zinc-700' : 'border-zinc-800 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded p-1.5 ${meta.bg}`}>
            <Icon className={`h-4 w-4 ${meta.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{playbook.name}</h3>
            <span className={`text-xs ${meta.color}`}>{meta.label} regime</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(playbook.id, !playbook.is_active)}
            className={`rounded p-1.5 ${
              playbook.is_active
                ? 'text-emerald-400 hover:bg-emerald-950/30'
                : 'text-zinc-500 hover:bg-zinc-800'
            }`}
            title={playbook.is_active ? 'Deactivate' : 'Activate'}
          >
            {playbook.is_active ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onDelete(playbook.id)}
            className="rounded p-1.5 text-zinc-500 hover:bg-red-950/30 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {playbook.description && <p className="mt-2 text-xs text-zinc-500">{playbook.description}</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="text-zinc-500">Enabled</div>
          <div className="font-medium text-zinc-300">
            {enabled.length > 0 ? enabled.length : 'All'}
          </div>
        </div>
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="text-zinc-500">Disabled</div>
          <div className="font-medium text-zinc-300">{disabled.length}</div>
        </div>
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="text-zinc-500">Weights</div>
          <div className="font-medium text-zinc-300">
            {weightCount > 0 ? weightCount : '\u2014'}
          </div>
        </div>
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="text-zinc-500">Auto</div>
          <div className="font-medium text-zinc-300">{playbook.auto_approve ? 'Yes' : 'No'}</div>
        </div>
      </div>

      {overrides.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {overrides.map((o) => (
            <span
              key={String(o)}
              className="rounded bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300"
            >
              {o}
            </span>
          ))}
        </div>
      )}

      {enabled.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {enabled.map((s) => (
            <span key={s} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {formatStrategy(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
