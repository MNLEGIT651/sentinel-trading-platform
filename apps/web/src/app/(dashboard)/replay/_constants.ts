import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  BarChart3,
  Shield,
  BookOpen,
  Database,
  ShoppingCart,
  Bell,
  ArrowRight,
  Activity,
  Zap,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TimelineEventType, TimelineEventSeverity } from '@/hooks/queries';

export type ReplayMode = 'system' | 'recommendation';

export const EVENT_TYPE_CONFIG: Record<
  TimelineEventType,
  { label: string; icon: LucideIcon; color: string }
> = {
  recommendation: { label: 'Recommendation', icon: BarChart3, color: 'text-blue-400' },
  journal: { label: 'Journal', icon: BookOpen, color: 'text-purple-400' },
  alert: { label: 'Alert', icon: Bell, color: 'text-yellow-400' },
  order: { label: 'Order', icon: ShoppingCart, color: 'text-green-400' },
  data_quality: { label: 'Data Quality', icon: Database, color: 'text-gray-400' },
};

export const SEVERITY_ICONS: Record<TimelineEventSeverity, { icon: LucideIcon; color: string }> = {
  info: { icon: Info, color: 'text-blue-400' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400' },
  error: { icon: XCircle, color: 'text-red-400' },
  success: { icon: CheckCircle2, color: 'text-green-400' },
};

export const WINDOW_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 },
];

export const REC_STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Filled', value: 'filled' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Risk Blocked', value: 'risk_blocked' },
];

export const STATUS_COLORS: Record<string, string> = {
  created: 'bg-blue-500/10 text-blue-400',
  pending: 'bg-blue-500/10 text-blue-400',
  pending_approval: 'bg-blue-500/10 text-blue-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  filled: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  risk_blocked: 'bg-red-500/10 text-red-400',
  risk_checked: 'bg-zinc-500/10 text-zinc-400',
  failed: 'bg-red-500/10 text-red-400',
  cancelled: 'bg-red-500/10 text-red-400',
  submitted: 'bg-amber-500/10 text-amber-400',
  partially_filled: 'bg-amber-500/10 text-amber-400',
  reviewed: 'bg-zinc-500/10 text-zinc-400',
};

export const EVENT_CATEGORY_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  created: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  risk_checked: { bg: 'bg-zinc-500/5', border: 'border-zinc-500/30', dot: 'bg-zinc-400' },
  risk_blocked: { bg: 'bg-red-500/5', border: 'border-red-500/30', dot: 'bg-red-400' },
  pending_approval: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  approved: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  rejected: { bg: 'bg-red-500/5', border: 'border-red-500/30', dot: 'bg-red-400' },
  submitted: { bg: 'bg-indigo-500/5', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
  partially_filled: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  filled: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  cancelled: { bg: 'bg-zinc-500/5', border: 'border-zinc-500/30', dot: 'bg-zinc-400' },
  failed: { bg: 'bg-red-500/5', border: 'border-red-500/30', dot: 'bg-red-400' },
  reviewed: { bg: 'bg-violet-500/5', border: 'border-violet-500/30', dot: 'bg-violet-400' },
};

export const EVENT_ICONS: Record<string, LucideIcon> = {
  created: Zap,
  risk_checked: Shield,
  risk_blocked: Shield,
  pending_approval: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  submitted: ArrowRight,
  partially_filled: Activity,
  filled: CheckCircle2,
  cancelled: XCircle,
  failed: AlertTriangle,
  reviewed: FileText,
};

export const GRADE_COLORS: Record<string, string> = {
  excellent: 'text-emerald-400',
  good: 'text-green-400',
  neutral: 'text-zinc-400',
  bad: 'text-orange-400',
  terrible: 'text-red-400',
};

export const REGIME_COLORS: Record<string, string> = {
  bull: 'text-emerald-400',
  bear: 'text-red-400',
  sideways: 'text-zinc-400',
  volatile: 'text-amber-400',
  crisis: 'text-red-500',
};
