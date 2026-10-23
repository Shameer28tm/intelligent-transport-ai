import React, { useState, useEffect, useCallback } from 'react';
import { AppModule, Incident, IncidentStatistics, SystemHealth, IncidentStatus } from './types';
import { api } from './services/api';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { IncidentFormModal } from './components/incidents/IncidentFormModal';
import { VisionUploadModal } from './components/vision/VisionUploadModal';

import { OverviewPage } from './pages/OverviewPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { TrafficIntelligencePage } from './pages/TrafficIntelligencePage';
import { RoadSafetyPage } from './pages/RoadSafetyPage';
import { TrafficManagementPage } from './pages/TrafficManagementPage';
import { IncidentExplorerPage } from './pages/IncidentExplorerPage';
import { TransportPlanningPage } from './pages/TransportPlanningPage';
import { SustainableMobilityPage } from './pages/SustainableMobilityPage';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<AppModule>('overview');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statistics, setStatistics] = useState<IncidentStatistics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isVisionModalOpen, setIsVisionModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Theme Management (Light mode default, dark mode preserved)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Fetch telemetry and incidents
  const loadData = useCallback(async () => {
    try {
      const [healthData, incidentsData, statsData] = await Promise.allSettled([
        api.getHealth(),
        api.getIncidents({ page_size: 100 }),
        api.getStatistics(),
      ]);

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value);
      }
      if (incidentsData.status === 'fulfilled') {
        setIncidents(incidentsData.value.items);
      }
      if (statsData.status === 'fulfilled') {
        setStatistics(statsData.value);
      }
    } catch (err) {
      console.error('[App] Telemetry sync error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Refresh interval every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleCreateIncident = async (payload: any) => {
    const created = await api.createIncident(payload);
    setIncidents((prev) => [created, ...prev]);
    setSelectedIncident(created);
    loadData();
  };

  const handleUpdateStatus = async (id: string, newStatus: IncidentStatus) => {
    const updated = await api.updateIncidentStatus(id, newStatus);
    setIncidents((prev) => prev.map((inc) => (inc.id === id ? updated : inc)));
    if (selectedIncident?.id === id) {
      setSelectedIncident(updated);
    }
    loadData();
  };

  const criticalCount = incidents.filter(
    (i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED'
  ).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#060a12] text-slate-800 dark:text-slate-100 font-sans transition-colors duration-150">
      {/* Sidebar Navigation (with Mobile Drawer Support) */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        criticalCount={criticalCount}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Operational Command Bar */}
        <Header
          health={health}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          onOpenVisionModal={() => setIsVisionModalOpen(true)}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#060a12] p-4 sm:p-6 transition-colors duration-150">
          {activeModule === 'overview' && (
            <OverviewPage
              incidents={incidents}
              statistics={statistics}
              selectedIncident={selectedIncident}
              onSelectIncident={setSelectedIncident}
              onUpdateStatus={handleUpdateStatus}
              isLoading={isLoading}
            />
          )}

          {activeModule === 'map' && (
            <LiveMapPage
              incidents={incidents}
              selectedIncident={selectedIncident}
              onSelectIncident={setSelectedIncident}
              onUpdateStatus={handleUpdateStatus}
              isLoading={isLoading}
            />
          )}

          {activeModule === 'traffic-intelligence' && <TrafficIntelligencePage />}

          {activeModule === 'safety' && (
            <RoadSafetyPage
              incidents={incidents}
              onOpenVisionModal={() => setIsVisionModalOpen(true)}
              onSelectIncident={(inc) => {
                setSelectedIncident(inc);
                setActiveModule('overview');
              }}
            />
          )}

          {activeModule === 'traffic' && (
            <TrafficManagementPage
              incidents={incidents}
              onOpenVisionModal={() => setIsVisionModalOpen(true)}
            />
          )}

          {activeModule === 'explorer' && (
            <IncidentExplorerPage
              incidents={incidents}
              onSelectIncident={(inc) => {
                setSelectedIncident(inc);
                setActiveModule('overview');
              }}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {activeModule === 'planning' && <TransportPlanningPage />}

          {activeModule === 'sustainability' && <SustainableMobilityPage />}

          {activeModule === 'accessibility' && <AccessibilityPage />}

          {activeModule === 'settings' && (
            <SettingsPage
              health={health}
              onRefresh={handleManualRefresh}
              isRefreshing={isRefreshing}
            />
          )}
        </main>
      </div>

      {/* Report Incident Modal */}
      <IncidentFormModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleCreateIncident}
      />

      {/* Computer Vision Safety Audit Modal */}
      <VisionUploadModal
        isOpen={isVisionModalOpen}
        onClose={() => setIsVisionModalOpen(false)}
      />
    </div>
  );
};

export default App;
