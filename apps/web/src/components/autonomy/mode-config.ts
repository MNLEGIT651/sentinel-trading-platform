import { Lock, Eye, MessageSquare, Zap, Play, Shield } from 'lucide-react';
import type { AutonomyMode } from '@sentinel/shared';

export const AUTONOMY_MODES: AutonomyMode[] = [
  'disabled',
  'alert_only',
  'suggest',
  'auto_approve',
  'auto_execute',
];

export const MODE_CONFIG: Record<
  AutonomyMode,
  { label: string; color: string; bgClass: string; description: string }
> = {
  disabled: {
    label: 'Disabled',
    color: 'text-gray-400',
    bgClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    description: 'All autonomy features off',
  },
  alert_only: {
    label: 'Alert Only',
    color: 'text-blue-400',
    bgClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Notify operators, no action taken',
  },
  suggest: {
    label: 'Suggest',
    color: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    description: 'Suggest actions, require manual approval',
  },
  auto_approve: {
    label: 'Auto Approve',
    color: 'text-orange-400',
    bgClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    description: 'Auto-approve within risk limits',
  },
  auto_execute: {
    label: 'Auto Execute',
    color: 'text-green-400',
    bgClass: 'bg-green-500/10 text-green-400 border-green-500/20',
    description: 'Full autonomous execution',
  },
};

export const MODE_ICONS: Record<AutonomyMode, typeof Shield> = {
  disabled: Lock,
  alert_only: Eye,
  suggest: MessageSquare,
  auto_approve: Zap,
  auto_execute: Play,
};

export function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
