import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  TrafficCone,
  FileSearch,
  GitFork,
  Leaf,
  Accessibility,
  Settings,
  Flame,
} from 'lucide-react';
import { AppModule } from '../../types';

interface SidebarProps {
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  criticalCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  criticalCount = 0,
}) => {
  const navItems: { id: AppModule; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: 'safety',
      label: 'Road Safety',
      icon: <ShieldAlert className="h-4 w-4" />,
      badge: criticalCount > 0 ? criticalCount : undefined,
    },
    {
      id: 'traffic',
      label: 'Traffic Management',
      icon: <TrafficCone className="h-4 w-4" />,
    },
    {
      id: 'explorer',
      label: 'Incident Explorer',
      icon: <FileSearch className="h-4 w-4" />,
    },
    {
      id: 'planning',
      label: 'Transport Planning',
      icon: <GitFork className="h-4 w-4" />,
    },
    {
      id: 'sustainability',
      label: 'Sustainable Mobility',
      icon: <Leaf className="h-4 w-4" />,
    },
    {
      id: 'accessibility',
      label: 'Accessibility Analysis',
      icon: <Accessibility className="h-4 w-4" />,
    },
    {
      id: 'settings',
      label: 'System Settings',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-[#090e1a]/95 flex flex-col justify-between p-4 z-20">
      <div>
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
          Operations Command
        </div>
        <nav className="mt-1 space-y-1">
          {navItems.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id)}
                className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm shadow-sky-950'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-sky-400' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="flex items-center gap-1 rounded-full bg-red-950/80 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-700/50">
                    <Flame className="h-3 w-3 text-red-400" />
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Fleet & Corridor Quick Telemetry Footer */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-xs">
        <div className="flex items-center justify-between text-slate-400 text-[11px]">
          <span>Corridor Status</span>
          <span className="text-emerald-400 font-mono">Optimal</span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-sky-400 w-3/4 rounded-full" />
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          Metropolitan Bay Corridor — 12 Sensors Online
        </p>
      </div>
    </aside>
  );
};
