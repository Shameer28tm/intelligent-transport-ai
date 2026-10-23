import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  isPositiveChange?: boolean;
  icon: React.ReactNode;
  variant?: 'default' | 'critical' | 'warning' | 'accent';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  change,
  isPositiveChange,
  icon,
  variant = 'default',
}) => {
  const borderStyles = {
    default: 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60 shadow-xs',
    critical: 'border-red-200 dark:border-red-900/40 hover:border-red-300 dark:hover:border-red-700/60 bg-red-50/70 dark:bg-red-950/20 shadow-xs',
    warning: 'border-amber-200 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/20 shadow-xs',
    accent: 'border-sky-200 dark:border-sky-900/40 hover:border-sky-300 dark:hover:border-sky-700/60 bg-sky-50/70 dark:bg-sky-950/20 shadow-xs',
  }[variant];

  const iconBgStyles = {
    default: 'bg-slate-100 dark:bg-slate-800/80 text-sky-600 dark:text-sky-400',
    critical: 'bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40',
    warning: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40',
    accent: 'bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800/40',
  }[variant];

  return (
    <div
      className={`rounded-xl border ${borderStyles} p-4 transition-all duration-150`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">{value}</span>
            {change && (
              <span
                className={`text-xs font-semibold ${
                  isPositiveChange ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {change}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${iconBgStyles}`}>{icon}</div>
      </div>
    </div>
  );
};
