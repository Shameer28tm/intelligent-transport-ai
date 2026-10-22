import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';

import {
  RotateCcw,
  Layers,
  Flame,
  AlertTriangle,
  Info,
  Maximize2,
  Minimize2,
  Compass,
} from 'lucide-react';
import { Incident, IncidentSeverity } from '../../types';
import { MapLegend } from './MapLegend';
import { IncidentDetailPanel } from './IncidentDetailPanel';

interface TransportMapProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  onUpdateStatus: (id: string, newStatus: any) => Promise<void>;
  isLoading?: boolean;
}

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 12.2;

export const TransportMap: React.FC<TransportMapProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  onUpdateStatus,
  isLoading,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);


  const [activeSeverityFilter, setActiveSeverityFilter] = useState<string>('ALL');
  const [showCongestionLayer, setShowCongestionLayer] = useState(true);
  const [showCorridorLayer, setShowCorridorLayer] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isOfflineFallback, setIsOfflineFallback] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Filter incidents according to active severity tab
  const filteredIncidents = useMemo(() => {
    if (activeSeverityFilter === 'ALL') return incidents;
    return incidents.filter((inc) => inc.severity === activeSeverityFilter);
  }, [incidents, activeSeverityFilter]);

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      // CARTO Dark Matter raster tile style specification (Free, No API Key needed)
      const cartoDarkStyle: maplibregl.StyleSpecification = {
        version: 8,
        name: 'Dark Transport Command',
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CARTO',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#070b13' },
          },
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      };

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: cartoDarkStyle,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 25,
        attributionControl: false,
      });

      // Navigation controls
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

      map.on('mousemove', (e: any) => {
        setCursorCoords({
          lat: parseFloat(e.lngLat.lat.toFixed(4)),
          lng: parseFloat(e.lngLat.lng.toFixed(4)),
        });
      });

      map.on('error', (e: any) => {
        // Handle tile or style network load failure gracefully
        console.warn('[TransportMap] Notice:', e);
        if (!isOfflineFallback && (e.error?.message?.includes('network') || e.error?.message?.includes('fetch'))) {
          setIsOfflineFallback(true);
        }
      });


      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (err: any) {
      console.error('[TransportMap] WebGL or map init error:', err);
      setMapError('Interactive WebGL map unavailable. Showing cartographic vector fallback.');
      setIsOfflineFallback(true);
    }
  }, []);

  // Update map markers when filtered incidents or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredIncidents.forEach((incident) => {
      const isSelected = selectedIncident?.id === incident.id;

      // Create custom marker DOM element
      const el = document.createElement('div');
      el.className = 'group cursor-pointer relative';

      const colorMap: Record<IncidentSeverity, { bg: string; border: string; glow: string; text: string }> = {
        CRITICAL: {
          bg: 'bg-red-600',
          border: 'border-red-300 ring-4 ring-red-600/40',
          glow: 'animate-radar-critical',
          text: 'text-white',
        },
        HIGH: {
          bg: 'bg-orange-500',
          border: 'border-orange-200 ring-2 ring-orange-500/30',
          glow: '',
          text: 'text-white',
        },
        MEDIUM: {
          bg: 'bg-amber-500',
          border: 'border-amber-200 ring-2 ring-amber-500/30',
          glow: '',
          text: 'text-slate-900',
        },
        LOW: {
          bg: 'bg-emerald-500',
          border: 'border-emerald-200',
          glow: '',
          text: 'text-white',
        },
      };

      const cfg = colorMap[incident.severity] || colorMap.MEDIUM;

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full ${cfg.bg} ${cfg.border} ${cfg.glow} ${cfg.text} flex items-center justify-center font-bold text-[10px] shadow-lg transition-transform hover:scale-125 ${
            isSelected ? 'scale-125 ring-8 ring-sky-400' : ''
          }">
            !
          </div>
          <div class="absolute -top-7 hidden group-hover:flex items-center rounded bg-slate-900/90 text-white text-[10px] px-1.5 py-0.5 border border-slate-700 whitespace-nowrap shadow-md pointer-events-none">
            ${incident.location_name}
          </div>
        </div>
      `;

      el.addEventListener('click', () => {
        onSelectIncident(incident);
        map.flyTo({
          center: [incident.longitude, incident.latitude],
          zoom: 14.5,
          speed: 1.2,
        });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([incident.longitude, incident.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [filteredIncidents, selectedIncident, onSelectIncident]);

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 25,
        speed: 1.2,
      });
    }
  };

  return (
    <div className="relative w-full h-[580px] rounded-2xl border border-slate-800 bg-[#070b13] overflow-hidden shadow-2xl">
      {/* Top Map Action Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        {/* Severity filter pills */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-[#0c1322]/90 backdrop-blur-md p-1 shadow-lg">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setActiveSeverityFilter(sev)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide transition-all ${
                activeSeverityFilter === sev
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-[#0c1322]/90 backdrop-blur-md p-1 shadow-lg">
          <button
            onClick={() => setShowCongestionLayer(!showCongestionLayer)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              showCongestionLayer
                ? 'bg-slate-800 text-sky-400 font-semibold'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Congestion Heat</span>
          </button>

          <button
            onClick={() => setShowCorridorLayer(!showCorridorLayer)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              showCorridorLayer
                ? 'bg-slate-800 text-sky-400 font-semibold'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Corridors</span>
          </button>
        </div>

        {/* Recenter Button */}
        <button
          onClick={handleRecenter}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0c1322]/90 backdrop-blur-md px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors shadow-lg"
          title="Recenter Map View"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset View</span>
        </button>
      </div>

      {/* Primary MapLibre GL Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Offline Grid Fallback if tiles are unavailable or network down */}
      {isOfflineFallback && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-0">
          <div className="self-center bg-slate-900/90 border border-amber-600/50 rounded-lg px-3 py-1.5 text-xs text-amber-300 flex items-center gap-2 shadow-lg">
            <Info className="h-4 w-4 text-amber-400" />
            <span>Map Tile Fallback Active — Markers and coordinate telemetry functional.</span>
          </div>
        </div>
      )}

      {/* Coordinates readout bar in footer */}
      {cursorCoords && (
        <div className="absolute bottom-4 right-16 z-10 hidden sm:flex items-center gap-2 rounded-md border border-slate-800 bg-[#090e1a]/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono text-slate-400">
          <Compass className="h-3 w-3 text-sky-400" />
          <span>
            {cursorCoords.lat}° N, {Math.abs(cursorCoords.lng)}° W
          </span>
        </div>
      )}

      {/* Map Legend */}
      <MapLegend />

      {/* Synchronized Selected Incident Detail Panel */}
      <IncidentDetailPanel
        incident={selectedIncident}
        onClose={() => onSelectIncident(null)}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  );
};
