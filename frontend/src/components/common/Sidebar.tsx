import {
  LayoutDashboard,
  ShieldAlert,
  Siren,
  TrafficCone,
  FileSearch,
  GitFork,
  Leaf,
  Accessibility,
  Settings,
  Flame,
  X,
  Video,
  Map,
} from 'lucide-react';
import { AppModule } from '../../types';

interface SidebarProps {
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  criticalCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  criticalCount = 0,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  // Primary Navigation (Section 6 Requirements)
  const primaryNavItems: { id: AppModule; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: 'map',
      label: 'Live Map',
      icon: <Map className="h-4 w-4" />,
    },
    {
      id: 'traffic-intelligence',
      label: 'Traffic Intelligence',
      icon: <Video className="h-4 w-4" />,
    },
    {
      id: 'safety',
      label: 'TN Road Safety',
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      id: 'emergency',
      label: 'Emergency Response',
      icon: <Siren className="h-4 w-4" />,
    },
    {
      id: 'explorer',
      label: 'Incidents',
      icon: <FileSearch className="h-4 w-4" />,
      badge:
        criticalCount > 0 ? (
          <span className="flex items-center gap-1 rounded-full bg-red-950/80 px-2 py-0.5 text-[10px] font-bold text-red-300 border border-red-700/50">
            <Flame className="h-3 w-3 text-red-400" />
            {criticalCount}
          </span>
        ) : undefined,
    },
    {
      id: 'settings',
      label: 'Settings & Health',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  // Secondary Operations Modules (Preserved Features)
  const secondaryNavItems: { id: AppModule; label: string; icon: React.ReactNode }[] = [
    {
      id: 'traffic',
      label: 'Traffic Corridors',
      icon: <TrafficCone className="h-4 w-4" />,
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
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080d1a] flex flex-col justify-between p-4 transition-all duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Header on mobile with close button */}
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase font-mono">
            <span>Operations Modules</span>
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden text-slate-400 hover:text-slate-700 dark:hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Primary Operations */}
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase font-mono">
                Primary Operations
              </div>
              <nav className="mt-1 space-y-1">
                {primaryNavItems.map((item) => {
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectModule(item.id);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Additional Modules */}
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase font-mono">
                Illustrative concepts (not TN data)
              </div>
              <nav className="mt-1 space-y-0.5">
                {secondaryNavItems.map((item) => {
                  const isActive = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectModule(item.id);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-300 font-semibold'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/30 hover:text-slate-800 dark:hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}>{item.icon}</span>
                        <span className="text-[11px]">{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

      </aside>
    </>
  );
};
