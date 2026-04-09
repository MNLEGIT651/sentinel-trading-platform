import { Shield } from 'lucide-react';
import { SystemAutonomyCard } from '@/components/autonomy/system-autonomy-card';
import { StrategyAutonomyGrid } from '@/components/autonomy/strategy-autonomy-grid';
import { UniverseRestrictionsPanel } from '@/components/autonomy/universe-restrictions-panel';
import { AutoExecutionActivityFeed } from '@/components/autonomy/auto-execution-feed';

export default function AutonomyPage() {
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-heading-page text-foreground">Bounded Autonomy</h1>
          <p className="text-xs text-muted-foreground">
            Configure system and per-strategy autonomy levels, universe restrictions, and monitor
            auto-execution activity
          </p>
        </div>
      </div>

      {/* System autonomy status */}
      <SystemAutonomyCard />

      {/* Strategy grid + Restrictions side by side on large screens */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StrategyAutonomyGrid />
        <UniverseRestrictionsPanel />
      </div>

      {/* Activity feed */}
      <AutoExecutionActivityFeed />
    </div>
  );
}
