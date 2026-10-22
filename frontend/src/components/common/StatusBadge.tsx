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
        bg: 'bg-red-950/60',
        text: 'text-red-300',
        border: 'border-red-600/50',
        dot: 'bg-red-500 animate-pulse',
        label: 'CRITICAL',
      },
      HIGH: {
        bg: 'bg-orange-950/60',
        text: 'text-orange-300',
        border: 'border-orange-600/50',
        dot: 'bg-orange-500',
        label: 'HIGH',
      },
      MEDIUM: {
        bg: 'bg-amber-950/50',
        text: 'text-amber-300',
        border: 'border-amber-600/40',
        dot: 'bg-amber-500',
        label: 'MEDIUM',
      },
      LOW: {
        bg: 'bg-emerald-950/50',
        text: 'text-emerald-300',
        border: 'border-emerald-600/40',
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
        bg: 'bg-blue-950/60',
        text: 'text-blue-300',
        border: 'border-blue-600/40',
        label: 'Reported',
      },
      VERIFIED: {
        bg: 'bg-purple-950/60',
        text: 'text-purple-300',
        border: 'border-purple-600/40',
        label: 'Verified',
      },
      DISPATCHED: {
        bg: 'bg-amber-950/60',
        text: 'text-amber-300',
        border: 'border-amber-600/40',
        label: 'Dispatched',
      },
      RESOLVED: {
        bg: 'bg-slate-900/60',
        text: 'text-slate-400',
        border: 'border-slate-700/50',
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
