'use client';

import { useState } from 'react';
import { Clock, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReplayMode } from './_constants';
import { RecommendationReplayMode } from './_components/RecommendationReplayMode';
import { SystemReplayMode } from './_components/SystemReplayMode';

export default function ReplayPage() {
  const [mode, setMode] = useState<ReplayMode>('recommendation');

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div>
        <h1 className="text-heading-page text-white flex items-center gap-2">
          <Clock className="h-6 w-6 text-indigo-400" />
          Replay &amp; Review
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Reconstruct what happened for any recommendation or replay system state at a point in time
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-800 p-1 w-fit">
        <button
          onClick={() => setMode('recommendation')}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            mode === 'recommendation'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          <Search className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          Recommendation Replay
        </button>
        <button
          onClick={() => setMode('system')}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            mode === 'system' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white',
          )}
        >
          <Clock className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
          System Replay
        </button>
      </div>

      {mode === 'recommendation' ? <RecommendationReplayMode /> : <SystemReplayMode />}
    </div>
  );
}
