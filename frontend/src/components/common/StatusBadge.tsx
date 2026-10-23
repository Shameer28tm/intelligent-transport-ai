import React from 'react';
import { IncidentSeverity, IncidentStatus } from '../../types';

interface StatusBadgeProps {
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ severity, status, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium';

  if (severity) {
    const config: Record<IncidentSeverity, { bg: string; text: string; border: string; dot: string; label: string }> = {
      CRITICAL: {
        bg: 'bg-red-50 dark:bg-red-950/60',
        text: 'text-red-700 dark:text-red-300 font-semibold',
        border: 'border-red-200 dark:border-red-600/50',
        dot: 'bg-red-500 animate-pulse',
        label: 'CRITICAL',
      },
      HIGH: {
        bg: 'bg-orange-50 dark:bg-orange-950/60',
        text: 'text-orange-700 dark:text-orange-300 font-semibold',
        border: 'border-orange-200 dark:border-orange-600/50',
        dot: 'bg-orange-500',
        label: 'HIGH',
      },
      MEDIUM: {
        bg: 'bg-amber-50 dark:bg-amber-950/50',
        text: 'text-amber-700 dark:text-amber-300 font-semibold',
        border: 'border-amber-200 dark:border-amber-600/40',
        dot: 'bg-amber-500',
        label: 'MEDIUM',
      },
      LOW: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/50',
        text: 'text-emerald-700 dark:text-emerald-300 font-semibold',
        border: 'border-emerald-200 dark:border-emerald-600/40',
        dot: 'bg-emerald-500',
        label: 'LOW',
      },
    };

    const cfg = config[severity] || config.MEDIUM;

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border ${cfg.border} ${cfg.bg} ${cfg.text} ${sizeClasses} font-mono tracking-wide`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  }

  if (status) {
    const statusConfig: Record<IncidentStatus, { bg: string; text: string; border: string; label: string }> = {
      REPORTED: {
        bg: 'bg-sky-50 dark:bg-blue-950/60',
        text: 'text-sky-700 dark:text-blue-300 font-medium',
        border: 'border-sky-200 dark:border-blue-600/40',
        label: 'Reported',
      },
      VERIFIED: {
        bg: 'bg-purple-50 dark:bg-purple-950/60',
        text: 'text-purple-700 dark:text-purple-300 font-medium',
        border: 'border-purple-200 dark:border-purple-600/40',
        label: 'Verified',
      },
      DISPATCHED: {
        bg: 'bg-amber-50 dark:bg-amber-950/60',
        text: 'text-amber-700 dark:text-amber-300 font-medium',
        border: 'border-amber-200 dark:border-amber-600/40',
        label: 'Dispatched',
      },
      RESOLVED: {
        bg: 'bg-slate-100 dark:bg-slate-900/60',
        text: 'text-slate-600 dark:text-slate-400 font-medium',
        border: 'border-slate-200 dark:border-slate-700/50',
        label: 'Resolved',
      },
    };

    const cfg = statusConfig[status] || statusConfig.REPORTED;

    return (
      <span
        className={`inline-flex items-center rounded-md border ${cfg.border} ${cfg.bg} ${cfg.text} ${sizeClasses}`}
      >
        {cfg.label}
      </span>
    );
  }

  return null;
};
